import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import lessonData from "./src/data/lessons/em_am_test.json";

const COLORS = {
  softGold: "#F7DB75",
  bronzeOlive: "#987D30",
  darkGray: "#4F4F4F",
  white: "#FFFFFF",
  black: "#000000",
  bg: "#121212"
};

const PERFECT_WINDOW = 0.09;
const GOOD_WINDOW = 0.22;
const MISS_WINDOW = 0.35;
const PIXELS_PER_SECOND = 120;
const MIN_RMS = 0.015;

const LESSON = {
  id: lessonData.id,
  title: lessonData.title,
  bpm: lessonData.bpm,
  durationSeconds: lessonData.durationSeconds,
  sourceMidi: lessonData.sourceMidi,
  targets: lessonData.targets
};

function classifyHit(deltaSeconds, expected, played) {
  const expectedPitchClasses = [...new Set(expected.map((note) => note % 12))];
  const playedPitchClasses = [...new Set(played.map((note) => note % 12))];
  const overlapCount = expectedPitchClasses.filter((pc) => playedPitchClasses.includes(pc)).length;
  const coverage = overlapCount / Math.max(1, expectedPitchClasses.length);

  if (coverage >= 0.66 && deltaSeconds <= PERFECT_WINDOW) {
    return "perfect";
  }

  if (deltaSeconds <= GOOD_WINDOW && coverage >= 0.34) {
    return "good";
  }

  return "miss";
}

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < MIN_RMS) {
    return { frequency: -1, rms };
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  for (let offset = 8; offset < buffer.length / 2; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < buffer.length / 2; i += 1) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / (buffer.length / 2);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1 || bestCorrelation < 0.82) {
    return { frequency: -1, rms };
  }
  return { frequency: sampleRate / bestOffset, rms };
}

function frequencyToMidi(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  if (midi < 28 || midi > 88) {
    return null;
  }
  return midi;
}

