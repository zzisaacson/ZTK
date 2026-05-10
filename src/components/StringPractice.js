import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const EM = [
  { idx: 0, string: 6, label: "E", note: "E2", freq: 82.41, fret: null, wound: true, thickness: 3.2 },
  { idx: 1, string: 5, label: "A", note: "B2", freq: 123.47, fret: 2, wound: true, thickness: 2.6 },
  { idx: 2, string: 4, label: "D", note: "E3", freq: 164.81, fret: 2, wound: true, thickness: 2.1 },
  { idx: 3, string: 3, label: "G", note: "G3", freq: 196.0, fret: null, wound: false, thickness: 1.6 },
  { idx: 4, string: 2, label: "B", note: "B3", freq: 246.94, fret: null, wound: false, thickness: 1.2 },
  { idx: 5, string: 1, label: "e", note: "E4", freq: 329.63, fret: null, wound: false, thickness: 0.9 }
];

const NOTE_TOL = 18;
const CONF_NEED = 6;
const MIN_RMS = 0.012;
const BASE_DB = -54;
const HARM_BOOST = 10;
const HARM_RATIOS = [2, 3, 4];

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < MIN_RMS) return { frequency: -1, rms };
  let bestOff = -1;
  let bestCorr = 0;
  for (let off = 8; off < buffer.length / 2; off += 1) {
    let corr = 0;
    for (let i = 0; i < buffer.length / 2; i += 1) corr += Math.abs(buffer[i] - buffer[i + off]);
    corr = 1 - corr / (buffer.length / 2);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOff = off;
    }
  }
  if (bestOff === -1 || bestCorr < 0.82) return { frequency: -1, rms };
  return { frequency: sampleRate / bestOff, rms };
}

function fftChordStatus(analyser, sampleRate) {
  const buf = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(buf);
  const binW = sampleRate / analyser.fftSize;
  const tolerance = 12;
  const confirmed = [];
  const result = {};
  for (const stringDef of EM) {
    const center = Math.round(stringDef.freq / binW);
    const half = Math.ceil(tolerance / binW);
    let maxDb = -Infinity;
    for (let i = Math.max(0, center - half); i <= Math.min(buf.length - 1, center + half); i += 1) {
      if (buf[i] > maxDb) maxDb = buf[i];
    }
    const suspect = confirmed.some((f) => HARM_RATIOS.some((r) => Math.abs(f * r - stringDef.freq) < tolerance));
    const thresh = suspect ? BASE_DB + HARM_BOOST : BASE_DB;
    const ringing = maxDb > thresh;
    if (ringing) confirmed.push(stringDef.freq);
    result[stringDef.string] = ringing;
  }
  return result;
}

