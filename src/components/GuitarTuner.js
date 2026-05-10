import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { startAudio, stopAudio, detectPitch } from '../utils/audioAnalysis';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const GUITAR_STRINGS = [
  { string: 6, note: 'E', freq: 82.41,  thickness: 4,   color: '#c4913a', woundColor: '#a87830' },
  { string: 5, note: 'A', freq: 110.00, thickness: 3.5, color: '#c9a050', woundColor: '#b08840' },
  { string: 4, note: 'D', freq: 146.83, thickness: 3,   color: '#d4b060', woundColor: '#b89848' },
  { string: 3, note: 'G', freq: 196.00, thickness: 2,   color: '#d0d0d0', woundColor: '#b0b0b0' },
  { string: 2, note: 'B', freq: 246.94, thickness: 1.5, color: '#e0e0e0', woundColor: '#c0c0c0' },
  { string: 1, note: 'E', freq: 329.63, thickness: 1,   color: '#f0f0f0', woundColor: '#d8d8d8' },
];

const NECK_FRETS = 5;
const FRET_H = 36;
const NUT_H = 10;
const ABOVE_NUT_H = 88; // room for labels + pegs + string section above nut
const NECK_TOTAL_H = ABOVE_NUT_H + NUT_H + FRET_H * NECK_FRETS;

// Fret dot positions: which frets get a position marker
const FRET_DOTS = [3, 5];

function freqToNoteInfo(freq) {
  if (!freq) return null;
  const noteNum = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(noteNum);
  const cents = Math.round((noteNum - rounded) * 100);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  return { name, cents };
}

function nearestString(freq) {
  if (!freq) return null;
  let best = null, bestDist = Infinity;
  for (const s of GUITAR_STRINGS) {
    const dist = Math.abs(freq - s.freq);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  return bestDist / best.freq < 0.06 ? best : null;
}

// ─── Guitar Neck ─────────────────────────────────────────────────────────────

function GuitarNeck({ activeString, tuneColor }) {
  return (
    <View style={neck.wrapper}>
      {/* Column layout: one column per string */}
      <View style={[neck.columnsContainer, { height: NECK_TOTAL_H }]}>
        {GUITAR_STRINGS.map(s => {
          const isActive = activeString?.string === s.string;
          const activeCol = isActive ? tuneColor : null;

          return (
            <View key={s.string} style={neck.col}>
              {/* Note label */}
              <Text style={[neck.noteLabel, isActive && { color: activeCol, fontWeight: 'bold' }]}>
                {s.note}
              </Text>

              {/* Tuning peg */}
              <View style={[neck.peg, isActive && { backgroundColor: activeCol, borderColor: activeCol }]} />

              {/* String above nut */}
              <View style={[neck.stringAbove, { width: s.thickness, backgroundColor: isActive ? activeCol : s.color }]} />

              {/* Nut section (the string passes through here, nut drawn below as overlay) */}
              <View style={[neck.stringNut, { width: s.thickness + 1, backgroundColor: isActive ? activeCol : s.color }]} />

              {/* String on fretboard */}
              <View style={[
                neck.stringFret,
                { width: s.thickness, backgroundColor: isActive ? activeCol : s.color },
              ]} />
            </View>
          );
        })}

        {/* Fretboard background (drawn as absolute overlay, behind strings) */}
        <View style={neck.fretboard} pointerEvents="none">
          {/* Nut */}
          <View style={neck.nut} />

          {/* Fret lines */}
          {Array.from({ length: NECK_FRETS }, (_, i) => (
            <View
              key={i}
              style={[neck.fretLine, { top: NUT_H + (i + 1) * FRET_H - 1 }]}
            />
          ))}

          {/* Fret dot markers */}
          {FRET_DOTS.map(fret => (
            fret <= NECK_FRETS && (
              <View
                key={fret}
                style={[neck.fretDot, { top: NUT_H + (fret - 0.5) * FRET_H - 6 }]}
              />
            )
          ))}
        </View>
      </View>

      {/* String number labels below neck */}
      <View style={neck.stringNumRow}>
        {GUITAR_STRINGS.map(s => (
          <Text key={s.string} style={neck.stringNum}>{s.string}</Text>
        ))}
      </View>
    </View>
  );
}

const neck = StyleSheet.create({
  wrapper: { width: '100%', maxWidth: 360, alignItems: 'stretch', marginBottom: 20 },
  columnsContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  noteLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    height: 18,
    lineHeight: 18,
  },
  peg: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2a2a3a',
    borderWidth: 2,
    borderColor: '#555',
    marginVertical: 5,
  },
  stringAbove: {
    height: 28,
    borderRadius: 1,
  },
  stringNut: {
    height: NUT_H,
    borderRadius: 1,
  },
  stringFret: {
    flex: 1,
    borderRadius: 1,
    opacity: 0.9,
  },
  fretboard: {
    position: 'absolute',
    top: ABOVE_NUT_H,
    left: 0,
    right: 0,
    height: NUT_H + FRET_H * NECK_FRETS,
    backgroundColor: '#1c0e05',
    borderRadius: 4,
    zIndex: -1,
  },
  nut: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NUT_H,
    backgroundColor: '#e8d5a0',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  fretLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#8a7a6a',
    borderRadius: 1,
  },
  fretDot: {
    position: 'absolute',
    alignSelf: 'center',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4a3828',
    left: '50%',
    marginLeft: -6,
  },
  stringNumRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  stringNum: {
    flex: 1,
    textAlign: 'center',
    color: '#555',
    fontSize: 11,
  },
});