function midiToNoteName(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function scoreForLabel(label) {
  if (label === "perfect") {
    return 3;
  }
  if (label === "good") {
    return 1;
  }
  return 0;
}

function getTargetLabel(target) {
  const unique = [...new Set(target.noteNames)];
  if (unique.join(",") === "E2,B2,E3,G3,B3,E4") {
    return "Em";
  }
  if (unique.join(",") === "A2,E3,A3,C4,E4") {
    return "Am";
  }
  return unique.slice(0, 3).join(" ");
}

function LandingScreen({ onStart }) {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Animated.Image
            source={require("./context/Zero To Kumziz_ final project files 3/Logo Design/TRANSPARENT/PNG/Logo/Logo-01.png")}
            resizeMode="contain"
            style={styles.logo}
          />
        </View>
        <Text style={styles.title}>Zero To Kumziz</Text>
        <Text style={styles.subtitle}>Play along, hit the target, earn your score.</Text>
      </View>

      <View style={styles.lessonCard}>
        <Text style={styles.lessonCardTitle}>{LESSON.title}</Text>
        <Text style={styles.lessonCardMeta}>MIDI: {LESSON.sourceMidi}</Text>
        <Text style={styles.lessonCardMeta}>
          {LESSON.targets.length} targets at {LESSON.bpm} BPM
        </Text>
        <Pressable onPress={onStart} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start Lesson</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LessonScreen({ onBack }) {
  const { width } = useWindowDimensions();
  const targetX = Math.max(140, width * 0.3);
  const [isRunning, setRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastJudgement, setLastJudgement] = useState(null);
  const [metronomeBpm, setMetronomeBpm] = useState(LESSON.bpm);
  const [judgements, setJudgements] = useState({});
  const [pulse] = useState(new Animated.Value(1));
  const [micStatus, setMicStatus] = useState("idle");
  const [micError, setMicError] = useState("");
  const [liveDetectedNote, setLiveDetectedNote] = useState("none");
  const webStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analysisTimerRef = useRef(null);
  const nativeRecordingRef = useRef(null);
  const evaluatePlayedNotesRef = useRef(() => {});

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const startedAt = Date.now() - currentTime * 1000;
    const timer = setInterval(() => {
      setCurrentTime(Math.min((Date.now() - startedAt) / 1000, LESSON.durationSeconds));
    }, 40);
    return () => clearInterval(timer);
  }, [isRunning, currentTime]);

  useEffect(() => {
    const beatMs = Math.max(250, (60 / metronomeBpm) * 1000);
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 90, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 130, useNativeDriver: true })
      ]).start();
    }, beatMs);
    return () => clearInterval(timer);
  }, [metronomeBpm, pulse]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    setJudgements((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const target of LESSON.targets) {
        if (!next[target.id] && currentTime > target.time + MISS_WINDOW) {
          next[target.id] = { result: "miss", delta: null };
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [currentTime, isRunning]);

  useEffect(() => {
    return () => {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
      }
      if (nativeRecordingRef.current) {
        nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
        nativeRecordingRef.current = null;
      }
    };
  }, []);

  const stats = useMemo(() => {
    const values = Object.values(judgements);
    const perfect = values.filter((v) => v.result === "perfect").length;
    const good = values.filter((v) => v.result === "good").length;
    const miss = values.filter((v) => v.result === "miss").length;
    const score = values.reduce((total, item) => total + scoreForLabel(item.result), 0);
    return { perfect, good, miss, score, judged: values.length };
  }, [judgements]);

  function evaluatePlayedNotes(playedMidiNotes) {
    const upcoming = LESSON.targets.filter((target) => !judgements[target.id]);
    const nearest = upcoming.reduce(
      (best, target) => {
        const delta = Math.abs(currentTime - target.time);
        if (delta < best.delta) {
          return { target, delta };
        }
        return best;
      },
      { target: null, delta: Number.POSITIVE_INFINITY }
    );

    if (!nearest.target || nearest.delta > MISS_WINDOW) {
      return;
    }

    const result = classifyHit(nearest.delta, nearest.target.midiNotes, playedMidiNotes);
    setJudgements((previous) => ({
      ...previous,
      [nearest.target.id]: { result, delta: nearest.delta }
    }));
    setLastJudgement({ result, label: getTargetLabel(nearest.target), delta: nearest.delta });
  }

  useEffect(() => {
    evaluatePlayedNotesRef.current = evaluatePlayedNotes;
  });

  function restartLesson() {
    setCurrentTime(0);
    setJudgements({});
    setLastJudgement(null);
    setRunning(false);
  }

  async function enableMicListening() {
    setMicError("");
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMicStatus("unsupported");
          setMicError("This browser does not support microphone input.");
          return;
        }
        if (webStreamRef.current) {
          setMicStatus("listening");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true
          }
        });
        webStreamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          setMicStatus("unsupported");
          setMicError("Web Audio API is unavailable in this browser.");
          return;
        }
        const audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const sampleBuffer = new Float32Array(analyser.fftSize);
        analysisTimerRef.current = setInterval(() => {
          if (!analyserRef.current) {
            return;
          }
          analyserRef.current.getFloatTimeDomainData(sampleBuffer);
          const { frequency, rms } = autoCorrelate(sampleBuffer, audioContext.sampleRate);
          if (rms < MIN_RMS || frequency <= 0) {
            return;
          }
          const midi = frequencyToMidi(frequency);
          if (midi === null) {
            return;
          }
          setLiveDetectedNote(midiToNoteName(midi));
          evaluatePlayedNotesRef.current([midi]);
        }, 55);
        setMicStatus("listening");
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setMicStatus("denied");
        setMicError("Microphone permission denied.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      if (!nativeRecordingRef.current) {
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
        await recording.startAsync();
        nativeRecordingRef.current = recording;
      }
      setMicStatus("listening");
      setMicError("Native realtime pitch analysis is pending. Web grading is fully live now.");
    } catch (error) {
      setMicStatus("error");
      setMicError(error instanceof Error ? error.message : "Microphone start failed.");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.lessonHeading}>{LESSON.title}</Text>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Score" value={stats.score} />
        <Metric label="Perfect" value={stats.perfect} />
        <Metric label="Good" value={stats.good} />
        <Metric label="Miss" value={stats.miss} />
      </View>

      <View style={styles.timelineFrame}>
        <View style={[styles.targetRail, { left: targetX }]}>
          <Animated.View style={[styles.targetBall, { transform: [{ scale: pulse }] }]} />
          <Text style={styles.targetLabel}>Now</Text>
        </View>
        {LESSON.targets.map((target) => {
          const x = targetX + (target.time - currentTime) * PIXELS_PER_SECOND;
          if (x < -80 || x > width + 80) {
            return null;
          }
          const judgement = judgements[target.id];
          return (
            <View
              key={target.id}
              style={[
                styles.notePill,
                {
                  left: x,
                  backgroundColor: judgement
                    ? judgement.result === "perfect"
                      ? "#2FBF71"
                      : judgement.result === "good"
                        ? COLORS.softGold
                        : "#C14953"
                    : COLORS.bronzeOlive
                }
              ]}
            >
              <Text style={styles.notePillText}>{getTargetLabel(target)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.transportRow}>
        <Pressable style={styles.primaryButton} onPress={() => setRunning((value) => !value)}>
          <Text style={styles.primaryButtonText}>{isRunning ? "Pause" : "Play"}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={restartLesson}>
          <Text style={styles.secondaryButtonText}>Restart</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={enableMicListening}>
          <Text style={styles.secondaryButtonText}>Enable Mic</Text>
        </Pressable>
      </View>

      <View style={styles.micStatusRow}>
        <Text style={styles.metaLabel}>Mic:</Text>
        <Text style={styles.metaValue}>
          {micStatus === "listening"
            ? "listening"
            : micStatus === "denied"
              ? "permission denied"
              : micStatus === "unsupported"
                ? "unsupported"
                : micStatus === "error"
                  ? "error"
                  : "not started"}
        </Text>
      </View>
      {micError ? <Text style={styles.micErrorText}>{micError}</Text> : null}

      <View style={styles.metronomeRow}>
        <Text style={styles.metaLabel}>Metronome</Text>
        <Pressable style={styles.tempoButton} onPress={() => setMetronomeBpm((v) => Math.max(40, v - 5))}>
          <Text style={styles.tempoButtonText}>-</Text>
        </Pressable>
        <Text style={styles.metaValue}>{metronomeBpm} BPM</Text>
        <Pressable style={styles.tempoButton} onPress={() => setMetronomeBpm((v) => Math.min(180, v + 5))}>
          <Text style={styles.tempoButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputTitle}>Realtime Detection</Text>
        <Text style={styles.inputHint}>
          Play your guitar when notes cross the pointer. Detected notes auto-trigger grading.
        </Text>
        <Text style={styles.liveNoteText}>Live note: {liveDetectedNote}</Text>
      </View>

      <ScrollView style={styles.debugList}>
        <Text style={styles.metaLabel}>Progress {stats.judged}/{LESSON.targets.length}</Text>
        {lastJudgement ? (
          <Text style={styles.lastHit}>
            Last: {lastJudgement.label} {lastJudgement.result.toUpperCase()} ({lastJudgement.delta.toFixed(3)}s)
          </Text>
        ) : (
          <Text style={styles.lastHit}>No hits yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  return (
    <SafeAreaView style={styles.safe}>
      {screen === "landing" ? (
        <LandingScreen onStart={() => setScreen("lesson")} />
      ) : (
        <LessonScreen onBack={() => setScreen("landing")} />
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  hero: {
    marginTop: 18,
    alignItems: "center"
  },
  logoWrap: {
    width: 240,
    height: 90,
    marginBottom: 8
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: "#DADADA",
    marginTop: 6
  },
  lessonCard: {
    marginTop: 24,
    backgroundColor: COLORS.darkGray,
    borderRadius: 16,
    padding: 18,
    gap: 6
  },
  lessonCardTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700"
  },
  lessonCardMeta: {
    color: "#EFEFEF"
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: COLORS.softGold,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  primaryButtonText: {
    color: COLORS.black,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: COLORS.softGold,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: COLORS.softGold,
    fontWeight: "600"
  },
  topRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  lessonHeading: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "700",
    flexShrink: 1
  },
  metricsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#1f1f1f",
    borderRadius: 12,
    padding: 10
  },
  metricLabel: {
    color: "#9f9f9f",
    fontSize: 12
  },
  metricValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700"
  },
  timelineFrame: {
    marginTop: 16,
    minHeight: 130,
    backgroundColor: "#181818",
    borderRadius: 16,
    borderColor: COLORS.darkGray,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center"
  },
  targetRail: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: "30%",
    width: 2,
    alignItems: "center",
    backgroundColor: "#5f5f5f"
  },
  targetBall: {
    position: "absolute",
    top: 40,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.softGold,
    marginLeft: -8
  },
  targetLabel: {
    color: COLORS.white,
    fontSize: 11,
    position: "absolute",
    top: 64,
    left: -18
  },
  notePill: {
    position: "absolute",
    top: 48,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14
  },
  notePillText: {
    color: COLORS.black,
    fontWeight: "700",
    textAlign: "center"
  },
  transportRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  metronomeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  micStatusRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  micErrorText: {
    marginTop: 4,
    color: "#FF8A80"
  },
  metaLabel: {
    color: "#BBBBBB"
  },
  metaValue: {
    color: COLORS.white,
    fontWeight: "700"
  },
  tempoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.bronzeOlive,
    alignItems: "center",
    justifyContent: "center"
  },
  tempoButtonText: {
    color: COLORS.softGold,
    fontWeight: "700",
    fontSize: 16
  },
  inputSection: {
    marginTop: 12,
    backgroundColor: "#1b1b1b",
    borderRadius: 12,
    padding: 12
  },
  inputTitle: {
    color: COLORS.white,
    fontWeight: "700",
    marginBottom: 4
  },
  inputHint: {
    color: "#B5B5B5",
    fontSize: 12
  },
  liveNoteText: {
    marginTop: 10,
    color: COLORS.softGold,
    fontWeight: "700"
  },
  debugList: {
    marginTop: 12
  },
  lastHit: {
    marginTop: 4,
    color: "#D7D7D7"
  }
});
