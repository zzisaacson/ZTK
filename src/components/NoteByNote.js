import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { startAudio, stopAudio, detectPitch, getAudioContext } from '../utils/audioAnalysis';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CONFIRM_FRAMES = 6;    // consecutive detections needed (~480ms at 80ms poll)
const NOTE_TOLERANCE_HZ = 15;

const EM_NOTES = [
  { string: 6, note: 'E2', freq: 82.41,  fret: 'Open',     stringLabel: 'Low E string',  finger: null },
  { string: 5, note: 'B2', freq: 123.47, fret: '2nd fret',  stringLabel: 'A string',      finger: 'Ring finger' },
  { string: 4, note: 'E3', freq: 164.81, fret: '2nd fret',  stringLabel: 'D string',      finger: 'Middle finger' },
  { string: 3, note: 'G3', freq: 196.00, fret: 'Open',     stringLabel: 'G string',      finger: null },
  { string: 2, note: 'B3', freq: 246.94, fret: 'Open',     stringLabel: 'B string',      finger: null },
  { string: 1, note: 'E4', freq: 329.63, fret: 'Open',     stringLabel: 'High E string', finger: null },
];

const CONFETTI_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#FFD700', '#00BCD4'];

// ─── Audio feedback ───────────────────────────────────────────────────────────

function playChime(freq = 880) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

function playFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti({ active }) {
  const particles = useRef(
    Array.from({ length: 28 }, () => ({
      x: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 8 + Math.random() * 9,
      delay: Math.random() * 600,
      anim: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    particles.forEach(p => {
      p.anim.setValue(0);
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 1800 + Math.random() * 1200,
        delay: p.delay,
        useNativeDriver: false,
      }).start();
    });
  }, [active]);

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.size / 4,
            top: p.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H * 0.9] }),
            opacity: p.anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [{
              rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }),
            }],
          }}
        />
      ))}
    </View>
  );
}

// ─── String diagram ───────────────────────────────────────────────────────────

function StringDiagram({ activeString }) {
  return (
    <View style={diag.row}>
      {EM_NOTES.map(n => {
        const isActive = n.string === activeString;
        return (
          <View key={n.string} style={diag.col}>
            <View style={[diag.string, isActive && diag.stringActive]} />
            <View style={[diag.dot, isActive && diag.dotActive]} />
          </View>
        );
      })}
    </View>
  );
}

const diag = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: 32, marginVertical: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  string: { width: 2, flex: 1, backgroundColor: '#444', borderRadius: 1 },
  stringActive: { backgroundColor: '#4CAF50', width: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#333', marginTop: 2 },
  dotActive: { backgroundColor: '#4CAF50', width: 14, height: 14, borderRadius: 7 },
});

// ─── Confirmation ring ────────────────────────────────────────────────────────

function ConfirmRing({ progress, noteName, isCorrect }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCorrect) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true, speed: 30 }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20 }),
      ]).start();
    }
  }, [isCorrect]);

  const borderColor = isCorrect
    ? '#4CAF50'
    : progress > 0.5
    ? '#ffb300'
    : progress > 0
    ? '#2196F3'
    : '#2a2a3e';

  return (
    <Animated.View style={[ring.outer, { borderColor, transform: [{ scale: scaleAnim }] }]}>
      <Text style={[ring.note, isCorrect && { color: '#4CAF50' }]}>{noteName}</Text>
      {progress > 0 && !isCorrect && (
        <Text style={ring.pct}>{Math.round(progress * 100)}%</Text>
      )}
      {isCorrect && <Text style={ring.check}>✓</Text>}
    </Animated.View>
  );
}

const ring = StyleSheet.create({
  outer: {
    width: 148, height: 148, borderRadius: 74, borderWidth: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16213e',
  },
  note: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  pct:  { fontSize: 13, color: '#aaa', marginTop: 2 },
  check: { fontSize: 28, color: '#4CAF50', marginTop: 2 },
});

// ─── Celebration screen ───────────────────────────────────────────────────────