export default function StringPractice({ onBack }) {
  const [phase, setPhase] = useState("idle");
  const [curIdx, setCurIdx] = useState(0);
  const [confCount, setConfCount] = useState(0);
  const [doneMask, setDoneMask] = useState([]);
  const [chordStatus, setChordStatus] = useState({});
  const [okFrames, setOkFrames] = useState(0);
  const [micErr, setMicErr] = useState("");

  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const pollRef = useRef(null);
  const confRef = useRef(0);
  const idxRef = useRef(0);
  const phaseRef = useRef("strings");
  const okRef = useRef(0);

  async function startMic() {
    setMicErr("");
    try {
      if (Platform.OS === "web") {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setMicErr("Microphone not supported in this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        streamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      } else {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          setMicErr("Microphone permission denied.");
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        setMicErr("Live detection works on web. Native support coming soon.");
      }
      idxRef.current = 0;
      confRef.current = 0;
      phaseRef.current = "strings";
      okRef.current = 0;
      setPhase("strings");
      setCurIdx(0);
      setConfCount(0);
      setDoneMask([]);
      setChordStatus({});
      setOkFrames(0);
      beginPolling();
    } catch (error) {
      setMicErr(error.message || "Failed to start microphone.");
    }
  }

  function beginPolling() {
    pollRef.current = setInterval(() => {
      const analyser = analyserRef.current;
      const ctx = ctxRef.current;
      if (!analyser || !ctx) return;

      if (phaseRef.current === "strings") {
        const tbuf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(tbuf);
        const { frequency, rms } = autoCorrelate(tbuf, ctx.sampleRate);
        const target = EM[idxRef.current];
        const hit = rms >= MIN_RMS && frequency > 0 && Math.abs(frequency - target.freq) <= NOTE_TOL;
        confRef.current = hit
          ? Math.min(confRef.current + 1, CONF_NEED + 2)
          : Math.max(confRef.current - 1, 0);
        setConfCount(confRef.current);

        if (confRef.current >= CONF_NEED) {
          const doneIdx = idxRef.current;
          const nextIdx = doneIdx + 1;
          setDoneMask((prev) => [...prev, doneIdx]);
          confRef.current = 0;
          setConfCount(0);
          if (nextIdx >= EM.length) {
            phaseRef.current = "chord";
            setPhase("chord");
            okRef.current = 0;
          } else {
            idxRef.current = nextIdx;
            setCurIdx(nextIdx);
          }
        }
      } else if (phaseRef.current === "chord") {
        const status = fftChordStatus(analyser, ctx.sampleRate);
        setChordStatus(status);
        const allOk = EM.every((s) => status[s.string]);
        if (allOk) {
          okRef.current += 1;
          setOkFrames(okRef.current);
          if (okRef.current >= 4) {
            phaseRef.current = "done";
            setPhase("done");
          }
        } else {
          okRef.current = 0;
          setOkFrames(0);
        }
      }
    }, 55);
  }

  function stopMic() {
    clearInterval(pollRef.current);
    pollRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (streamRef.current?.getTracks) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
  }

  function reset() {
    stopMic();
    setPhase("idle");
    setCurIdx(0);
    setConfCount(0);
    setDoneMask([]);
    setChordStatus({});
    setOkFrames(0);
    setMicErr("");
    confRef.current = 0;
    idxRef.current = 0;
    phaseRef.current = "strings";
    okRef.current = 0;
  }

  useEffect(() => () => stopMic(), []);

  const inStrings = phase === "strings";
  const inChord = phase === "chord";
  const isDone = phase === "done";
  const curStr = EM[curIdx];
  const progress = Math.min(confCount / CONF_NEED, 1);

  return (
    <View style={sp.container}>
      <View style={sp.header}>
        <Pressable onPress={() => { stopMic(); onBack(); }} style={sp.backBtn}>
          <Text style={sp.backText}>← Back</Text>
        </Pressable>
        <Text style={sp.headerTitle}>
          {phase === "idle"
            ? "String Practice"
            : inStrings
              ? `String ${curIdx + 1} of 6`
              : inChord
                ? "Strum Full Chord"
                : "Complete! 🎸"}
        </Text>
      </View>

      <Text style={sp.instruction}>
        {phase === "idle" && "Pluck each E minor string one at a time, then strum the full chord."}
        {inStrings && `Pluck the ${curStr.label} string (${curStr.note})${curStr.fret ? ` — fret ${curStr.fret}` : " — open string"}`}
        {inChord && "Now strum all 6 strings at once!"}
        {isDone && "All strings ringing — beautiful Em chord!"}
      </Text>

      <View style={sp.stringsWrap}>
        {EM.map((s, i) => {
          const done = doneMask.includes(i);
          const current = inStrings && i === curIdx;
          const pending = inStrings && i > curIdx;
          const chordOn = inChord || isDone;
          const ringing = chordOn && chordStatus[s.string];
          const muted = chordOn && !chordStatus[s.string];

          const dotColor = done && !chordOn ? "#2FBF71" : current ? "#F7DB75" : ringing ? "#2FBF71" : muted ? "#C14953" : "#555";
          const rowBg = current ? "#1e1c00" : ringing ? "#062210" : muted ? "#200a0a" : "transparent";

          return (
            <View key={s.string} style={[sp.stringRow, { backgroundColor: rowBg }]}>
              <View style={[sp.labelBox, { borderColor: dotColor }]}>
                <Text style={[sp.labelText, { color: dotColor }]}>{s.label}</Text>
              </View>

              <View style={sp.trackWrap}>
                <View
                  style={[
                    sp.wire,
                    {
                      height: s.thickness,
                      backgroundColor: s.wound ? "#c4913a" : "#d8d8d8",
                      opacity: pending ? 0.2 : 1
                    }
                  ]}
                />
                {s.fret != null && (
                  <View style={sp.fretBox}>
                    <Text style={sp.fretText}>fret {s.fret}</Text>
                  </View>
                )}
                {current && progress > 0 && <View style={[sp.progFill, { width: `${progress * 100}%` }]} />}
              </View>

              <View style={[sp.statusDot, { backgroundColor: dotColor }]}>
                {((done && !chordOn) || ringing) ? <Text style={sp.statusIcon}>✓</Text> : null}
                {muted ? <Text style={sp.statusIcon}>✕</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      {(inStrings || inChord) && (
        <View style={sp.barWrap}>
          <View
            style={[
              sp.barFill,
              {
                width: `${inStrings ? progress * 100 : Math.min(okFrames / 4, 1) * 100}%`,
                backgroundColor: inChord ? "#2FBF71" : "#F7DB75"
              }
            ]}
          />
        </View>
      )}

      {!!micErr && <Text style={sp.errText}>{micErr}</Text>}

      {phase === "idle" && (
        <Pressable style={sp.primaryBtn} onPress={startMic}>
          <Text style={sp.primaryBtnText}>Start — Enable Mic</Text>
        </Pressable>
      )}
      {isDone && (
        <Pressable style={sp.primaryBtn} onPress={reset}>
          <Text style={sp.primaryBtnText}>Try Again</Text>
        </Pressable>
      )}

      {(inChord || isDone) && (
        <View style={sp.legend}>
          <View style={sp.legendItem}>
            <View style={[sp.legendDot, { backgroundColor: "#2FBF71" }]} />
            <Text style={sp.legendText}>Ringing</Text>
          </View>
          <View style={sp.legendItem}>
            <View style={[sp.legendDot, { backgroundColor: "#C14953" }]} />
            <Text style={sp.legendText}>Muted / missing</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const sp = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", paddingHorizontal: 16, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10 },
  backBtn: { borderColor: "#987D30", borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  backText: { color: "#F7DB75", fontWeight: "600" },
  headerTitle: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 17 },
  instruction: { color: "#ADADAD", marginTop: 12, marginBottom: 16, fontSize: 14, lineHeight: 20 },

  stringsWrap: { gap: 6 },
  stringRow: { flexDirection: "row", alignItems: "center", height: 48, borderRadius: 10, paddingHorizontal: 8, gap: 8 },
  labelBox: { width: 28, height: 28, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  labelText: { fontWeight: "800", fontSize: 13 },
  trackWrap: { flex: 1, height: 48, justifyContent: "center", position: "relative" },
  wire: { position: "absolute", left: 0, right: 0, borderRadius: 2 },
  fretBox: {
    position: "absolute",
    right: 0,
    backgroundColor: "#2a1c0a",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#987D30"
  },
  fretText: { color: "#987D30", fontSize: 10, fontWeight: "600" },
  progFill: { position: "absolute", left: 0, top: "28%", height: "44%", backgroundColor: "#F7DB7566", borderRadius: 2 },
  statusDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statusIcon: { color: "#000", fontWeight: "900", fontSize: 11 },

  barWrap: { height: 8, backgroundColor: "#2a2a2a", borderRadius: 4, marginTop: 16, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },

  errText: { color: "#FF8A80", marginTop: 10, fontSize: 13 },
  primaryBtn: { marginTop: 20, backgroundColor: "#F7DB75", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },

  legend: { flexDirection: "row", gap: 16, marginTop: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#999", fontSize: 12 }
});
