import { PitchDetector } from "pitchy";
import { detect as detectChord } from "@tonaljs/chord-detect";
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
  View
} from "react-native";
import lessonData from "./src/data/lessons/em_am_test.json";
import StringPractice from "./src/components/StringPractice";

const COLORS = {
  softGold: "#F7DB75",
  bronzeOlive: "#987D30",
  darkGray: "#4F4F4F",
  white: "#FFFFFF",
  black: "#000000",
  bg: "#121212"
};

const PERFECT_WINDOW = 0.50;
const GOOD_WINDOW = 1.20;
const MISS_WINDOW = 1.50;
const PIXELS_PER_SECOND = 120;
const MIN_RMS = 0.012;
const CHORD_MINI_PROXY_BASE_URL = "http://127.0.0.1:5003";
const CHORD_MINI_LOCAL_DEFAULT_BASE_URL = "http://127.0.0.1:5002";
const CHORD_MINI_LAN_FALLBACK_BASE_URL = "http://172.31.99.89:5002";
const CHORD_MINI_HEALTH_PATH = "/health";
const CHORD_MINI_RECOGNIZE_PATH = "/api/recognize-chords";
const CHORD_MINI_CHUNK_MS = 2000;
const CHORD_MINI_RATE_LIMIT_BACKOFF_MS = 20000;
const CHORD_MINI_STRUM_RMS_THRESHOLD = 0.015;
const CHORD_MINI_STRUM_WINDOW_MS = 3000;
const CHORD_MINI_MIN_UPLOAD_GAP_MS = 3000;
const CHORD_MINI_RMS_POLL_MS = 120;
const CHORD_MINI_PRE_ROLL_MS = 2500;
const CHORD_MINI_RING_MAX_MS = 4500;
const CHORD_MINI_UPLOAD_POLL_MS = 500;

// Guitar open-string pitch classes (low E to high E)
const GUITAR_STRINGS = [
  { label: "E2", pitchClass: 4 },
  { label: "A2", pitchClass: 9 },
  { label: "D3", pitchClass: 2 },
  { label: "G3", pitchClass: 7 },
  { label: "B3", pitchClass: 11 },
  { label: "E4", pitchClass: 4 }
];

// Chord shapes: index 0 = string 6 (low E), index 5 = string 1 (high e)
// fret: 0 = open, >0 = fret number, muted: true = X
const CHORD_SHAPES = {
  Em: [
    { fret: 0 },
    { fret: 2 },
    { fret: 2 },
    { fret: 0 },
    { fret: 0 },
    { fret: 0 }
  ],
  Am: [
    { muted: true },
    { fret: 0 },
    { fret: 2 },
    { fret: 2 },
    { fret: 1 },
    { fret: 0 }
  ]
};

const STRUM_GUIDE_STRINGS = [
  { id: 6, label: "E", thickness: 3.2, color: "#f0f0f0" },
  { id: 5, label: "A", thickness: 2.6, color: "#e0e0e0" },
  { id: 4, label: "D", thickness: 2.1, color: "#d8d8d8" },
  { id: 3, label: "G", thickness: 1.6, color: "#c9a050" },
  { id: 2, label: "B", thickness: 1.2, color: "#c9a050" },
  { id: 1, label: "e", thickness: 0.9, color: "#c4913a" }
];

const FB_H = 164;
const FB_STR_TOP = 28;
const FB_STR_GAP = 22;
const FB_STR_YS = STRUM_GUIDE_STRINGS.map((_, index) => FB_STR_TOP + index * FB_STR_GAP);
const BLOCK_W = 54;
const BLOCK_TOP = FB_STR_YS[0] - 8;
const BLOCK_BOT = FB_STR_YS[5] + 14;
const BLOCK_H = BLOCK_BOT - BLOCK_TOP;
const CHORD_ACTIVE = {
  Em: [true, true, true, true, true, true],
  Am: [false, true, true, true, true, true]
};

function centsOff(frequency, midiNote) {
  const targetFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
  return Math.round(1200 * Math.log2(frequency / targetFreq));
}

const LESSON = {
  id: lessonData.id,
  title: lessonData.title,
  bpm: lessonData.bpm,
  durationSeconds: lessonData.durationSeconds,
  sourceMidi: lessonData.sourceMidi,
  targets: lessonData.targets
};

const ALL_MODULES = [
  { id: 1, type: "tutorial", title: "Em & Am", subtitle: "Fundamentals", emoji: "🎸", hasRealLesson: true },
  { id: 2, type: "tutorial", title: "G & D Chords", subtitle: "Open Position", emoji: "🎼", hasRealLesson: false },
  { id: 3, type: "tutorial", title: "Barre Chords", subtitle: "Level Up", emoji: "⭐", hasRealLesson: false },
  { id: 4, type: "workout", title: "Chord Changes", subtitle: "Speed Drill", emoji: "⚡", hasRealLesson: false },
  { id: 5, type: "workout", title: "Strumming", subtitle: "Rhythm Training", emoji: "🥁", hasRealLesson: false },
  { id: 6, type: "workout", title: "Scale Runs", subtitle: "Finger Strength", emoji: "🎯", hasRealLesson: false },
  { id: 7, type: "song", title: "First Song", subtitle: "Put It Together", emoji: "🎤", hasRealLesson: false },
  { id: 8, type: "song", title: "Wonderwall", subtitle: "Oasis", emoji: "🎶", hasRealLesson: false },
  { id: 9, type: "song", title: "Knockin' On Heaven", subtitle: "Bob Dylan", emoji: "🚪", hasRealLesson: false }
];

const TABS = [
  { id: "learn", label: "Learn", emoji: "📖", world: "JOURNEY", title: "Zero To Kumziz" },
  { id: "workouts", label: "Workouts", emoji: "⚡", world: "GYM", title: "Practice Drills" },
  { id: "songs", label: "Songs", emoji: "🎵", world: "STAGE", title: "Your Setlist" }
];

function modulesForTab(tabId) {
  if (tabId === "workouts") {
    return ALL_MODULES.filter((moduleItem) => moduleItem.type === "workout");
  }
  if (tabId === "songs") {
    return ALL_MODULES.filter((moduleItem) => moduleItem.type === "song");
  }
  return ALL_MODULES;
}

function getUnlockedIds(modules, completedModules) {
  return modules
    .filter((moduleItem, index) => index === 0 || completedModules[modules[index - 1].id])
    .map((moduleItem) => moduleItem.id);
}

