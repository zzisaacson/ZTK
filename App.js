import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import lessonData from "./src/data/lessons/em_am_test.json";
import InstructionalVideo from "./src/components/InstructionalVideo";
import StringPractice from "./src/components/StringPractice";

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  gold:    "#F7DB75",
  bronze:  "#987D30",
  white:   "#FFFFFF",
  black:   "#000000",
  bg:      "#121212",
  perfect: "#2FBF71",
  good:    "#F7DB75",
  miss:    "#C14953",
  wood:    "#1a0e05",
};

// ─── Lesson / fretboard constants ─────────────────────────────────────────────

const PERFECT_WINDOW    = 0.12;
const GOOD_WINDOW       = 0.32;
const MISS_WINDOW       = 0.52;
const PIXELS_PER_SECOND = 120;
const MIN_RMS           = 0.015;

const GUITAR_STRINGS = [
  { id: 6, label: "E", wound: true,  thickness: 3.2, color: "#f0f0f0" },
  { id: 5, label: "A", wound: true,  thickness: 2.6, color: "#e0e0e0" },
  { id: 4, label: "D", wound: true,  thickness: 2.1, color: "#d8d8d8" },
  { id: 3, label: "G", wound: false, thickness: 1.6, color: "#c9a050" },
  { id: 2, label: "B", wound: false, thickness: 1.2, color: "#c9a050" },
  { id: 1, label: "e", wound: false, thickness: 0.9, color: "#c4913a" },
];

const FB_H       = 164;
const FB_STR_TOP = 28;
const FB_STR_GAP = 22;
const FB_STR_YS  = GUITAR_STRINGS.map((_, i) => FB_STR_TOP + i * FB_STR_GAP);
const BLOCK_W    = 54;
const BLOCK_TOP  = FB_STR_YS[0] - 8;
const BLOCK_BOT  = FB_STR_YS[5] + 14;
const BLOCK_H    = BLOCK_BOT - BLOCK_TOP;

const CHORD_ACTIVE = {
  Em: [true,  true, true, true, true, true],
  Am: [false, true, true, true, true, true],
};

const LESSON = {
  id: lessonData.id, title: lessonData.title, bpm: lessonData.bpm,
  durationSeconds: lessonData.durationSeconds, sourceMidi: lessonData.sourceMidi,
  targets: lessonData.targets,
};

// ─── Module / tab data ────────────────────────────────────────────────────────

const ALL_MODULES = [
  { id: 1, type: "tutorial", title: "Em & Am",          subtitle: "Fundamentals",    emoji: "🎸", hasRealLesson: true  },
  { id: 2, type: "tutorial", title: "G & D Chords",     subtitle: "Open Position",   emoji: "🎼", hasRealLesson: false },
  { id: 3, type: "tutorial", title: "Barre Chords",     subtitle: "Level Up",        emoji: "⭐", hasRealLesson: false },
  { id: 4, type: "workout",  title: "Chord Changes",    subtitle: "Speed Drill",     emoji: "⚡", hasRealLesson: false },
  { id: 5, type: "workout",  title: "Strumming",        subtitle: "Rhythm Training", emoji: "🥁", hasRealLesson: false },
  { id: 6, type: "workout",  title: "Scale Runs",       subtitle: "Finger Strength", emoji: "🎯", hasRealLesson: false },
  { id: 7, type: "song",     title: "First Song",       subtitle: "Put It Together", emoji: "🎤", hasRealLesson: false },
  { id: 8, type: "song",     title: "Wonderwall",       subtitle: "Oasis",           emoji: "🎶", hasRealLesson: false },
  { id: 9, type: "song",     title: "Knockin' On Heaven", subtitle: "Bob Dylan",     emoji: "🚪", hasRealLesson: false },
];

const TABS = [
  { id: "learn",    label: "Learn",    emoji: "📖", world: "JOURNEY", title: "Zero To Kumziz"  },
  { id: "workouts", label: "Workouts", emoji: "⚡",  world: "GYM",     title: "Practice Drills" },
  { id: "songs",    label: "Songs",    emoji: "🎵",  world: "STAGE",   title: "Your Setlist"    },
];