// ─── Main Tuner ───────────────────────────────────────────────────────────────

export default function GuitarTuner() {
  const [listening, setListening] = useState(false);
  const [noteInfo, setNoteInfo] = useState(null);
  const [nearest, setNearest] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  async function handleStart() {
    try {
      setError(null);
      await startAudio();
      setListening(true);
      intervalRef.current = setInterval(() => {
        const freq = detectPitch();
        const info = freqToNoteInfo(freq);
        setNoteInfo(info);
        setNearest(nearestString(freq));
        const targetValue = info ? Math.max(-1, Math.min(1, info.cents / 50)) : 0;
        Animated.spring(indicatorAnim, {
          toValue: targetValue,
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }).start();
      }, 80);
    } catch (e) {
      setError('Microphone access denied or unavailable.');
    }
  }

  function handleStop() {
    clearInterval(intervalRef.current);
    stopAudio();
    setListening(false);
    setNoteInfo(null);
    setNearest(null);
    indicatorAnim.setValue(0);
  }

  useEffect(() => () => { clearInterval(intervalRef.current); stopAudio(); }, []);

  const inTune  = noteInfo && Math.abs(noteInfo.cents) <= 5;
  const close   = noteInfo && Math.abs(noteInfo.cents) <= 15;
  const dotColor = inTune ? '#4CAF50' : close ? '#ffb300' : '#F44336';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guitar Tuner</Text>

      <GuitarNeck activeString={nearest} tuneColor={dotColor} />

      {/* Note display */}
      <View style={styles.noteBox}>
        <Text style={[styles.noteName, { color: noteInfo ? dotColor : '#333' }]}>
          {noteInfo?.name ?? '—'}
        </Text>
        {noteInfo && (
          <Text style={[styles.centsText, { color: dotColor }]}>
            {noteInfo.cents === 0
              ? 'In tune'
              : noteInfo.cents > 0
              ? `+${noteInfo.cents}¢ sharp`
              : `${noteInfo.cents}¢ flat`}
          </Text>
        )}
      </View>

      {/* Indicator track */}
      <View style={styles.trackWrapper}>
        <Text style={styles.trackLabel}>♭</Text>
        <View style={styles.track}>
          <View style={[styles.zone, { left: 0,     width: '35%', backgroundColor: '#F4433633' }]} />
          <View style={[styles.zone, { left: '35%', width: '15%', backgroundColor: '#ffb30055' }]} />
          <View style={[styles.zone, { left: '45%', width: '10%', backgroundColor: '#4CAF5066' }]} />
          <View style={[styles.zone, { left: '55%', width: '10%', backgroundColor: '#4CAF5066' }]} />
          <View style={[styles.zone, { left: '65%', width: '15%', backgroundColor: '#ffb30055' }]} />
          <View style={[styles.zone, { left: '80%', width: '20%', backgroundColor: '#F4433633' }]} />
          <View style={styles.centreTick} />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor },
              {
                left: indicatorAnim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['5%', '95%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.trackLabel}>♯</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, listening && styles.buttonStop]}
        onPress={listening ? handleStop : handleStart}
      >
        <Text style={styles.buttonText}>{listening ? 'Stop' : 'Start Tuner'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Play one string at a time</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  noteBox: { alignItems: 'center', height: 80, justifyContent: 'center', marginBottom: 20 },
  noteName: { fontSize: 64, fontWeight: 'bold', lineHeight: 70 },
  centsText: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  trackWrapper: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, marginBottom: 24 },
  trackLabel: { color: '#aaa', fontSize: 20, width: 20, textAlign: 'center' },
  track: {
    flex: 1, height: 40, backgroundColor: '#16213e',
    borderRadius: 20, overflow: 'hidden', justifyContent: 'center',
  },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  centreTick: {
    position: 'absolute', left: '50%', top: 6, bottom: 6,
    width: 2, backgroundColor: '#ffffff88', marginLeft: -1,
  },
  dot: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    marginLeft: -14, top: 6,
  },
  button: {
    backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 30, marginBottom: 10,
  },
  buttonStop: { backgroundColor: '#F44336' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hint: { color: '#555', fontSize: 13 },
  error: { color: '#F44336', marginBottom: 12 },
});