function classifyHit(deltaSeconds, expected, played) {
  const expectedPitchClasses = [...new Set(expected.map((note) => note % 12))];
  const playedPitchClasses = [...new Set(played.map((note) => note % 12))];
  const overlapCount = expectedPitchClasses.filter((pc) => playedPitchClasses.includes(pc)).length;
  // recall: fraction of expected notes detected; precision: fraction of detected notes that are expected
  const recall = overlapCount / Math.max(1, expectedPitchClasses.length);
  const precision = overlapCount / Math.max(1, playedPitchClasses.length);

  if (recall >= 0.48 && precision >= 0.40 && deltaSeconds <= PERFECT_WINDOW) {
    return { result: "perfect", coverage: recall };
  }

  if (deltaSeconds <= GOOD_WINDOW && recall >= 0.31 && precision >= 0.34) {
    return { result: "good", coverage: recall };
  }

  return { result: "miss", coverage: recall };
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
  // Limit search to guitar frequency range (~70 Hz E2 to ~1500 Hz)
  const minOffset = Math.max(8, Math.floor(sampleRate / 1500));
  const maxOffset = Math.min(Math.floor(sampleRate / 70), Math.floor(buffer.length / 2) - 1);
  for (let offset = minOffset; offset < maxOffset; offset += 1) {
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

function resultColor(result) {
  if (result === "perfect") {
    return "#2FBF71";
  }
  if (result === "good") {
    return COLORS.softGold;
  }
  return "#C14953";
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

function normalizeChordLabel(label) {
  if (!label || typeof label !== "string") {
    return "";
  }

  const cleaned = label.trim().replace(/\s+/g, "");
  if (!cleaned) {
    return "";
  }

  const lower = cleaned.toLowerCase();
  const aliasMap = {
    em: "em",
    e: "e",
    aminor: "am",
    am: "am",
    a: "a"
  };

  if (aliasMap[lower]) {
    return aliasMap[lower];
  }

  // Convert common textual variants like "E minor" or "A minor"
  const textMatch = cleaned.match(/^([a-g](?:#|b)?)(minor|maj|min|major)?$/i);
  if (!textMatch) {
    return lower;
  }

  const root = textMatch[1].toLowerCase();
  const quality = (textMatch[2] || "").toLowerCase();
  if (quality === "minor" || quality === "min") {
    return `${root}m`;
  }
  return root;
}

function chordNameToPitchClasses(chordName) {
  if (!chordName || typeof chordName !== "string") {
    return [];
  }

  const cleaned = chordName.trim();
  if (!cleaned || cleaned.toUpperCase() === "N") {
    return [];
  }

  const match = cleaned.match(/^([A-G](?:#|b)?)(.*)$/i);
  if (!match) {
    return [];
  }

  const rootRaw = match[1].replace("♯", "#").replace("♭", "b");
  const qualityRaw = (match[2] || "").toLowerCase();
  const rootMap = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    Fb: 4,
    "E#": 5,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
    Cb: 11,
    "B#": 0
  };
  const root = rootMap[rootRaw[0].toUpperCase() + (rootRaw.slice(1) || "")];

  if (typeof root !== "number") {
    return [];
  }

  const isMinor = /^m(?!aj)/.test(qualityRaw) || qualityRaw.includes("min");
  const intervals = isMinor ? [0, 3, 7] : [0, 4, 7];

  if (qualityRaw.includes("maj7")) {
    intervals.push(11);
  } else if (qualityRaw.includes("7")) {
    intervals.push(10);
  }

  return [...new Set(intervals.map((interval) => (root + interval + 12) % 12))];
}

function pickPreferredChord(chords, expectedChordLabel) {
  const list = Array.isArray(chords) ? chords : [];
  if (list.length === 0) {
    return null;
  }

  const normalizedExpected = normalizeChordLabel(expectedChordLabel);
  const expectedPitchClasses = chordNameToPitchClasses(expectedChordLabel);

  const scored = list.map((item) => {
    const detectedLabel = normalizeChordLabel(item?.chord);
    const detectedPitchClasses = chordNameToPitchClasses(item?.chord);
    const overlap = expectedPitchClasses.filter((pc) => detectedPitchClasses.includes(pc)).length;
    const confidence = Number(item?.confidence) || 0;

    let score = confidence;
    if (detectedLabel && detectedLabel === normalizedExpected) {
      score += 100;
    } else if (expectedPitchClasses.length > 0 && overlap > 0) {
      score += overlap * 10;
      score += detectedPitchClasses.length === expectedPitchClasses.length ? 5 : 0;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

function getChordMiniBaseUrlCandidates() {
  const candidates = [
    CHORD_MINI_PROXY_BASE_URL,
    CHORD_MINI_LOCAL_DEFAULT_BASE_URL,
    CHORD_MINI_LAN_FALLBACK_BASE_URL
  ];

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (host) {
      const hostBaseUrl = `http://${host}:5002`;
      if (!candidates.includes(hostBaseUrl)) {
        candidates.unshift(hostBaseUrl);
      }
    }
  }

  return candidates;
}

function mergeFloatChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function encodeWavBlob(float32Samples, sampleRate) {
  const pcm16 = new Int16Array(float32Samples.length);
  for (let i = 0; i < float32Samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Samples[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcm16.length * 2, true);

  for (let i = 0; i < pcm16.length; i += 1) {
    view.setInt16(44 + i * 2, pcm16[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function trimPcmRing(ring, maxMs, chunkMs) {
  const maxChunks = Math.max(1, Math.ceil(maxMs / chunkMs));
  if (ring.length > maxChunks) {
    ring.splice(0, ring.length - maxChunks);
  }
}

// Mini chord diagram for use in scrolling pills and info panels.
// shape: array of 6 objects (index 0 = low E string, 5 = high e), each { fret, muted? }
function ChordDiagram({ shape, label }) {
  if (!shape) {
    return <Text style={styles.notePillText}>{label}</Text>;
  }
  const STR_SPACING = 7;
  const FRET_SPACING = 9;
  const FRETS_SHOWN = 4;
  const numStrings = 6;
  const diagW = STR_SPACING * (numStrings - 1); // 35px
  const diagH = FRET_SPACING * FRETS_SHOWN;      // 36px
  const markerH = 10;
  const totalH = markerH + diagH;

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.chordDiagLabel}>{label}</Text>
      <View style={{ width: diagW + 2, height: totalH }}>
        {/* Open / muted markers above nut */}
        {shape.map((s, i) => {
          const x = i * STR_SPACING - 2;
          if (s.muted) return <Text key={i} style={[styles.chordDiagMarker, { left: x }]}>×</Text>;
          if (s.fret === 0) return <Text key={i} style={[styles.chordDiagMarker, { left: x }]}>○</Text>;
          return null;
        })}
        {/* Nut + fret lines */}
        {Array.from({ length: FRETS_SHOWN + 1 }).map((_, f) => (
          <View key={f} style={{
            position: "absolute", left: 0,
            top: markerH + f * FRET_SPACING,
            width: diagW, height: f === 0 ? 2 : 1,
            backgroundColor: f === 0 ? "#ccc" : "#555"
          }} />
        ))}
        {/* String lines */}
        {Array.from({ length: numStrings }).map((_, i) => (
          <View key={i} style={{
            position: "absolute", left: i * STR_SPACING,
            top: markerH, width: 1, height: diagH,
            backgroundColor: "#666"
          }} />
        ))}
        {/* Finger dots */}
        {shape.map((s, i) => {
          if (s.muted || s.fret === 0) return null;
          return (
            <View key={i} style={{
              position: "absolute",
              left: i * STR_SPACING - 4,
              top: markerH + (s.fret - 0.5) * FRET_SPACING - 4,
              width: 9, height: 9, borderRadius: 5,
              backgroundColor: COLORS.softGold
            }} />
          );
        })}
      </View>
    </View>
  );
}

function PathDots({ from, to, unlocked }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dotSize = 10;
  const spacing = 20;
  const edge = 46;
  const count = Math.floor(Math.max(0, dist - edge * 2) / spacing);
  if (count < 1) {
    return null;
  }
  const color = unlocked ? "#5C4512" : "#242424";
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const t = (edge + index * spacing + spacing / 2) / dist;
        return (
          <View
            key={index}
            style={{
              position: "absolute",
              left: from.x + dx * t - dotSize / 2,
              top: from.y + dy * t - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color
            }}
          />
        );
      })}
    </>
  );
}

function ModuleNode({ mod, nodeState, center, size, onPress }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (nodeState !== "available") {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.1, duration: 650, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1.0, duration: 650, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nodeState, anim]);

  const bgColor = nodeState === "locked" ? "#1C1C1C" : nodeState === "completed" ? "#132613" : "#0C2B0C";
  const borderColor = nodeState === "locked" ? "#303030" : nodeState === "completed" ? COLORS.softGold : "#2FBF71";
  const glowColor = nodeState === "locked" ? "transparent" : nodeState === "completed" ? COLORS.softGold : "#2FBF71";
  const icon = nodeState === "locked" ? "🔒" : nodeState === "completed" ? "✅" : mod.emoji;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: center.x - size / 2,
        top: center.y - size / 2,
        transform: [{ scale: anim }],
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: nodeState !== "locked" ? 0.85 : 0,
        shadowRadius: 16,
        elevation: nodeState !== "locked" ? 10 : 2
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: nodeState === "available" ? 4 : 3,
          borderColor,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ fontSize: nodeState === "locked" ? 24 : 30 }}>{icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

function NodeLabel({ mod, nodeState, stars, center, nodeSize, screenWidth }) {
  const labelWidth = 120;
  const left = Math.max(6, Math.min(center.x - labelWidth / 2, screenWidth - labelWidth - 6));
  return (
    <View
      style={{
        position: "absolute",
        left,
        top: center.y + nodeSize / 2 + 10,
        width: labelWidth,
        alignItems: "center"
      }}
    >
      <Text style={{ color: nodeState === "locked" ? "#3A3A3A" : COLORS.white, fontWeight: "700", fontSize: 13, textAlign: "center" }}>
        {mod.title}
      </Text>
      <Text style={{ color: nodeState === "locked" ? "#2C2C2C" : "#ADADAD", fontSize: 11, textAlign: "center" }}>
        {mod.subtitle}
      </Text>
      {nodeState === "completed" && stars > 0 && (
        <Text style={{ color: COLORS.softGold, fontSize: 14, marginTop: 3 }}>
          {"★".repeat(stars)}{"☆".repeat(3 - stars)}
        </Text>
      )}
      {nodeState === "available" && (
        <View style={{ marginTop: 4, borderWidth: 1, borderColor: "#2FBF71", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
          <Text style={{ color: "#2FBF71", fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>START</Text>
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
  const nodeSize = 80;
  const half = nodeSize / 2;
  const sidePad = 28;
  const leftX = sidePad + half;
  const rightX = width - sidePad - half;

  const unlockedIds = getUnlockedIds(modules, completedModules);

  const nodeCenters = modules.map((_, index) => ({
    x: index % 2 === 0 ? rightX : leftX,
    y: 70 + index * 180
  }));

  const totalHeight = nodeCenters.length > 0 ? nodeCenters[nodeCenters.length - 1].y + half + 110 : 300;
  const earnedStars = modules.reduce((sum, moduleItem) => sum + (completedModules[moduleItem.id]?.stars || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
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
        {modules.slice(0, -1).map((moduleItem, index) => (
          <PathDots
            key={`d${index}`}
            from={nodeCenters[index]}
            to={nodeCenters[index + 1]}
            unlocked={unlockedIds.includes(moduleItem.id)}
          />
        ))}
        {modules.map((moduleItem, index) => {
          const center = nodeCenters[index];
          const isUnlocked = unlockedIds.includes(moduleItem.id);
          const isCompleted = !!completedModules[moduleItem.id];
          const nodeState = !isUnlocked ? "locked" : isCompleted ? "completed" : "available";
          return (
            <ModuleNodeWithLabel
              key={moduleItem.id}
              mod={moduleItem}
              nodeState={nodeState}
              stars={completedModules[moduleItem.id]?.stars || 0}
              center={center}
              nodeSize={nodeSize}
              screenWidth={width}
              onPress={() => onSelectModule(moduleItem, nodeState)}
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
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={tabSt.tab} onPress={() => onTabChange(tab.id)}>
            {active && <View style={tabSt.indicator} />}
            <Text style={[tabSt.tabEmoji, active && tabSt.tabEmojiActive]}>{tab.emoji}</Text>
            <Text style={[tabSt.tabLabel, active && tabSt.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TuningScreen({ onBack }) {
  const [micStatus, setMicStatus] = useState("idle");
  const [liveNote, setLiveNote] = useState(null);
  const [liveFreq, setLiveFreq] = useState(null);
  const [liveCents, setLiveCents] = useState(0);
  const [recentNotes, setRecentNotes] = useState([]);
  const webStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analysisTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (webStreamRef.current) webStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startMic() {
    if (Platform.OS !== "web") {
      setMicStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      webStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const buf = new Float32Array(2048);
      analysisTimerRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        const { frequency, rms } = autoCorrelate(buf, ctx.sampleRate);
        if (rms < MIN_RMS || frequency <= 0) return;
        const midi = frequencyToMidi(frequency);
        if (midi === null) return;
        const name = midiToNoteName(midi);
        const cents = centsOff(frequency, midi);
        setLiveNote({ midi, name });
        setLiveFreq(frequency);
        setLiveCents(cents);
        setRecentNotes((prev) => [name, ...prev].slice(0, 16));
      }, 55);
      setMicStatus("listening");
    } catch {
      setMicStatus("error");
    }
  }

  const inTune = Math.abs(liveCents) < 15;
  const centsColor = inTune ? "#2FBF71" : Math.abs(liveCents) < 30 ? COLORS.softGold : "#C14953";
  const clampedCents = Math.max(-50, Math.min(50, liveCents));
  const leftFlex = 50 + clampedCents;
  const rightFlex = 50 - clampedCents;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.lessonHeading}>Chord Detector & Tuner</Text>
      </View>

      {micStatus !== "listening" && (
        <Pressable style={[styles.primaryButton, { marginTop: 20 }]} onPress={startMic}>
          <Text style={styles.primaryButtonText}>
            {micStatus === "unsupported" ? "Web Only (not supported on native)" : "Start Microphone"}
          </Text>
        </Pressable>
      )}
      {micStatus === "error" && (
        <Text style={styles.micErrorText}>Microphone access failed. Check permissions.</Text>
      )}

      <View style={styles.tunerDisplay}>
        <Text style={styles.tunerNoteText}>{liveNote ? liveNote.name : "—"}</Text>
        {liveFreq ? (
          <Text style={styles.tunerFreqText}>{(Math.round(liveFreq * 10) / 10).toFixed(1)} Hz</Text>
        ) : (
          <Text style={styles.tunerFreqText}>play a note</Text>
        )}
        {liveNote && (
          <View style={styles.tunerCentsWrap}>
            <View style={styles.tunerBar}>
              <View style={{ flex: leftFlex, height: "100%", backgroundColor: clampedCents < 0 ? centsColor : "transparent" }} />
              <View style={{ width: 3, height: "100%", backgroundColor: centsColor }} />
              <View style={{ flex: rightFlex, height: "100%", backgroundColor: clampedCents > 0 ? centsColor : "transparent" }} />
            </View>
            <View style={styles.tunerCentsRow}>
              <Text style={styles.tunerCentsLabel}>flat</Text>
              <Text style={[styles.tunerCentsLabel, { color: centsColor }]}>
                {clampedCents > 0 ? "+" : ""}{clampedCents}¢ {inTune ? "✓ in tune" : clampedCents < 0 ? "flat" : "sharp"}
              </Text>
              <Text style={styles.tunerCentsLabel}>sharp</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.guitarStringsWrap}>
        <Text style={styles.inputTitle}>String Indicator</Text>
        {GUITAR_STRINGS.slice().reverse().map((s, i) => {
          const active = liveNote !== null && liveNote.midi % 12 === s.pitchClass;
          return (
            <View key={i} style={styles.guitarStringRow}>
              <Text style={[styles.guitarStringLabel, active && styles.guitarStringLabelActive]}>{s.label}</Text>
              <View style={[styles.guitarStringLine, active && styles.guitarStringLineActive]} />
            </View>
          );
        })}
      </View>

      {recentNotes.length > 0 && (
        <View style={styles.recentNotesWrap}>
          <Text style={styles.inputTitle}>Recent Detections</Text>
          <Text style={styles.recentNotesText}>{recentNotes.join("  ")}</Text>
        </View>
      )}
    </View>
  );
}

function LandingScreen({ onLesson, onPractice, onTune, onBack }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Path</Text>
      </Pressable>

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

      <View style={styles.moduleCard}>
        <Text style={styles.moduleEmoji}>🎯</Text>
        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Chord Detector & Tuner</Text>
          <Text style={styles.moduleDesc}>Live pitch and note detection for tuning and chord checking.</Text>
          <Text style={styles.moduleTip}>Use this to warm up before lessons</Text>
        </View>
        <Pressable onPress={onTune} style={styles.moduleBtn}>
          <Text style={styles.moduleBtnText}>Open</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function LessonScreen({ onBack }) {
  const { width } = useWindowDimensions();
  const strumX = Math.max(72, width * 0.2);
  const [isRunning, setRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastJudgement, setLastJudgement] = useState(null);
  const [metronomeBpm, setMetronomeBpm] = useState(LESSON.bpm);
  const [judgements, setJudgements] = useState({});
  const [pulse] = useState(new Animated.Value(1));
  const [micStatus, setMicStatus] = useState("idle");
  const [micError, setMicError] = useState("");
  const [liveDetectedNote, setLiveDetectedNote] = useState("none");
  const [liveDetectedChord, setLiveDetectedChord] = useState("none");
  const [liveDetectedMidis, setLiveDetectedMidis] = useState([]);
  const [liveFrequency, setLiveFrequency] = useState(null);
  const [detectionMode, setDetectionMode] = useState("chordmini-local");
  const noteAccumulatorRef = useRef([]);
  const sessionLogRef = useRef([]);
  const currentTimeRef = useRef(0);
  const webStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analysisTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const backendRequestInFlightRef = useRef(false);
  const chordMiniRateLimitUntilRef = useRef(0);
  const chordMiniLastStrumAtRef = useRef(0);
  const chordMiniLastUploadAtRef = useRef(0);
  const chordMiniUploadTimerRef = useRef(null);
  const chordMiniProcessorRef = useRef(null);
  const chordMiniSilentGainRef = useRef(null);
  const chordMiniPcmRingRef = useRef([]);
  const chordMiniBaseUrlRef = useRef(CHORD_MINI_LOCAL_DEFAULT_BASE_URL);
  const nativeRecordingRef = useRef(null);
  const activeModeRef = useRef(null);
  // Per-target dwell-time vote accumulator: { [targetId]: { pcCounts, totalFrames, bestDelta } }
  const targetVotesRef = useRef({});
  // Mirror of judgements state for reading inside effects without stale-closure issues
  const judgementsRef = useRef({});

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
    currentTimeRef.current = currentTime;
  }, [currentTime]);

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

  // Keep judgementsRef in sync so the evaluation effect below can read the
  // current state without creating a stale-closure dependency.
  useEffect(() => {
    judgementsRef.current = judgements;
  }, [judgements]);

  // Window-close evaluation: fires every time currentTime advances.
  // For each target whose MISS_WINDOW has just passed, compute the result
  // from the dwell-time vote accumulator and finalise the judgement.
  useEffect(() => {
    if (!isRunning || micStatus !== "listening") return;

    const toJudge = LESSON.targets.filter(
      (t) => !judgementsRef.current[t.id] && currentTime > t.time + MISS_WINDOW
    );
    if (toJudge.length === 0) return;

    const newJudgements = { ...judgementsRef.current };
    let lastJ = null;

    for (const target of toJudge) {
      const votes = targetVotesRef.current[target.id];
      let judged;

      if (votes && votes.totalFrames >= 2) {
        // Only credit pitch classes heard in more than 15% of detection frames
        const majorityMidis = Object.entries(votes.pcCounts)
          .filter(([, count]) => count / votes.totalFrames >= 0.32)
          .map(([pc]) => Number(pc) + 60);
        const { result, coverage } = classifyHit(votes.bestDelta, target.midiNotes, majorityMidis);
        judged = { result, delta: votes.bestDelta, detected: majorityMidis };
        sessionLogRef.current.push({
          type: "evaluation",
          method: "dwell",
          lessonTime: Number(currentTime.toFixed(3)),
          targetLabel: getTargetLabel(target),
          targetTime: Number(target.time.toFixed(3)),
          bestDelta: Number(votes.bestDelta.toFixed(3)),
          coverage: Number(coverage.toFixed(2)),
          frames: votes.totalFrames,
          majorityNotes: majorityMidis.map((m) => midiToNoteName(m)),
          expected: target.noteNames,
          result
        });
      } else {
        judged = { result: "miss", delta: null, detected: [] };
      }

      newJudgements[target.id] = judged;
      lastJ = { result: judged.result, label: getTargetLabel(target), delta: judged.delta, detected: judged.detected };
    }

    setJudgements(newJudgements);
    if (lastJ) setLastJudgement(lastJ);
  }, [currentTime, isRunning, micStatus]);

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
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        } catch {
          // no-op
        }
        mediaRecorderRef.current = null;
      }
      if (chordMiniUploadTimerRef.current) {
        clearInterval(chordMiniUploadTimerRef.current);
        chordMiniUploadTimerRef.current = null;
      }
      if (chordMiniProcessorRef.current) {
        try {
          chordMiniProcessorRef.current.disconnect();
        } catch {
          // no-op
        }
        chordMiniProcessorRef.current = null;
      }
      if (chordMiniSilentGainRef.current) {
        try {
          chordMiniSilentGainRef.current.disconnect();
        } catch {
          // no-op
        }
        chordMiniSilentGainRef.current = null;
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


  function exportLog() {
    const payload = {
      session: new Date().toISOString(),
      lesson: LESSON.id,
      totalTargets: LESSON.targets.length,
      events: sessionLogRef.current
    };
    const json = JSON.stringify(payload, null, 2);
    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ztk_session_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      console.log("SESSION LOG:\n" + json);
    }
  }

  function restartLesson() {
    setCurrentTime(0);
    setJudgements({});
    setLastJudgement(null);
    setRunning(false);
    sessionLogRef.current = [];
    targetVotesRef.current = {};
  }

  function appendVotesForOpenTargets(detectedMidis, repeatCount = 1) {
    if (!Array.isArray(detectedMidis) || detectedMidis.length === 0) {
      return;
    }
    const lessonNow = currentTimeRef.current;
    for (const target of LESSON.targets) {
      const delta = Math.abs(lessonNow - target.time);
      if (delta <= MISS_WINDOW) {
        if (!targetVotesRef.current[target.id]) {
          targetVotesRef.current[target.id] = { pcCounts: {}, totalFrames: 0, bestDelta: Infinity };
        }
        const entry = targetVotesRef.current[target.id];
        entry.totalFrames += Math.max(1, repeatCount);
        entry.bestDelta = Math.min(entry.bestDelta, delta);
        const passes = Math.max(1, repeatCount);
        for (let pass = 0; pass < passes; pass += 1) {
          for (const midi of detectedMidis) {
            const pitchClass = midi % 12;
            entry.pcCounts[pitchClass] = (entry.pcCounts[pitchClass] || 0) + 1;
          }
        }
      }
    }
  }

  function getCurrentLessonTarget() {
    const lessonNow = currentTimeRef.current;
    let bestTarget = null;
    let bestDelta = Infinity;

    for (const target of LESSON.targets) {
      const delta = Math.abs(lessonNow - target.time);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestTarget = target;
      }
    }

    return bestTarget;
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
        // Already running the same mode — nothing to do
        if (webStreamRef.current && activeModeRef.current === detectionMode) {
          setMicStatus("listening");
          return;
        }
        // Stop existing detection timer when switching modes
        if (analysisTimerRef.current) {
          clearInterval(analysisTimerRef.current);
          analysisTimerRef.current = null;
        }
        if (mediaRecorderRef.current) {
          try {
            if (mediaRecorderRef.current.state !== "inactive") {
              mediaRecorderRef.current.stop();
            }
          } catch {
            // no-op
          }
          mediaRecorderRef.current = null;
        }
        if (chordMiniUploadTimerRef.current) {
          clearInterval(chordMiniUploadTimerRef.current);
          chordMiniUploadTimerRef.current = null;
        }
        if (chordMiniProcessorRef.current) {
          try {
            chordMiniProcessorRef.current.disconnect();
          } catch {
            // no-op
          }
          chordMiniProcessorRef.current = null;
        }
        if (chordMiniSilentGainRef.current) {
          try {
            chordMiniSilentGainRef.current.disconnect();
          } catch {
            // no-op
          }
          chordMiniSilentGainRef.current = null;
        }
        backendRequestInFlightRef.current = false;
        chordMiniRateLimitUntilRef.current = 0;
        chordMiniLastStrumAtRef.current = 0;
        chordMiniLastUploadAtRef.current = 0;
        chordMiniPcmRingRef.current = [];
        // Acquire mic stream once; reuse on mode switches
        if (!webStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true
            }
          });
          webStreamRef.current = stream;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          setMicStatus("unsupported");
          setMicError("Web Audio API is unavailable in this browser.");
          return;
        }
        // Reuse AudioContext + Analyser across mode switches
        if (!audioContextRef.current) {
          const audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(webStreamRef.current);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
        }
        const activeContext = audioContextRef.current;
        const activeAnalyser = analyserRef.current;
        const sampleBuffer = new Float32Array(activeAnalyser.fftSize);

        if (detectionMode === "chordmini-local") {
          if (typeof MediaRecorder === "undefined") {
            setMicStatus("unsupported");
            setMicError("MediaRecorder is unavailable in this browser.");
            return;
          }

          if (
            Platform.OS === "web"
            && typeof window !== "undefined"
            && window.location?.protocol === "https:"
          ) {
            setMicStatus("error");
            setMicError(
              "Chord Mini backend is HTTP but app is HTTPS (mixed content blocked). Run web app over HTTP or expose backend via HTTPS."
            );
            return;
          }

          const candidateBaseUrls = getChordMiniBaseUrlCandidates();
          const healthErrors = [];
          let selectedBaseUrl = null;
          for (const baseUrl of candidateBaseUrls) {
            const healthUrl = `${baseUrl}${CHORD_MINI_HEALTH_PATH}`;
            try {
              console.log("[ChordMini] Health check", healthUrl);
              const healthResponse = await fetch(healthUrl, { method: "GET" });
              if (healthResponse.ok) {
                selectedBaseUrl = baseUrl;
                break;
              }
              healthErrors.push(`${healthUrl} -> HTTP ${healthResponse.status}`);
            } catch (healthError) {
              const message = healthError instanceof Error ? healthError.message : "Unknown error";
              healthErrors.push(`${healthUrl} -> ${message}`);
              console.error("[ChordMini] Health check failed", { healthUrl, error: healthError });
            }
          }

          if (!selectedBaseUrl) {
            setMicStatus("error");
            setMicError(
              `Unable to reach Chord Mini backend. Tried: ${healthErrors.join(" | ") || "none"}`
            );
            return;
          }
          chordMiniBaseUrlRef.current = selectedBaseUrl;
          console.log("[ChordMini] Using backend", selectedBaseUrl);

          const processorBufferSize = 4096;
          const processor = audioContextRef.current.createScriptProcessor(processorBufferSize, 1, 1);
          const silentGain = audioContextRef.current.createGain();
          silentGain.gain.value = 0;

          processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            chordMiniPcmRingRef.current.push(new Float32Array(input));
            trimPcmRing(chordMiniPcmRingRef.current, CHORD_MINI_RING_MAX_MS, (processorBufferSize / audioContextRef.current.sampleRate) * 1000);
          };

          const sourceNode = audioContextRef.current.createMediaStreamSource(webStreamRef.current);
          sourceNode.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(audioContextRef.current.destination);
          chordMiniProcessorRef.current = processor;
          chordMiniSilentGainRef.current = silentGain;

          analysisTimerRef.current = setInterval(() => {
            if (!analyserRef.current) {
              return;
            }
            analyserRef.current.getFloatTimeDomainData(sampleBuffer);
            let rms = 0;
            for (let i = 0; i < sampleBuffer.length; i += 1) {
              rms += sampleBuffer[i] * sampleBuffer[i];
            }
            rms = Math.sqrt(rms / sampleBuffer.length);
            if (rms >= CHORD_MINI_STRUM_RMS_THRESHOLD) {
              chordMiniLastStrumAtRef.current = Date.now();
            }
          }, CHORD_MINI_RMS_POLL_MS);
          chordMiniUploadTimerRef.current = setInterval(async () => {
            const now = Date.now();
            if (now < chordMiniRateLimitUntilRef.current) {
              return;
            }
            if (now - chordMiniLastUploadAtRef.current < CHORD_MINI_MIN_UPLOAD_GAP_MS) {
              return;
            }
            if (now - chordMiniLastStrumAtRef.current > CHORD_MINI_STRUM_WINDOW_MS) {
              return;
            }
            if (backendRequestInFlightRef.current) {
              return;
            }
            if (chordMiniPcmRingRef.current.length === 0) {
              return;
            }

            backendRequestInFlightRef.current = true;
            chordMiniLastUploadAtRef.current = now;
            try {
              const samples = mergeFloatChunks(chordMiniPcmRingRef.current);
              const sampleRate = audioContextRef.current.sampleRate;
              const wavBlob = encodeWavBlob(samples, sampleRate);
              const file = new File([wavBlob], `clip.wav`, { type: "audio/wav" });
              const form = new FormData();
              form.append("file", file);
              form.append("detector", "auto");
              const currentTarget = getCurrentLessonTarget();
              if (currentTarget) {
                form.append("expected_chord", getTargetLabel(currentTarget));
                form.append("expected_target_time", String(Number(currentTarget.time.toFixed(3))));
                form.append("expected_note_names", JSON.stringify(currentTarget.noteNames));
              }
              form.append("lesson_time", String(Number(currentTimeRef.current.toFixed(3))));
              const recognizeUrl = `${chordMiniBaseUrlRef.current}${CHORD_MINI_RECOGNIZE_PATH}`;
              const expectedChordLabel = currentTarget ? getTargetLabel(currentTarget) : "";
              const expectedNoteNamesStr = currentTarget ? JSON.stringify(currentTarget.noteNames) : "";
              console.log("[ChordMini] Uploading sample", {
                recognizeUrl,
                expectedChord: expectedChordLabel,
                lessonTime: Number(currentTimeRef.current.toFixed(3))
              });

              const response = await fetch(recognizeUrl, {
                method: "POST",
                body: form,
                headers: {
                  "X-Expected-Chord": expectedChordLabel,
                  "X-Expected-Target-Time": currentTarget ? String(Number(currentTarget.time.toFixed(3))) : "",
                  "X-Lesson-Time": String(Number(currentTimeRef.current.toFixed(3))),
                  "X-Expected-Note-Names": expectedNoteNamesStr
                }
              });
              const payload = await response.json().catch(() => ({}));

              if (!response.ok || payload?.success === false) {
                if (response.status === 429 || String(payload?.error || "").toLowerCase().includes("rate limit")) {
                  chordMiniRateLimitUntilRef.current = Date.now() + CHORD_MINI_RATE_LIMIT_BACKOFF_MS;
                  const waitSeconds = Math.ceil(CHORD_MINI_RATE_LIMIT_BACKOFF_MS / 1000);
                  setMicError(`Rate limited by backend. Backing off for ${waitSeconds}s (${recognizeUrl})`);
                  console.warn("[ChordMini] Rate limited", {
                    recognizeUrl,
                    status: response.status,
                    retryAfterMs: CHORD_MINI_RATE_LIMIT_BACKOFF_MS,
                    payload
                  });
                  return;
                }
                if (typeof payload?.error === "string") {
                  setMicError(`${payload.error} (${recognizeUrl})`);
                } else if (!response.ok) {
                  setMicError(`Chord Mini request failed (HTTP ${response.status}) at ${recognizeUrl}`);
                }
                console.error("[ChordMini] Recognize error", { recognizeUrl, status: response.status, payload });
                return;
              }

              const chords = Array.isArray(payload?.chords) ? payload.chords : [];
              if (chords.length === 0) {
                return;
              }

              const bestChord = pickPreferredChord(chords, currentTarget ? getTargetLabel(currentTarget) : "");
              if (!bestChord) {
                return;
              }
              const chordLabel = String(bestChord?.chord || "").trim();
              const normalizedDetectedChord = normalizeChordLabel(chordLabel);
              const normalizedExpectedChord = currentTarget ? normalizeChordLabel(getTargetLabel(currentTarget)) : "";
              const exactChordMatch = Boolean(normalizedExpectedChord && normalizedDetectedChord === normalizedExpectedChord);
              const chordPitchClasses = chordNameToPitchClasses(chordLabel);
              const chordMidis = chordPitchClasses.map((pitchClass) => pitchClass + 60);
              if (chordMidis.length === 0) {
                return;
              }

              setMicError("");
              setLiveDetectedNote(chordLabel || "none");
              setLiveDetectedChord(chordLabel || "none");
              setLiveFrequency(null);
              setLiveDetectedMidis(chordMidis);
              const frameMultiplier = exactChordMatch ? 10 : 4;
              sessionLogRef.current.push({
                type: "detection",
                mode: "chordmini-local",
                lessonTime: Number(currentTimeRef.current.toFixed(3)),
                chord: chordLabel,
                expectedChord: currentTarget ? getTargetLabel(currentTarget) : null,
                exactChordMatch,
                frameMultiplier,
                chordCandidates: chords.map((chord) => ({
                  chord: chord?.chord,
                  confidence: Number(chord?.confidence) || null
                })),
                confidence: Number(bestChord?.confidence) || null,
                modelUsed: payload?.model_used || payload?.model_name || null,
                accumulated: chordMidis.map((midi) => midiToNoteName(midi))
              });
              appendVotesForOpenTargets(chordMidis, frameMultiplier);
              console.log("[ChordMini] Votes appended", {
                chord: chordLabel,
                expected: currentTarget ? getTargetLabel(currentTarget) : null,
                exactMatch: exactChordMatch,
                frames: frameMultiplier,
                targetWindows: LESSON.targets.map((t) => ({
                  target: getTargetLabel(t),
                  targetTime: t.time,
                  currentTime: Number(currentTimeRef.current.toFixed(3)),
                  delta: Number(Math.abs(currentTimeRef.current - t.time).toFixed(3)),
                  isOpen: Math.abs(currentTimeRef.current - t.time) <= MISS_WINDOW
                }))
              });
            } catch (backendError) {
              const recognizeUrl = `${chordMiniBaseUrlRef.current}${CHORD_MINI_RECOGNIZE_PATH}`;
              console.error("[ChordMini] Recognize fetch failed", { recognizeUrl, error: backendError });
              setMicError(
                backendError instanceof Error
                  ? `${backendError.message} (${recognizeUrl})`
                  : `Chord Mini local recognition failed (${recognizeUrl}).`
              );
            } finally {
              backendRequestInFlightRef.current = false;
            }
          }, CHORD_MINI_UPLOAD_POLL_MS);
        } else if (detectionMode === "smartdetect") {
          const detector = PitchDetector.forFloat32Array(activeAnalyser.fftSize);
          analysisTimerRef.current = setInterval(() => {
            if (!analyserRef.current) return;
            analyserRef.current.getFloatTimeDomainData(sampleBuffer);
            const [pitch, clarity] = detector.findPitch(sampleBuffer, activeContext.sampleRate);
            if (clarity < 0.9 || pitch <= 0 || !Number.isFinite(pitch)) return;
            const midi = frequencyToMidi(pitch);
            // Guitar minimum is E2 = MIDI 40 (~82 Hz); reject subharmonics below that
            if (midi === null || midi < 40) return;
            const now = Date.now();
            noteAccumulatorRef.current.push({ midi, timestamp: now });
            noteAccumulatorRef.current = noteAccumulatorRef.current.filter((n) => now - n.timestamp < 400);
            const uniqueMidis = [...new Set(noteAccumulatorRef.current.map((n) => n.midi))];
            const noteNames = uniqueMidis.map((m) => midiToNoteName(m).replace(/\d+$/, ""));
            const chords = detectChord(noteNames);
            setLiveDetectedNote(chords[0] || midiToNoteName(midi));
            setLiveDetectedChord(chords[0] || "none");
            setLiveFrequency(pitch);
            setLiveDetectedMidis(uniqueMidis);
            sessionLogRef.current.push({
              type: "detection",
              mode: "smartdetect",
              lessonTime: Number(currentTimeRef.current.toFixed(3)),
              frequency: Math.round(pitch),
              midi,
              note: midiToNoteName(midi),
              chord: chords[0] || null,
              accumulated: uniqueMidis.map((m) => midiToNoteName(m))
            });
            appendVotesForOpenTargets(uniqueMidis);
          }, 55);
        } else {
          // Built-in autocorrelation — detection algorithm untouched
          analysisTimerRef.current = setInterval(() => {
            if (!analyserRef.current) {
              return;
            }
            analyserRef.current.getFloatTimeDomainData(sampleBuffer);
            const { frequency, rms } = autoCorrelate(sampleBuffer, activeContext.sampleRate);
            if (rms < MIN_RMS || frequency <= 0) {
              return;
            }
            const midi = frequencyToMidi(frequency);
            if (midi === null) {
              return;
            }
            // Accumulate notes over 400ms so chord coverage builds up across frames
            const now = Date.now();
            noteAccumulatorRef.current.push({ midi, timestamp: now });
            noteAccumulatorRef.current = noteAccumulatorRef.current.filter((n) => now - n.timestamp < 400);
            const uniqueMidis = [...new Set(noteAccumulatorRef.current.map((n) => n.midi))];
            setLiveDetectedNote(midiToNoteName(midi));
            setLiveDetectedChord("none");
            setLiveFrequency(frequency);
            setLiveDetectedMidis(uniqueMidis);
            sessionLogRef.current.push({
              type: "detection",
              mode: "builtin",
              lessonTime: Number(currentTimeRef.current.toFixed(3)),
              frequency: Math.round(frequency),
              midi,
              note: midiToNoteName(midi),
              accumulated: uniqueMidis.map((m) => midiToNoteName(m))
            });
            appendVotesForOpenTargets(uniqueMidis);
          }, 55);
        }
        activeModeRef.current = detectionMode;
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

      <View style={[styles.fretboard, { height: FB_H }]}> 
        <View style={[StyleSheet.absoluteFill, styles.fretboardBg]} />
        {Array.from({ length: 12 }, (_, fret) => (
          <View key={fret} style={[styles.fretDecor, { left: strumX + 28 + fret * 68 }]} />
        ))}

        {STRUM_GUIDE_STRINGS.map((stringDef, index) => (
          <View
            key={stringDef.id}
            style={[
              styles.stringTrack,
              {
                top: FB_STR_YS[index] - stringDef.thickness / 2,
                height: stringDef.thickness,
                backgroundColor: stringDef.color
              }
            ]}
          />
        ))}

        {STRUM_GUIDE_STRINGS.map((stringDef, index) => (
          <View key={`label-${stringDef.id}`} style={[styles.strLabel, { top: FB_STR_YS[index] - 10 }]}>
            <Text style={styles.strLabelText}>{stringDef.label}</Text>
          </View>
        ))}

        <View style={[styles.strumLine, { left: strumX }]} />
        <Animated.View
          style={[
            styles.strumBall,
            { left: strumX - 11, top: FB_H / 2 - 11, transform: [{ scale: pulse }] }
          ]}
        />

        {LESSON.targets.map((target) => {
          const x = strumX + (target.time - currentTime) * PIXELS_PER_SECOND - BLOCK_W / 2;
          if (x < -BLOCK_W - 10 || x > width + 10) {
            return null;
          }
          const judgement = judgements[target.id];
          const label = getTargetLabel(target);
          const active = CHORD_ACTIVE[label] ?? [true, true, true, true, true, true];
          const judgementColor = judgement ? resultColor(judgement.result) : null;
          const borderColor = judgementColor || COLORS.bronzeOlive;

          return (
            <View
              key={target.id}
              style={[
                styles.chordBlock,
                {
                  left: x,
                  top: BLOCK_TOP,
                  height: BLOCK_H,
                  width: BLOCK_W,
                  backgroundColor: judgementColor ? `${judgementColor}30` : "#261800",
                  borderColor
                }
              ]}
            >
              {STRUM_GUIDE_STRINGS.map((stringDef, index) =>
                active[index] ? (
                  <View
                    key={`${target.id}-${stringDef.id}`}
                    style={[
                      styles.chordDot,
                      {
                        position: "absolute",
                        top: FB_STR_YS[index] - BLOCK_TOP - 5,
                        left: BLOCK_W / 2 - 5,
                        backgroundColor: borderColor
                      }
                    ]}
                  />
                ) : (
                  <Text
                    key={`${target.id}-${stringDef.id}`}
                    style={[
                      styles.chordMuteX,
                      {
                        position: "absolute",
                        top: FB_STR_YS[index] - BLOCK_TOP - 9,
                        left: BLOCK_W / 2 - 6
                      }
                    ]}
                  >
                    ×
                  </Text>
                )
              )}
            </View>
          );
        })}

        {LESSON.targets.map((target) => {
          const x = strumX + (target.time - currentTime) * PIXELS_PER_SECOND - BLOCK_W / 2;
          if (x < -BLOCK_W - 10 || x > width + 10) {
            return null;
          }
          const judgement = judgements[target.id];
          const textColor = judgement ? resultColor(judgement.result) : COLORS.bronzeOlive;
          return (
            <Text key={`lbl-${target.id}`} style={[styles.chordLabelAbove, { left: x, color: textColor }]}>
              {getTargetLabel(target)}
            </Text>
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
        <Pressable style={styles.secondaryButton} onPress={exportLog}>
          <Text style={styles.secondaryButtonText}>Export Log</Text>
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
        <Pressable style={styles.tempoButton} onPress={() => setMetronomeBpm((v) => Math.max(20, v - 5))}>
          <Text style={styles.tempoButtonText}>-</Text>
        </Pressable>
        <Text style={styles.metaValue}>{metronomeBpm} BPM</Text>
        <Pressable style={styles.tempoButton} onPress={() => setMetronomeBpm((v) => Math.min(180, v + 5))}>
          <Text style={styles.tempoButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.detectionHeader}>
          <Text style={styles.inputTitle}>Realtime Detection</Text>
          <View style={styles.detectionSegmented}>
            {[
              { key: "builtin", label: "Built-in" },
              { key: "smartdetect", label: "Smart Detect" },
              { key: "chordmini-local", label: "Chord Mini (Local)" }
            ].map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.detectionSegmentBtn,
                  detectionMode === opt.key && styles.detectionSegmentBtnActive
                ]}
                onPress={() => setDetectionMode(opt.key)}
              >
                <Text style={[
                  styles.detectionSegmentText,
                  detectionMode === opt.key && styles.detectionSegmentTextActive
                ]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.inputHint}>
          Play your guitar when notes cross the pointer. Detected notes auto-trigger grading.
        </Text>
        <Text style={styles.liveChordText}>
          Detected chord: {liveDetectedChord}
        </Text>
        <Text style={styles.liveNoteText}>
          Live: {liveDetectedNote}{liveFrequency ? ` (${Math.round(liveFrequency)} Hz)` : ""}
        </Text>
        <View style={styles.stringBoardWrap}>
          {GUITAR_STRINGS.map((s, i) => {
            const active = liveDetectedMidis.some((m) => m % 12 === s.pitchClass);
            const isWound = i < 3;
            return (
              <View key={i} style={[styles.stringBoardRow, active && styles.stringBoardRowActive]}>
                <View style={[styles.stringBoardLabelBox, active && styles.stringBoardLabelBoxActive]}>
                  <Text style={[styles.stringBoardLabel, active && styles.stringBoardLabelActive]}>{s.label.slice(0, -1)}</Text>
                </View>
                <View style={styles.stringBoardTrack}>
                  <View
                    style={[
                      styles.stringBoardWire,
                      {
                        height: isWound ? 3 : 2,
                        backgroundColor: isWound ? "#c4913a" : "#d8d8d8",
                        opacity: active ? 1 : 0.55
                      }
                    ]}
                  />
                  {active && <View style={styles.stringBoardPulse} />}
                </View>
                <View style={[styles.stringBoardStatus, active && styles.stringBoardStatusActive]}>
                  <Text style={styles.stringBoardStatusIcon}>{active ? "✓" : "·"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.debugList}>
        <Text style={styles.metaLabel}>Progress {stats.judged}/{LESSON.targets.length}</Text>
        {lastJudgement ? (
          <Text style={styles.lastHit}>
            Last: {lastJudgement.label} {lastJudgement.result.toUpperCase()} ({typeof lastJudgement.delta === "number" ? `${lastJudgement.delta.toFixed(3)}s` : "n/a"})
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
  const [screen, setScreen] = useState("path");
  const [activeTab, setActiveTab] = useState("learn");
  const [selectedModule, setSelectedModule] = useState(null);
  const [completedModules, setCompletedModules] = useState({});

  const currentTabConfig = TABS.find((tab) => tab.id === activeTab) || TABS[0];
  const currentModules = modulesForTab(activeTab);

  function recordCompletion(moduleId, stars) {
    setCompletedModules((prev) => ({
      ...prev,
      [moduleId]: { stars: Math.max(stars, prev[moduleId]?.stars || 0) }
    }));
  }

  function handleSelectModule(mod, nodeState) {
    if (nodeState === "locked") {
      const tabModules = modulesForTab(activeTab);
      const index = tabModules.findIndex((item) => item.id === mod.id);
      const previous = index > 0 ? tabModules[index - 1] : null;
      Alert.alert(
        "🔒 Locked",
        previous ? `Complete \"${previous.title}\" to unlock this.` : "Complete the previous lesson first.",
        [{ text: "Got it" }]
      );
      return;
    }

    if (!mod.hasRealLesson) {
      const message = nodeState === "available"
        ? `You've unlocked ${mod.title}! This lesson is coming soon.`
        : `${mod.title} is on its way — keep playing!`;
      Alert.alert("🚧 Coming Soon", message, [{ text: "OK" }]);
      return;
    }

    setSelectedModule(mod);
    setScreen("landing");
  }

  function handleLessonBack() {
    if (selectedModule) {
      recordCompletion(selectedModule.id, 1);
    }
    setScreen("path");
  }

  function handlePracticeBack() {
    if (selectedModule) {
      recordCompletion(selectedModule.id, 1);
    }
    setScreen("path");
  }

  return (
    <SafeAreaView style={styles.safe}>
      {screen === "path" ? (
        <>
          <PathScreen
            modules={currentModules}
            tabConfig={currentTabConfig}
            completedModules={completedModules}
            onSelectModule={handleSelectModule}
          />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      ) : screen === "landing" ? (
        <LandingScreen
          onLesson={() => setScreen("lesson")}
          onPractice={() => setScreen("practice")}
          onTune={() => setScreen("tuning")}
          onBack={() => setScreen("path")}
        />
      ) : screen === "tuning" ? (
        <TuningScreen onBack={() => setScreen("landing")} />
      ) : screen === "practice" ? (
        <StringPractice onBack={handlePracticeBack} />
      ) : (
        <LessonScreen onBack={handleLessonBack} />
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const pathSt = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E"
  },
  worldLabel: {
    color: COLORS.softGold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2
  },
  worldTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2
  },
  starsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  starIcon: {
    color: COLORS.softGold,
    fontSize: 16
  },
  starsCount: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14
  }
});

const tabSt = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#0D0D0D",
    borderTopWidth: 1,
    borderTopColor: "#1E1E1E",
    paddingBottom: 4
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    position: "relative"
  },
  indicator: {
    position: "absolute",
    top: 0,
    left: "25%",
    right: "25%",
    height: 2,
    backgroundColor: COLORS.softGold,
    borderRadius: 1
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.4
  },
  tabEmojiActive: {
    opacity: 1
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "#555"
  },
  tabLabelActive: {
    color: COLORS.softGold
  }
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  backButton: {
    marginTop: 8,
    marginBottom: 4,
    alignSelf: "flex-start"
  },
  backButtonText: {
    color: COLORS.softGold,
    fontWeight: "600",
    fontSize: 15
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
  modulesHeading: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 12
  },
  moduleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12
  },
  moduleEmoji: {
    fontSize: 28,
    marginTop: 2
  },
  moduleBody: {
    flex: 1,
    gap: 4
  },
  moduleTitle: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15
  },
  moduleDesc: {
    color: "#ADADAD",
    fontSize: 13,
    lineHeight: 18
  },
  moduleTip: {
    color: "#666",
    fontSize: 11
  },
  moduleBtn: {
    backgroundColor: COLORS.softGold,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: "center"
  },
  moduleBtnText: {
    color: COLORS.black,
    fontWeight: "700"
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
  fretboard: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden"
  },
  fretboardBg: {
    backgroundColor: "#1a0e05"
  },
  fretDecor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#ffffff14"
  },
  stringTrack: {
    position: "absolute",
    left: 0,
    right: 0
  },
  strLabel: {
    position: "absolute",
    left: 4,
    width: 24,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#2d1a06",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10
  },
  strLabelText: {
    color: "#c4913a",
    fontSize: 10,
    fontWeight: "800"
  },
  strumLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: `${COLORS.softGold}cc`,
    zIndex: 5
  },
  strumBall: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.softGold,
    zIndex: 6
  },
  chordBlock: {
    position: "absolute",
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    zIndex: 4
  },
  chordLabelAbove: {
    position: "absolute",
    top: 5,
    width: BLOCK_W,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    zIndex: 8
  },
  chordDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  chordMuteX: {
    color: "#555",
    fontSize: 13,
    fontWeight: "900"
  },
  timelineFrame: {
    marginTop: 16,
    minHeight: 175,
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
    top: 65,
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
    top: 89,
    left: -18
  },
  notePill: {
    position: "absolute",
    top: 10,
    minWidth: 56,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 14
  },
  notePillText: {
    color: COLORS.black,
    fontWeight: "700",
    textAlign: "center"
  },
  chordDiagLabel: {
    color: COLORS.black,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2
  },
  chordDiagMarker: {
    position: "absolute",
    top: 0,
    color: "#555",
    fontSize: 8,
    fontWeight: "700"
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
  detectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  inputTitle: {
    color: COLORS.white,
    fontWeight: "700"
  },
  detectionSegmented: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.bronzeOlive,
    overflow: "hidden"
  },
  detectionSegmentBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10
  },
  detectionSegmentBtnActive: {
    backgroundColor: COLORS.bronzeOlive
  },
  detectionSegmentText: {
    color: COLORS.softGold,
    fontSize: 12,
    fontWeight: "600"
  },
  detectionSegmentTextActive: {
    color: COLORS.black,
    fontWeight: "700"
  },
  inputHint: {
    color: "#B5B5B5",
    fontSize: 12
  },
  liveChordText: {
    marginTop: 8,
    color: COLORS.white,
    fontWeight: "600"
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
  },
  notePillDetected: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    textAlign: "center",
    marginTop: 2
  },
  stringIndicatorRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10
  },
  stringIndicatorItem: {
    alignItems: "center",
    gap: 3
  },
  stringIndicatorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3a3a3a",
    borderWidth: 1,
    borderColor: "#5f5f5f"
  },
  stringIndicatorDotActive: {
    backgroundColor: COLORS.softGold,
    borderColor: COLORS.bronzeOlive
  },
  stringIndicatorLabel: {
    color: "#9f9f9f",
    fontSize: 9
  },
  stringBoardWrap: {
    marginTop: 10,
    gap: 6
  },
  stringBoardRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 8,
    gap: 8,
    backgroundColor: "#151515"
  },
  stringBoardRowActive: {
    backgroundColor: "#1e1c00"
  },
  stringBoardLabelBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a"
  },
  stringBoardLabelBoxActive: {
    borderColor: COLORS.softGold
  },
  stringBoardLabel: {
    color: "#9f9f9f",
    fontWeight: "800",
    fontSize: 13
  },
  stringBoardLabelActive: {
    color: COLORS.softGold
  },
  stringBoardTrack: {
    flex: 1,
    justifyContent: "center",
    position: "relative"
  },
  stringBoardWire: {
    borderRadius: 2
  },
  stringBoardPulse: {
    position: "absolute",
    left: 0,
    top: "28%",
    height: "44%",
    width: "100%",
    backgroundColor: "#F7DB7544",
    borderRadius: 2
  },
  stringBoardStatus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#444",
    alignItems: "center",
    justifyContent: "center"
  },
  stringBoardStatusActive: {
    backgroundColor: COLORS.softGold
  },
  stringBoardStatusIcon: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: "800"
  },
  tunerDisplay: {
    marginTop: 20,
    backgroundColor: "#1b1b1b",
    borderRadius: 16,
    padding: 20,
    alignItems: "center"
  },
  tunerNoteText: {
    color: COLORS.white,
    fontSize: 72,
    fontWeight: "700"
  },
  tunerFreqText: {
    color: "#9f9f9f",
    fontSize: 16,
    marginTop: 4
  },
  tunerCentsWrap: {
    width: "100%",
    marginTop: 16
  },
  tunerBar: {
    flexDirection: "row",
    height: 8,
    backgroundColor: "#3a3a3a",
    borderRadius: 4,
    overflow: "hidden"
  },
  tunerCentsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6
  },
  tunerCentsLabel: {
    color: "#9f9f9f",
    fontSize: 11
  },
  guitarStringsWrap: {
    marginTop: 16,
    backgroundColor: "#1b1b1b",
    borderRadius: 12,
    padding: 14
  },
  guitarStringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8
  },
  guitarStringLabel: {
    color: "#9f9f9f",
    fontSize: 13,
    width: 36
  },
  guitarStringLabelActive: {
    color: COLORS.softGold,
    fontWeight: "700"
  },
  guitarStringLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#3a3a3a",
    borderRadius: 2
  },
  guitarStringLineActive: {
    backgroundColor: COLORS.softGold
  },
  recentNotesWrap: {
    marginTop: 16,
    backgroundColor: "#1b1b1b",
    borderRadius: 12,
    padding: 14
  },
  recentNotesText: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 2
  }
});