function modulesForTab(tabId) {
  if (tabId === "workouts") return ALL_MODULES.filter(m => m.type === "workout");
  if (tabId === "songs")    return ALL_MODULES.filter(m => m.type === "song");
  return ALL_MODULES;
}

function getUnlockedIds(modules, completedModules) {
  return modules
    .filter((mod, i) => i === 0 || completedModules[modules[i - 1].id])
    .map(m => m.id);
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function classifyHit(deltaS, expected, played) {
  const expPC  = [...new Set(expected.map(n => n % 12))];
  const playPC = [...new Set(played.map(n => n % 12))];
  const overlap  = expPC.filter(pc => playPC.includes(pc)).length;
  const coverage = overlap / Math.max(1, expPC.length);
  if (coverage >= 0.66 && deltaS <= PERFECT_WINDOW) return "perfect";
  if (coverage >= 0.34 && deltaS <= GOOD_WINDOW)    return "good";
  return "miss";
}

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < MIN_RMS) return { frequency: -1, rms };
  let bestOff = -1, bestCorr = 0;
  for (let off = 8; off < buffer.length / 2; off++) {
    let corr = 0;
    for (let i = 0; i < buffer.length / 2; i++) corr += Math.abs(buffer[i] - buffer[i + off]);
    corr = 1 - corr / (buffer.length / 2);
    if (corr > bestCorr) { bestCorr = corr; bestOff = off; }
  }
  if (bestOff === -1 || bestCorr < 0.82) return { frequency: -1, rms };
  return { frequency: sampleRate / bestOff, rms };
}

function freqToMidi(freq) {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return midi >= 28 && midi <= 88 ? midi : null;
}

function midiToName(midi) {
  const n = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function scoreFor(label) { return label === "perfect" ? 3 : label === "good" ? 1 : 0; }

function getTargetLabel(target) {
  const u = [...new Set(target.noteNames)];
  if (u.join(",") === "E2,B2,E3,G3,B3,E4") return "Em";
  if (u.join(",") === "A2,E3,A3,C4,E4")    return "Am";
  return u.slice(0, 3).join(" ");
}

function resultColor(r) { return r === "perfect" ? C.perfect : r === "good" ? C.good : C.miss; }

// ─── Path screen components ───────────────────────────────────────────────────

function PathDots({ from, to, unlocked }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const DOT = 10, SPACING = 20, EDGE = 46;
  const count = Math.floor(Math.max(0, dist - EDGE * 2) / SPACING);
  if (count < 1) return null;
  const col = unlocked ? "#5C4512" : "#242424";
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const t = (EDGE + i * SPACING + SPACING / 2) / dist;
        return (
          <View key={i} style={{
            position: "absolute",
            left: from.x + dx * t - DOT / 2,
            top:  from.y + dy * t - DOT / 2,
            width: DOT, height: DOT, borderRadius: DOT / 2,
            backgroundColor: col,
          }} />
        );
      })}
    </>
  );
}

