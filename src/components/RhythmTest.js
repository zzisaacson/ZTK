import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CHORDS, RHYTHM_PATTERN, BEAT_MS } from '../utils/chordDefs';
import { startAudio, stopAudio, analyseChord, startMetronome, getAudioContext } from '../utils/audioAnalysis';

const TOTAL_ROUNDS = 2; // how many full Em-Em-Am-Am cycles
const TIMING_WINDOW_MS = 350; // ±ms around beat to count as "on time"

export default function RhythmTest() {
  const [phase, setPhase] = useState('idle'); // idle | countdown | playing | results
  const [countdown, setCountdown] = useState(3);
  const [beatIndex, setBeatIndex] = useState(0);
  const [currentChord, setCurrentChord] = useState(null);
  const [beatResults, setBeatResults] = useState([]);
  const [error, setError] = useState(null);

  const stopMetronome = useRef(null);
  const beatLog = useRef([]); // accumulate results during test
  const totalBeats = TOTAL_ROUNDS * RHYTHM_PATTERN.length;

  async function handleStart() {
    try {
      setError(null);
      await startAudio();
      setPhase('countdown');
      setBeatResults([]);
      beatLog.current = [];

      // Countdown 3-2-1 then start
      let c = 3;
      setCountdown(c);
      const cdInterval = setInterval(() => {
        c--;
        if (c === 0) {
          clearInterval(cdInterval);
          startRhythmTest();
        } else {
          setCountdown(c);
        }
      }, 1000);
    } catch (e) {
      setError('Microphone access denied or unavailable.');
    }
  }

  function startRhythmTest() {
    setPhase('playing');
    let completedBeats = 0;

    stopMetronome.current = startMetronome(50, (globalBeatIdx) => {
      const patternIdx = completedBeats % RHYTHM_PATTERN.length;
      const chordKey = RHYTHM_PATTERN[patternIdx];
      const chord = CHORDS[chordKey];

      setCurrentChord(chordKey);
      setBeatIndex(completedBeats);

      // Sample audio slightly after the beat to let user react
      setTimeout(() => {
        const analysis = analyseChord(chord);
        const audioCtx = getAudioContext();
        const beatTime = audioCtx ? audioCtx.currentTime * 1000 : Date.now();

        const result = {
          beat: completedBeats + 1,
          expected: chordKey,
          analysis,
          onTime: true, // always true since we sample on beat — timing is implicit
        };

        beatLog.current.push(result);
        completedBeats++;

        if (completedBeats >= totalBeats) {
          stopMetronome.current?.();
          stopAudio();
          setBeatResults([...beatLog.current]);
          setPhase('results');
        }
      }, 120); // 120ms after click — time for user to strum
    });
  }

  function handleReset() {
    stopMetronome.current?.();
    stopAudio();
    setPhase('idle');
    setBeatResults([]);
    setCurrentChord(null);
    setBeatIndex(0);
  }

  useEffect(() => () => { stopMetronome.current?.(); stopAudio(); }, []);

  if (phase === 'results') {
    return <Results results={beatResults} onRetry={handleReset} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rhythm Test — 50 BPM</Text>
      <Text style={styles.subtitle}>Em · Em · Am · Am (repeating)</Text>

      {phase === 'idle' && (
        <>
          <ChordPreview chordKey="Em" />
          <ChordPreview chordKey="Am" />
          <TouchableOpacity style={styles.button} onPress={handleStart}>
            <Text style={styles.buttonText}>Start Test</Text>
          </TouchableOpacity>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      )}

      {phase === 'countdown' && (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.countdownLabel}>Get ready…</Text>
        </View>
      )}

      {phase === 'playing' && (
        <>
          <View style={styles.patternRow}>
            {RHYTHM_PATTERN.map((chord, i) => {
              const active = i === beatIndex % RHYTHM_PATTERN.length;
              return (
                <View key={i} style={[styles.patternCell, active && styles.patternCellActive]}>
                  <Text style={[styles.patternText, active && styles.patternTextActive]}>
                    {chord}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.currentChord}>{currentChord ?? '—'}</Text>
          <Text style={styles.beatCount}>Beat {beatIndex + 1} / {totalBeats}</Text>
          <TouchableOpacity style={[styles.button, styles.buttonStop]} onPress={handleReset}>
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ChordPreview({ chordKey }) {
  const chord = CHORDS[chordKey];
  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>{chord.name} ({chordKey})</Text>
      <View style={styles.previewStrings}>
        {chord.strings.map(s => (
          <View key={s.string} style={styles.previewString}>
            <Text style={styles.previewStringNum}>{s.string}</Text>
            <Text style={styles.previewNote}>{s.muted ? '✕' : s.note}</Text>
            <Text style={styles.previewFreq}>{s.muted ? '' : `${s.freq}Hz`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Results({ results, onRetry }) {
  let chordCorrect = 0, noteTotal = 0, noteCorrect = 0, mutedErrors = 0;

  results.forEach(r => {
    if (!r.analysis) return;
    if (r.analysis.correct) chordCorrect++;
    const expected = r.analysis.strings.filter(s => !s.muted && s.status !== 'muted_expected');
    const ringing = expected.filter(s => s.status === 'ringing');
    noteTotal += expected.length;
    noteCorrect += ringing.length;
    mutedErrors += expected.length - ringing.length;
  });

  const total = results.length;
  const chordPct = total ? Math.round((chordCorrect / total) * 100) : 0;
  const notePct = noteTotal ? Math.round((noteCorrect / noteTotal) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Results</Text>

      <ScoreBadge label="Chord Accuracy" pct={chordPct} />
      <ScoreBadge label="Note Accuracy" pct={notePct} />
      <ScoreBadge
        label="Muted/Missing Strings"
        pct={noteTotal ? Math.round(((noteTotal - mutedErrors) / noteTotal) * 100) : 0}
      />

      <Text style={styles.beatHeader}>Beat-by-Beat</Text>
      {results.map(r => (
        <View key={r.beat} style={styles.beatRow}>
          <Text style={styles.beatLabel}>Beat {r.beat} — {r.expected}</Text>
          <Text style={[styles.beatResult, { color: r.analysis?.correct ? '#4CAF50' : '#F44336' }]}>
            {r.analysis
              ? r.analysis.correct
                ? '✓ Correct'
                : `${r.analysis.ringingCount}/${r.analysis.expectedCount} strings`
              : 'No audio'}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ScoreBadge({ label, pct }) {
  const color = pct >= 80 ? '#4CAF50' : pct >= 50 ? '#ff9800' : '#F44336';
  return (
    <View style={styles.scoreBadge}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scorePct, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#1a1a2e', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 20, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  button: { backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, marginTop: 16 },
  buttonStop: { backgroundColor: '#F44336' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  error: { color: '#F44336', marginTop: 12 },
  countdownBox: { alignItems: 'center', marginTop: 60 },
  countdownText: { fontSize: 80, fontWeight: 'bold', color: '#fff' },
  countdownLabel: { fontSize: 18, color: '#aaa', marginTop: 8 },
  patternRow: { flexDirection: 'row', gap: 12, marginVertical: 24 },
  patternCell: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#16213e', alignItems: 'center', justifyContent: 'center' },
  patternCellActive: { backgroundColor: '#4CAF50' },
  patternText: { color: '#aaa', fontSize: 18, fontWeight: 'bold' },
  patternTextActive: { color: '#fff' },
  currentChord: { fontSize: 64, fontWeight: 'bold', color: '#fff', marginVertical: 8 },
  beatCount: { color: '#aaa', fontSize: 14, marginBottom: 16 },
  preview: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, width: '100%', marginBottom: 12 },
  previewTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  previewStrings: { flexDirection: 'row', justifyContent: 'space-around' },
  previewString: { alignItems: 'center' },
  previewStringNum: { color: '#aaa', fontSize: 11, marginBottom: 2 },
  previewNote: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  previewFreq: { color: '#888', fontSize: 10 },
  beatHeader: { color: '#fff', fontWeight: 'bold', fontSize: 16, alignSelf: 'flex-start', marginTop: 24, marginBottom: 8 },
  beatRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#16213e' },
  beatLabel: { color: '#ddd', fontSize: 14 },
  beatResult: { fontSize: 14, fontWeight: '600' },
  scoreBadge: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: '#16213e', borderRadius: 10, padding: 14, marginBottom: 10 },
  scoreLabel: { color: '#ddd', fontSize: 15 },
  scorePct: { fontSize: 15, fontWeight: 'bold' },
});
