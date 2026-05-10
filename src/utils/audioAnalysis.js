const FFT_SIZE = 8192;
const THRESHOLD_DB = -58;            // minimum dB to count a frequency as "ringing"
const FREQ_TOLERANCE_HZ = 10;        // ±Hz window — tight enough that A2(110Hz) can't spill into B2(123Hz)
const WRONG_NOTE_THRESHOLD_DB = -44; // threshold for flagging unexpected peaks
const MUTE_FRAMES_REQUIRED = 2;      // consecutive muted frames before a string turns red (~160ms)
const HARMONIC_RATIOS = [2, 3, 4];   // guitar overtone series to suppress
const HARMONIC_DB_BOOST = 12;        // extra dB required when a lower string could produce this freq as a harmonic

let audioCtx = null;
let analyser = null;
let stream = null;
let source = null;
let pitchDetector = null;
// per-string mute counter: only turn red after MUTE_FRAMES_REQUIRED consecutive silent frames
const mutedFrames = {};

export async function startAudio() {
  if (audioCtx) return;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.75;
  source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);

  const { YIN } = await import('pitchfinder');
  pitchDetector = YIN({ sampleRate: audioCtx.sampleRate, threshold: 0.1 });
}

export function detectPitch() {
  if (!analyser || !pitchDetector) return null;
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  const freq = pitchDetector(buffer);
  return freq && freq > 20 && freq < 1400 ? freq : null;
}

export function stopAudio() {
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  analyser = null; source = null; stream = null;
  Object.keys(mutedFrames).forEach(k => delete mutedFrames[k]);
}

export function getAudioContext() {
  return audioCtx;
}

function peakEnergyAtFreq(buf, binWidth, freq) {
  const centerBin = Math.round(freq / binWidth);
  const halfWindow = Math.ceil(FREQ_TOLERANCE_HZ / binWidth);
  const lo = Math.max(0, centerBin - halfWindow);
  const hi = Math.min(buf.length - 1, centerBin + halfWindow);
  let max = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (buf[i] > max) max = buf[i];
  }
  return max;
}

// Returns per-string analysis for a chord definition
export function analyseChord(chordDef) {
  if (!analyser || !audioCtx) return null;

  const buf = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(buf);
  const binWidth = audioCtx.sampleRate / FFT_SIZE;

  // Process strings low→high so we can suppress harmonics of already-confirmed strings
  const confirmedFundamentals = [];
  const results = [];

  for (const s of chordDef.strings) {
    if (s.muted) {
      results.push({ ...s, status: 'muted_expected', db: -Infinity });
      continue;
    }

    const maxDb = peakEnergyAtFreq(buf, binWidth, s.freq);

    // If a lower confirmed string has a harmonic landing near this frequency,
    // require a stronger signal before counting this as independently ringing
    const harmonicSuspect = confirmedFundamentals.some(lower =>
      HARMONIC_RATIOS.some(ratio => Math.abs(lower.freq * ratio - s.freq) < FREQ_TOLERANCE_HZ)
    );
    const threshold = harmonicSuspect ? THRESHOLD_DB + HARMONIC_DB_BOOST : THRESHOLD_DB;

    const instantlyRinging = maxDb > threshold;
    const key = s.string;
    if (instantlyRinging) {
      mutedFrames[key] = 0;
      confirmedFundamentals.push(s);
    } else {
      mutedFrames[key] = (mutedFrames[key] ?? 0) + 1;
    }
    const ringing = instantlyRinging || (mutedFrames[key] < MUTE_FRAMES_REQUIRED);
    results.push({ ...s, status: ringing ? 'ringing' : 'muted', db: maxDb });
  }

  // Wrong note detection — exclude chord tones and their harmonics
  const chordFreqs = chordDef.strings.filter(s => !s.muted).map(s => s.freq);
  const wrongNotes = findSpectralPeaks(buf, binWidth).filter(peakFreq => {
    if (chordFreqs.some(cf => Math.abs(cf - peakFreq) <= FREQ_TOLERANCE_HZ * 2)) return false;
    if (chordFreqs.some(cf => HARMONIC_RATIOS.some(r => Math.abs(cf * r - peakFreq) < 15))) return false;
    return true;
  });

  const ringingCount = results.filter(r => r.status === 'ringing').length;
  const mutedCount = results.filter(r => r.status === 'muted').length;
  const expectedCount = chordDef.strings.filter(s => !s.muted).length;
  const correct = ringingCount === expectedCount && mutedCount === 0 && wrongNotes.length === 0;

  return { strings: results, wrongNotes, ringingCount, mutedCount, expectedCount, correct };
}

function findSpectralPeaks(buf, binWidth) {
  const peaks = [];
  // Only look in guitar range: 80Hz–1200Hz (covers harmonics too)
  const loIdx = Math.floor(80 / binWidth);
  const hiIdx = Math.ceil(1200 / binWidth);

  for (let i = loIdx + 1; i < hiIdx - 1; i++) {
    if (
      buf[i] > WRONG_NOTE_THRESHOLD_DB &&
      buf[i] > buf[i - 1] &&
      buf[i] > buf[i + 1]
    ) {
      peaks.push(i * binWidth);
    }
  }
  return peaks;
}

// Metronome — returns a stop function
export function startMetronome(bpm, onTick) {
  if (!audioCtx) return () => {};

  const interval = 60 / bpm; // seconds per beat
  let nextBeat = audioCtx.currentTime + 0.1;
  let beatIndex = 0;
  let running = true;

  function scheduleClick() {
    while (nextBeat < audioCtx.currentTime + 0.2) {
      // Click oscillator burst
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = beatIndex % 4 === 0 ? 1000 : 800;
      gain.gain.setValueAtTime(0.3, nextBeat);
      gain.gain.exponentialRampToValueAtTime(0.001, nextBeat + 0.08);
      osc.start(nextBeat);
      osc.stop(nextBeat + 0.1);

      const capturedBeat = nextBeat;
      const capturedIndex = beatIndex;
      setTimeout(() => {
        if (running) onTick(capturedIndex, capturedBeat);
      }, Math.max(0, (capturedBeat - audioCtx.currentTime) * 1000));

      nextBeat += interval;
      beatIndex++;
    }
  }

  const timer = setInterval(scheduleClick, 50);
  scheduleClick();

  return () => {
    running = false;
    clearInterval(timer);
  };
}