function ModuleNode({ mod, nodeState, center, size, onPress }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (nodeState !== "available") return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.1, duration: 650, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1.0, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [nodeState, anim]);

  const bgColor     = nodeState === "locked" ? "#1C1C1C" : nodeState === "completed" ? "#132613" : "#0C2B0C";
  const borderColor = nodeState === "locked" ? "#303030" : nodeState === "completed" ? C.gold    : C.perfect;
  const glowColor   = nodeState === "locked" ? "transparent" : nodeState === "completed" ? C.gold : C.perfect;
  const icon        = nodeState === "locked" ? "🔒" : nodeState === "completed" ? "✅" : mod.emoji;

  return (
    <Animated.View style={{
      position: "absolute",
      left: center.x - size / 2, top: center.y - size / 2,
      transform: [{ scale: anim }],
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: nodeState !== "locked" ? 0.85 : 0,
      shadowRadius: 16,
      elevation: nodeState !== "locked" ? 10 : 2,
    }}>
      <Pressable onPress={onPress} style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bgColor,
        borderWidth: nodeState === "available" ? 4 : 3,
        borderColor,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: nodeState === "locked" ? 24 : 30 }}>{icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

function NodeLabel({ mod, nodeState, stars, center, nodeSize, screenWidth }) {
  const W    = 120;
  const left = Math.max(6, Math.min(center.x - W / 2, screenWidth - W - 6));
  return (
    <View style={{ position: "absolute", left, top: center.y + nodeSize / 2 + 10, width: W, alignItems: "center" }}>
      <Text style={{ color: nodeState === "locked" ? "#3A3A3A" : C.white, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
        {mod.title}
      </Text>
      <Text style={{ color: nodeState === "locked" ? "#2C2C2C" : "#ADADAD", fontSize: 11, textAlign: "center" }}>
        {mod.subtitle}
      </Text>
      {nodeState === "completed" && stars > 0 && (
        <Text style={{ color: C.gold, fontSize: 14, marginTop: 3 }}>
          {"★".repeat(stars)}{"☆".repeat(3 - stars)}
        </Text>
      )}
      {nodeState === "available" && (
        <View style={{ marginTop: 4, borderWidth: 1, borderColor: C.perfect, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
          <Text style={{ color: C.perfect, fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>START</Text>
        </View>
      )}
    </View>
  );
}

function ModuleNodeWithLabel({ mod, nodeState, stars, center, nodeSize, screenWidth, onPress }) {
  return (
    <>
      <ModuleNode mod={mod} nodeState={nodeState} center={center} size={nodeSize} onPress={onPress} />
      <NodeLabel mod={mod} nodeState={nodeState} stars={stars} center={center} nodeSize={nodeSize} screenWidth={screenWidth} />
    </>
  );
}

function PathScreen({ modules, tabConfig, completedModules, onSelectModule }) {
  const { width } = useWindowDimensions();
  const NODE_SIZE = 80, HALF = NODE_SIZE / 2, SIDE_PAD = 28;
  const leftX  = SIDE_PAD + HALF;
  const rightX = width - SIDE_PAD - HALF;

  const unlockedIds = getUnlockedIds(modules, completedModules);

  const nodeCenters = modules.map((_, i) => ({
    x: i % 2 === 0 ? rightX : leftX,
    y: 70 + i * 180,
  }));

  const totalHeight = nodeCenters.length > 0
    ? nodeCenters[nodeCenters.length - 1].y + HALF + 110
    : 300;

  const earnedStars = modules.reduce((s, m) => s + (completedModules[m.id]?.stars || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={pathSt.header}>
        <View>
          <Text style={pathSt.worldLabel}>{tabConfig.world}</Text>
          <Text style={pathSt.worldTitle}>{tabConfig.title}</Text>
        </View>
        <View style={pathSt.starsBox}>
          <Text style={pathSt.starIcon}>★</Text>
          <Text style={pathSt.starsCount}>{earnedStars} / {modules.length * 3}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ height: totalHeight }}>
        {modules.slice(0, -1).map((mod, i) => (
          <PathDots key={`d${i}`} from={nodeCenters[i]} to={nodeCenters[i + 1]} unlocked={unlockedIds.includes(mod.id)} />
        ))}
        {modules.map((mod, i) => {
          const center     = nodeCenters[i];
          const isUnlocked = unlockedIds.includes(mod.id);
          const isCompleted = !!completedModules[mod.id];
          const nodeState  = !isUnlocked ? "locked" : isCompleted ? "completed" : "available";
          return (
            <ModuleNodeWithLabel
              key={mod.id}
              mod={mod}
              nodeState={nodeState}
              stars={completedModules[mod.id]?.stars || 0}
              center={center}
              nodeSize={NODE_SIZE}
              screenWidth={width}
              onPress={() => onSelectModule(mod, nodeState)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function TabBar({ activeTab, onTabChange }) {
  return (
    <View style={tabSt.bar}>
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={tabSt.tab} onPress={() => onTabChange(tab.id)}>
            {active && <View style={tabSt.indicator} />}
            <Text style={[tabSt.tabEmoji, active && tabSt.tabEmojiActive]}>{tab.emoji}</Text>
            <Text style={[tabSt.tabLabel,  active && tabSt.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Module landing screen ────────────────────────────────────────────────────

function LandingScreen({ onLesson, onPractice, onBack }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Path</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Animated.Image
            source={require("./context/Zero To Kumziz_ final project files 3/Logo Design/TRANSPARENT/PNG/Logo/Logo-01.png")}
            resizeMode="contain" style={styles.logo}
          />
        </View>
        <Text style={styles.appTitle}>Zero To Kumziz</Text>
        <Text style={styles.appSubtitle}>Play along, hit the target, earn your score.</Text>
      </View>

      <View style={styles.videoSection}>
        <Text style={styles.videoTitle}>Watch First</Text>
        <Text style={styles.videoSubtitle}>E Minor chord walkthrough</Text>
        <InstructionalVideo />
      </View>

      <Text style={styles.modulesHeading}>Choose a module</Text>

      <View style={styles.moduleCard}>
        <Text style={styles.moduleEmoji}>🎵</Text>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Strum Along</Text>
          <Text style={styles.moduleDesc}>Play Em → Am chord changes in real time. Hit targets and score points.</Text>
          <Text style={styles.moduleTip}>Green = perfect · Yellow = close · Red = miss</Text>
        </View>
        <Pressable onPress={onLesson} style={styles.moduleBtn}>
          <Text style={styles.moduleBtnText}>Start</Text>
        </Pressable>
      </View>

      <View style={styles.moduleCard}>
        <Text style={styles.moduleEmoji}>🎸</Text>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>String Practice</Text>
          <Text style={styles.moduleDesc}>Pluck each Em string one by one, then strum the full chord.</Text>
          <Text style={styles.moduleTip}>Green = ringing · Red = muted / missing</Text>
        </View>
        <Pressable onPress={onPractice} style={styles.moduleBtn}>
          <Text style={styles.moduleBtnText}>Start</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Lesson screen ────────────────────────────────────────────────────────────

function LessonScreen({ onFinish }) {
  const { width } = useWindowDimensions();
  const strumX = Math.max(72, width * 0.2);

  const [isRunning,    setRunning]    = useState(false);
  const [currentTime,  setCurrentTime]= useState(0);
  const [judgements,   setJudgements] = useState({});
  const [lastJudge,    setLastJudge]  = useState(null);
  const [flashVisible, setFlashVis]   = useState(false);
  const [metroBpm,     setMetroBpm]   = useState(LESSON.bpm);
  const [micStatus,    setMicStatus]  = useState("idle");
  const [micError,     setMicError]   = useState("");
  const [liveNote,     setLiveNote]   = useState("—");
  const [pulse]     = useState(new Animated.Value(1));
  const [flashAnim] = useState(new Animated.Value(0));

  const webStreamRef = useRef(null);
  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);
  const analysisRef  = useRef(null);
  const nativeRecRef = useRef(null);
  const evalRef      = useRef(() => {});

  useEffect(() => {
    if (!isRunning) return;
    const startedAt = Date.now() - currentTime * 1000;
    const t = setInterval(() => setCurrentTime(Math.min((Date.now() - startedAt) / 1000, LESSON.durationSeconds)), 40);
    return () => clearInterval(t);
  }, [isRunning, currentTime]);

  useEffect(() => {
    const ms = Math.max(250, (60 / metroBpm) * 1000);
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.45, duration: 80,  useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    }, ms);
    return () => clearInterval(t);
  }, [metroBpm, pulse]);

  useEffect(() => {
    if (!isRunning) return;
    setJudgements(prev => {
      const next = { ...prev }; let changed = false;
      for (const t of LESSON.targets) {
        if (!next[t.id] && currentTime > t.time + MISS_WINDOW) { next[t.id] = { result: "miss", delta: null }; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [currentTime, isRunning]);

  useEffect(() => () => {
    clearInterval(analysisRef.current);
    audioCtxRef.current?.close().catch(() => {});
    webStreamRef.current?.getTracks().forEach(t => t.stop());
    nativeRecRef.current?.stopAndUnloadAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!lastJudge) return;
    setFlashVis(true);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 60,  useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setFlashVis(false), 580);
    return () => clearTimeout(t);
  }, [lastJudge]);

  const stats = useMemo(() => {
    const vals = Object.values(judgements);
    return {
      perfect: vals.filter(v => v.result === "perfect").length,
      good:    vals.filter(v => v.result === "good").length,
      miss:    vals.filter(v => v.result === "miss").length,
      score:   vals.reduce((s, v) => s + scoreFor(v.result), 0),
      judged:  vals.length,
    };
  }, [judgements]);

  const statsRef = useRef(stats);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  function evaluatePlayedNotes(midiNotes) {
    const upcoming = LESSON.targets.filter(t => !judgements[t.id]);
    const nearest  = upcoming.reduce(
      (best, t) => { const d = Math.abs(currentTime - t.time); return d < best.delta ? { target: t, delta: d } : best; },
      { target: null, delta: Infinity }
    );
    if (!nearest.target || nearest.delta > MISS_WINDOW) return;
    const result = classifyHit(nearest.delta, nearest.target.midiNotes, midiNotes);
    setJudgements(prev => ({ ...prev, [nearest.target.id]: { result, delta: nearest.delta } }));
    setLastJudge({ result, label: getTargetLabel(nearest.target), delta: nearest.delta });
  }

  useEffect(() => { evalRef.current = evaluatePlayedNotes; });

  function restartLesson() { setCurrentTime(0); setJudgements({}); setLastJudge(null); setRunning(false); }

  async function enableMic() {
    setMicError("");
    try {
      if (Platform.OS === "web") {
        if (!navigator?.mediaDevices?.getUserMedia) { setMicStatus("unsupported"); setMicError("Browser doesn't support microphone."); return; }
        if (webStreamRef.current) { setMicStatus("listening"); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } });
        webStreamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) { setMicStatus("unsupported"); setMicError("Web Audio unavailable."); return; }
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const anlz = ctx.createAnalyser(); anlz.fftSize = 2048;
        src.connect(anlz); audioCtxRef.current = ctx; analyserRef.current = anlz;
        const buf = new Float32Array(anlz.fftSize);
        analysisRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(buf);
          const { frequency, rms } = autoCorrelate(buf, ctx.sampleRate);
          if (rms < MIN_RMS || frequency <= 0) return;
          const midi = freqToMidi(frequency); if (!midi) return;
          setLiveNote(midiToName(midi)); evalRef.current([midi]);
        }, 55);
        setMicStatus("listening");
      } else {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) { setMicStatus("denied"); setMicError("Microphone permission denied."); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        if (!nativeRecRef.current) {
          const rec = new Audio.Recording();
          await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
          await rec.startAsync(); nativeRecRef.current = rec;
        }
        setMicStatus("listening"); setMicError("Native live grading coming soon. Use web for full experience.");
      }
    } catch (err) { setMicStatus("error"); setMicError(err.message || "Mic failed."); }
  }

  return (
    <View style={styles.lessonScreen}>
      <View style={styles.topRow}>
        <Pressable style={styles.secondaryBtn} onPress={() => onFinish(statsRef.current)}>
          <Text style={styles.secondaryBtnText}>← Path</Text>
        </Pressable>
        <Text style={styles.lessonHeading}>{LESSON.title}</Text>
        <View style={[styles.liveChip, micStatus === "listening" && styles.liveChipOn]}>
          <Text style={[styles.liveChipText, micStatus === "listening" && { color: C.perfect }]}>
            {micStatus === "listening" ? liveNote : "🎤 off"}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <ScoreChip label="Score"   value={stats.score}   color={C.gold}    />
        <ScoreChip label="Perfect" value={stats.perfect} color={C.perfect} />
        <ScoreChip label="Good"    value={stats.good}    color={C.good}    />
        <ScoreChip label="Miss"    value={stats.miss}    color={C.miss}    />
      </View>

      <View style={[styles.fretboard, { height: FB_H }]}>
        <View style={[StyleSheet.absoluteFill, styles.fretboardBg]} />
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={[styles.fretDecor, { left: strumX + 28 + i * 68 }]} />
        ))}
        {GUITAR_STRINGS.map((s, i) => (
          <View key={s.id} style={[styles.stringTrack, { top: FB_STR_YS[i] - s.thickness / 2, height: s.thickness, backgroundColor: s.color }]} />
        ))}
        {GUITAR_STRINGS.map((s, i) => (
          <View key={s.id} style={[styles.strLabel, { top: FB_STR_YS[i] - 10 }]}>
            <Text style={styles.strLabelText}>{s.label}</Text>
          </View>
        ))}
        <View style={[styles.strumLine, { left: strumX }]} />
        <Animated.View style={[styles.strumBall, { left: strumX - 11, top: FB_H / 2 - 11, transform: [{ scale: pulse }] }]} />

        {LESSON.targets.map(t => {
          const x     = strumX + (t.time - currentTime) * PIXELS_PER_SECOND - BLOCK_W / 2;
          if (x < -BLOCK_W - 10 || x > width + 10) return null;
          const judge  = judgements[t.id];
          const label  = getTargetLabel(t);
          const active = CHORD_ACTIVE[label] ?? [true, true, true, true, true, true];
          const jColor = judge ? resultColor(judge.result) : null;
          const border = jColor || C.bronze;
          return (
            <View key={t.id} style={[styles.chordBlock, {
              left: x, top: BLOCK_TOP, height: BLOCK_H, width: BLOCK_W,
              backgroundColor: jColor ? jColor + "30" : "#261800", borderColor: border,
            }]}>
              {GUITAR_STRINGS.map((s, i) =>
                active[i] ? (
                  <View key={s.id} style={[styles.chordDot, { position: "absolute", top: FB_STR_YS[i] - BLOCK_TOP - 5, left: BLOCK_W / 2 - 5, backgroundColor: border }]} />
                ) : (
                  <Text key={s.id} style={[styles.chordMuteX, { position: "absolute", top: FB_STR_YS[i] - BLOCK_TOP - 9, left: BLOCK_W / 2 - 6 }]}>×</Text>
                )
              )}
            </View>
          );
        })}

        {/* Chord names float above the string lines */}
        {LESSON.targets.map(t => {
          const x    = strumX + (t.time - currentTime) * PIXELS_PER_SECOND - BLOCK_W / 2;
          if (x < -BLOCK_W - 10 || x > width + 10) return null;
          const judge  = judgements[t.id];
          const jColor = judge ? resultColor(judge.result) : null;
          const border = jColor || C.bronze;
          return (
            <Text key={`lbl-${t.id}`} style={[styles.chordLabelAbove, { left: x, color: border }]}>
              {getTargetLabel(t)}
            </Text>
          );
        })}

        {flashVisible && lastJudge && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.flashOverlay, { backgroundColor: resultColor(lastJudge.result) + "20", opacity: flashAnim }]}>
            <Text style={[styles.flashText, { color: resultColor(lastJudge.result) }]}>{lastJudge.result.toUpperCase()}</Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.transportRow}>
        <Pressable style={styles.primaryBtn} onPress={() => setRunning(v => !v)}>
          <Text style={styles.primaryBtnText}>{isRunning ? "⏸  Pause" : "▶  Play"}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={restartLesson}>
          <Text style={styles.secondaryBtnText}>↺ Restart</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, micStatus === "listening" && styles.secondaryBtnOn]} onPress={enableMic}>
          <Text style={[styles.secondaryBtnText, micStatus === "listening" && { color: C.perfect }]}>
            {micStatus === "listening" ? "🎤 On" : "🎤 Mic"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.metroRow}>
        <Text style={styles.metaLabel}>Tempo</Text>
        <Pressable style={styles.tempoBtn} onPress={() => setMetroBpm(v => Math.max(40, v - 5))}><Text style={styles.tempoBtnText}>−</Text></Pressable>
        <Text style={styles.metaValue}>{metroBpm} BPM</Text>
        <Pressable style={styles.tempoBtn} onPress={() => setMetroBpm(v => Math.min(180, v + 5))}><Text style={styles.tempoBtnText}>+</Text></Pressable>
      </View>

      {!!micError && <Text style={styles.micErrText}>{micError}</Text>}

      <View style={styles.progressRow}>
        <Text style={styles.metaLabel}>{stats.judged} / {LESSON.targets.length} targets</Text>
        {lastJudge && (
          <Text style={[styles.lastHitText, { color: resultColor(lastJudge.result) }]}>
            {lastJudge.label} · {lastJudge.result.toUpperCase()} · {lastJudge.delta?.toFixed(2)}s
          </Text>
        )}
      </View>

      <View style={styles.legendRow}>
        <LegendItem color={C.perfect} label="Perfect ≤120ms" />
        <LegendItem color={C.good}    label="Good ≤320ms" />
        <LegendItem color={C.miss}    label="Miss" />
      </View>
    </View>
  );
}

function ScoreChip({ label, value, color }) {
  return (
    <View style={styles.scoreChip}>
      <Text style={styles.scoreChipLabel}>{label}</Text>
      <Text style={[styles.scoreChipValue, { color: color || C.white }]}>{value}</Text>
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,          setScreen]          = useState("path");
  const [activeTab,       setActiveTab]       = useState("learn");
  const [selectedModule,  setSelectedModule]  = useState(null);
  // { [moduleId]: { stars: 1|2|3 } }
  const [completedModules, setCompletedModules] = useState({});

  const currentTabConfig = TABS.find(t => t.id === activeTab);
  const currentModules   = modulesForTab(activeTab);

  function handleSelectModule(mod, nodeState) {
    if (nodeState === "locked") {
      const tabMods = modulesForTab(activeTab);
      const idx  = tabMods.findIndex(m => m.id === mod.id);
      const prev = idx > 0 ? tabMods[idx - 1] : null;
      Alert.alert("🔒 Locked", prev ? `Complete "${prev.title}" to unlock this.` : "Complete the previous lesson first.", [{ text: "Got it" }]);
      return;
    }
    if (!mod.hasRealLesson) {
      const msg = nodeState === "available"
        ? `You've unlocked ${mod.title}! This lesson is coming soon.`
        : `${mod.title} is on its way — keep playing!`;
      Alert.alert("🚧 Coming Soon", msg, [{ text: "OK" }]);
      return;
    }
    setSelectedModule(mod);
    setScreen("landing");
  }

  function recordCompletion(moduleId, stars) {
    setCompletedModules(prev => ({
      ...prev,
      [moduleId]: { stars: Math.max(stars, prev[moduleId]?.stars || 0) },
    }));
  }

  function handleLessonFinish(stats) {
    if (!selectedModule) return;
    const stars = stats.score >= 9 ? 3 : stats.score >= 3 ? 2 : 1;
    recordCompletion(selectedModule.id, stars);
  }

  function handlePracticeBack() {
    if (selectedModule) recordCompletion(selectedModule.id, 1);
    setScreen("path");
  }

  return (
    <SafeAreaView style={styles.safe}>
      {screen === "path" && (
        <>
          <PathScreen
            modules={currentModules}
            tabConfig={currentTabConfig}
            completedModules={completedModules}
            onSelectModule={handleSelectModule}
          />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      )}
      {screen === "landing" && (
        <LandingScreen
          onLesson={()   => setScreen("lesson")}
          onPractice={()  => setScreen("practice")}
          onBack={()      => setScreen("path")}
        />
      )}
      {screen === "lesson" && (
        <LessonScreen
          onFinish={stats => { handleLessonFinish(stats); setScreen("path"); }}
        />
      )}
      {screen === "practice" && (
        <StringPractice onBack={handlePracticeBack} />
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

// ─── Path screen styles ───────────────────────────────────────────────────────

const pathSt = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#1E1E1E",
  },
  worldLabel: { color: C.gold, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  worldTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginTop: 2 },
  starsBox:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1A1A1A", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  starIcon:   { color: C.gold, fontSize: 16 },
  starsCount: { color: C.white, fontWeight: "700", fontSize: 14 },
});

// ─── Tab bar styles ───────────────────────────────────────────────────────────

const tabSt = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: "#0D0D0D", borderTopWidth: 1, borderTopColor: "#1E1E1E", paddingBottom: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, position: "relative" },
  indicator: { position: "absolute", top: 0, left: "25%", right: "25%", height: 2, backgroundColor: C.gold, borderRadius: 1 },
  tabEmoji:      { fontSize: 20, opacity: 0.4 },
  tabEmojiActive:{ opacity: 1 },
  tabLabel:      { marginTop: 3, fontSize: 11, fontWeight: "600", color: "#555" },
  tabLabelActive:{ color: C.gold },
});

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Landing
  screen:         { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 28 },
  backButton:     { marginTop: 8, marginBottom: 4, alignSelf: "flex-start" },
  backButtonText: { color: C.gold, fontWeight: "600", fontSize: 15 },
  hero:           { marginTop: 12, alignItems: "center" },
  logoWrap:       { width: 240, height: 90, marginBottom: 8 },
  logo:           { width: "100%", height: "100%" },
  appTitle:       { color: C.white, fontSize: 28, fontWeight: "700" },
  appSubtitle:    { color: "#DADADA", marginTop: 6 },
  videoSection:   { marginTop: 24, backgroundColor: "#1b1b1b", borderRadius: 16, overflow: "hidden", paddingBottom: 12 },
  videoTitle:     { color: C.white, fontSize: 16, fontWeight: "700", marginTop: 14, marginHorizontal: 14 },
  videoSubtitle:  { color: "#ADADAD", fontSize: 13, marginHorizontal: 14, marginBottom: 10 },
  modulesHeading: { color: C.white, fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 12 },
  moduleCard:     { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#1e1e1e", borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },
  moduleEmoji:    { fontSize: 28, marginTop: 2 },
  moduleBody:     { flex: 1, gap: 4 },
  moduleTitle:    { color: C.white, fontWeight: "700", fontSize: 15 },
  moduleDesc:     { color: "#ADADAD", fontSize: 13, lineHeight: 18 },
  moduleTip:      { color: "#666", fontSize: 11 },
  moduleBtn:      { backgroundColor: C.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, alignSelf: "center" },
  moduleBtnText:  { color: C.black, fontWeight: "700" },

  // Lesson
  lessonScreen:    { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },
  topRow:          { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  lessonHeading:   { flex: 1, color: C.white, fontSize: 16, fontWeight: "700" },
  liveChip:        { backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveChipOn:      { backgroundColor: "#062210" },
  liveChipText:    { color: "#777", fontSize: 13 },
  metricsRow:      { marginTop: 10, flexDirection: "row", gap: 6 },
  scoreChip:       { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 8, alignItems: "center" },
  scoreChipLabel:  { color: "#777", fontSize: 11 },
  scoreChipValue:  { fontSize: 18, fontWeight: "700", marginTop: 1 },

  fretboard:    { marginTop: 14, borderRadius: 14, overflow: "hidden" },
  fretboardBg:  { backgroundColor: C.wood },
  fretDecor:    { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "#ffffff14" },
  stringTrack:  { position: "absolute", left: 0, right: 0 },
  strLabel:     { position: "absolute", left: 4, width: 24, height: 20, borderRadius: 4, backgroundColor: "#2d1a06", alignItems: "center", justifyContent: "center", zIndex: 10 },
  strLabelText: { color: "#c4913a", fontSize: 10, fontWeight: "800" },
  strumLine:    { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: C.gold + "cc", zIndex: 5 },
  strumBall:    { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, zIndex: 6 },
  chordBlock:      { position: "absolute", borderRadius: 7, borderWidth: 1.5, alignItems: "center", zIndex: 4 },
  chordLabelAbove: { position: "absolute", top: 5, width: BLOCK_W, textAlign: "center", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, zIndex: 8 },
  chordDot:     { width: 10, height: 10, borderRadius: 5 },
  chordMuteX:   { color: "#555", fontSize: 13, fontWeight: "900" },
  flashOverlay: { zIndex: 20, alignItems: "center", justifyContent: "center" },
  flashText:    { fontSize: 36, fontWeight: "900", letterSpacing: 3 },

  transportRow:     { marginTop: 12, flexDirection: "row", gap: 8 },
  primaryBtn:       { flex: 1, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryBtnText:   { color: C.black, fontWeight: "700", fontSize: 15 },
  secondaryBtn:     { borderColor: C.gold, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  secondaryBtnText: { color: C.gold, fontWeight: "600" },
  secondaryBtnOn:   { borderColor: C.perfect },
  metroRow:         { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  metaLabel:        { color: "#BBBBBB" },
  metaValue:        { color: C.white, fontWeight: "700" },
  tempoBtn:         { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.bronze, alignItems: "center", justifyContent: "center" },
  tempoBtnText:     { color: C.gold, fontWeight: "700", fontSize: 16 },
  micErrText:       { marginTop: 4, color: "#FF8A80", fontSize: 12 },
  progressRow:      { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastHitText:      { fontWeight: "700", fontSize: 13 },
  legendRow:        { marginTop: 8, flexDirection: "row", gap: 14, flexWrap: "wrap" },
  legendItem:       { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:        { width: 10, height: 10, borderRadius: 5 },
  legendText:       { color: "#888", fontSize: 11 },
});