function Celebration({ onRetry }) {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 6 }),
      Animated.timing(fadeIn, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();
    playFanfare();
  }, []);

  return (
    <View style={cel.container}>
      <Confetti active />
      <Animated.View style={[cel.badge, { transform: [{ scale: badgeScale }] }]}>
        <Text style={cel.badgeIcon}>🎸</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
        <Text style={cel.congrats}>Congratulations!</Text>

        <View style={cel.achievementCard}>
          <Text style={cel.achievementIcon}>🏆</Text>
          <View style={cel.achievementText}>
            <Text style={cel.achievementTitle}>First Chord!</Text>
            <Text style={cel.achievementSub}>E Minor unlocked</Text>
          </View>
          <View style={cel.xpBadge}>
            <Text style={cel.xpText}>+50 XP</Text>
          </View>
        </View>

        <Text style={cel.message}>
          You've learned all 6 notes of the E minor chord.{'\n'}
          Now try strumming them all together!
        </Text>

        <TouchableOpacity style={cel.button} onPress={onRetry}>
          <Text style={cel.buttonText}>Play Again</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const cel = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, shadowColor: '#FFD700', shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
  },
  badgeIcon: { fontSize: 52 },
  congrats: { fontSize: 30, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  achievementCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16213e', borderRadius: 14, padding: 16,
    width: '100%', marginBottom: 20, gap: 12,
    borderWidth: 1, borderColor: '#FFD700',
  },
  achievementIcon: { fontSize: 28 },
  achievementText: { flex: 1 },
  achievementTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 17 },
  achievementSub:   { color: '#aaa', fontSize: 13 },
  xpBadge: {
    backgroundColor: '#4CAF50', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  xpText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  message: { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  button: {
    backgroundColor: '#4CAF50', paddingVertical: 14,
    paddingHorizontal: 48, borderRadius: 30,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function NoteByNote() {
  const [phase, setPhase] = useState('intro');       // intro | playing | celebration
  const [noteIdx, setNoteIdx] = useState(0);
  const [confirmCount, setConfirmCount] = useState(0);
  const [noteComplete, setNoteComplete] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const noteIdxRef = useRef(0);
  const confirmRef = useRef(0);
  const completeRef = useRef(false);

  const progress = confirmCount / CONFIRM_FRAMES;
  const currentNote = EM_NOTES[noteIdx];

  async function handleStart() {
    try {
      setError(null);
      await startAudio();
      setPhase('playing');
      startPolling();
    } catch (e) {
      setError('Microphone access denied or unavailable.');
    }
  }

  function startPolling() {
    intervalRef.current = setInterval(() => {
      if (completeRef.current) return;
      const freq = detectPitch();
      const target = EM_NOTES[noteIdxRef.current];
      const hit = freq && Math.abs(freq - target.freq) <= NOTE_TOLERANCE_HZ;

      if (hit) {
        confirmRef.current += 1;
        setConfirmCount(confirmRef.current);

        if (confirmRef.current >= CONFIRM_FRAMES) {
          completeRef.current = true;
          setNoteComplete(true);
          playChime(target.freq * 2);

          setTimeout(() => {
            const next = noteIdxRef.current + 1;
            if (next >= EM_NOTES.length) {
              clearInterval(intervalRef.current);
              stopAudio();
              setPhase('celebration');
            } else {
              noteIdxRef.current = next;
              confirmRef.current = 0;
              completeRef.current = false;
              setNoteIdx(next);
              setConfirmCount(0);
              setNoteComplete(false);
            }
          }, 600);
        }
      } else {
        // decay on miss but don't snap to zero — feels more forgiving
        confirmRef.current = Math.max(0, confirmRef.current - 1);
        setConfirmCount(confirmRef.current);
      }
    }, 80);
  }

  function handleReset() {
    clearInterval(intervalRef.current);
    stopAudio();
    noteIdxRef.current = 0;
    confirmRef.current = 0;
    completeRef.current = false;
    setPhase('intro');
    setNoteIdx(0);
    setConfirmCount(0);
    setNoteComplete(false);
  }

  useEffect(() => () => { clearInterval(intervalRef.current); stopAudio(); }, []);

  if (phase === 'celebration') return <Celebration onRetry={handleReset} />;

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      {phase === 'playing' && (
        <View style={styles.dotsRow}>
          {EM_NOTES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < noteIdx  && styles.dotDone,
                i === noteIdx && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {phase === 'intro' && (
        <View style={styles.intro}>
          <Text style={styles.introIcon}>🎸</Text>
          <Text style={styles.title}>Learn E Minor</Text>
          <Text style={styles.subtitle}>
            We'll guide you through each of the 6 notes in the E minor chord, one at a time.
          </Text>
          <Text style={styles.hint}>Hold each note until the ring fills — then move to the next.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleStart}>
            <Text style={styles.buttonText}>Let's Go!</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'playing' && (
        <>
          <Text style={styles.stepLabel}>Note {noteIdx + 1} of {EM_NOTES.length}</Text>

          <ConfirmRing
            progress={progress}
            noteName={currentNote.note}
            isCorrect={noteComplete}
          />

          <View style={styles.card}>
            <Text style={styles.cardStringLabel}>{currentNote.stringLabel}</Text>
            <StringDiagram activeString={currentNote.string} />
            <View style={styles.cardRow}>
              <View style={styles.cardPill}>
                <Text style={styles.cardPillText}>
                  {currentNote.fret === 'Open' ? '○ Open' : `● ${currentNote.fret}`}
                </Text>
              </View>
              {currentNote.finger && (
                <View style={[styles.cardPill, styles.cardPillBlue]}>
                  <Text style={styles.cardPillText}>{currentNote.finger}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Hold bar */}
          <View style={styles.holdBar}>
            <View style={[styles.holdFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.holdLabel}>
            {noteComplete ? '✓ Got it!' : progress > 0 ? 'Keep holding…' : 'Play the note'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#1a1a2e',
    alignItems: 'center', padding: 24, paddingTop: 16,
  },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#2a2a3e', borderWidth: 2, borderColor: '#444',
  },
  dotDone:   { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  dotActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },

  stepLabel: { color: '#aaa', fontSize: 13, marginBottom: 20 },

  card: {
    backgroundColor: '#16213e', borderRadius: 16, padding: 18,
    width: '100%', marginTop: 24, alignItems: 'center',
  },
  cardStringLabel: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  cardRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cardPill: {
    backgroundColor: '#0f3460', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  cardPillBlue: { backgroundColor: '#1a4a7a' },
  cardPillText: { color: '#ddd', fontSize: 13, fontWeight: '600' },

  holdBar: {
    width: '100%', height: 10, backgroundColor: '#16213e',
    borderRadius: 5, overflow: 'hidden', marginTop: 28,
  },
  holdFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 5 },
  holdLabel: { color: '#aaa', fontSize: 13, marginTop: 8 },

  // Intro
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  introIcon: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  hint: { color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 280 },
  button: {
    backgroundColor: '#4CAF50', paddingVertical: 14,
    paddingHorizontal: 48, borderRadius: 30, marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#F44336' },
});
