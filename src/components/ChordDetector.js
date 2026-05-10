import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { CHORDS } from '../utils/chordDefs';
import { startAudio, stopAudio, analyseChord } from '../utils/audioAnalysis';

const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];

export default function ChordDetector() {
  const [listening, setListening] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  async function handleStart() {
    try {
      setError(null);
      await startAudio();
      setListening(true);
      intervalRef.current = setInterval(() => {
        const result = analyseChord(CHORDS.Em);
        if (result) setAnalysis(result);
      }, 100);
    } catch (e) {
      setError('Microphone access denied or unavailable.');
    }
  }

  function handleStop() {
    clearInterval(intervalRef.current);
    stopAudio();
    setListening(false);
    setAnalysis(null);
  }

  useEffect(() => () => { clearInterval(intervalRef.current); stopAudio(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>E Minor Chord Detector</Text>
      <Text style={styles.subtitle}>Play an E minor chord on your guitar</Text>

      <View style={styles.chordRow}>
        {STRING_LABELS.map((label, i) => {
          const str = analysis?.strings[i];
          const color = !str
            ? '#444'
            : str.status === 'ringing'
            ? '#4CAF50'
            : str.status === 'muted_expected'
            ? '#888'
            : '#F44336';

          return (
            <View key={label} style={styles.stringCol}>
              <Text style={styles.stringLabel}>String {label}</Text>
              <View style={[styles.circle, { backgroundColor: color }]} />
              <Text style={styles.noteLabel}>
                {CHORDS.Em.strings[i].note}
              </Text>
              <Text style={[styles.statusText, { color }]}>
                {!str ? '—' : str.status === 'ringing' ? '✓' : str.status === 'muted_expected' ? 'x' : 'muted'}
              </Text>
            </View>
          );
        })}
      </View>

      {analysis && (
        <View style={styles.feedback}>
          <Text style={[styles.verdict, { color: analysis.correct ? '#4CAF50' : '#F44336' }]}>
            {analysis.correct ? 'Chord correct!' : buildFeedback(analysis)}
          </Text>
          {analysis.wrongNotes.length > 0 && (
            <Text style={styles.wrongNote}>
              Unexpected notes detected: {analysis.wrongNotes.map(f => `${Math.round(f)}Hz`).join(', ')}
            </Text>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, listening && styles.buttonStop]}
        onPress={listening ? handleStop : handleStart}
      >
        <Text style={styles.buttonText}>{listening ? 'Stop' : 'Start Listening'}</Text>
      </TouchableOpacity>

      <View style={styles.legend}>
        <LegendItem color="#4CAF50" label="Ringing correctly" />
        <LegendItem color="#F44336" label="Muted (should ring)" />
        <LegendItem color="#888" label="Expected mute" />
      </View>
    </View>
  );
}

function buildFeedback(analysis) {
  const issues = [];
  const muted = analysis.strings.filter(s => s.status === 'muted');
  if (muted.length > 0) {
    issues.push(`String${muted.length > 1 ? 's' : ''} ${muted.map(s => s.string).join(', ')} muted`);
  }
  if (analysis.wrongNotes.length > 0) {
    issues.push('wrong notes detected');
  }
  return issues.length ? issues.join(' + ') : 'Keep strumming…';
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 20, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 32 },
  chordRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  stringCol: { alignItems: 'center', gap: 6 },
  stringLabel: { color: '#aaa', fontSize: 11 },
  circle: { width: 44, height: 44, borderRadius: 22 },
  noteLabel: { color: '#ddd', fontSize: 12, fontWeight: '600' },
  statusText: { fontSize: 11 },
  feedback: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, width: '100%', marginBottom: 20 },
  verdict: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  wrongNote: { color: '#ff9800', fontSize: 12, textAlign: 'center', marginTop: 6 },
  error: { color: '#F44336', marginBottom: 12 },
  button: {
    backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 30, marginBottom: 24,
  },
  buttonStop: { backgroundColor: '#F44336' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  legend: { gap: 8, alignSelf: 'flex-start' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: '#aaa', fontSize: 12 },
});
