import React from "react";
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
  card:    "#1C1C1C",
  border:  "#2A2A2A",
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

// ─── Module data (20 modules × 5 exercises = 100 lessons) ────────────────────

const ALL_MODULES = [
  // === LEARN / TUTORIALS (ids 1–8) ===
  {
    id: 1, type: "tutorial", title: "Em & Am", subtitle: "Fundamentals", emoji: "🎸",
    hasRealLesson: true,
    desc: "Master the two most essential chords in Jewish music.",
    exercises: [
      { id: 1, title: "Watch & Learn",     emoji: "📹", desc: "Em & Am chord walkthrough video.", type: "video"    },
      { id: 2, title: "String Practice",   emoji: "🎸", desc: "Pluck each string one by one.",    type: "practice" },
      { id: 3, title: "Slow Chord Change", emoji: "🐢", desc: "Switch Em→Am at 40 BPM.",          type: "drill"    },
      { id: 4, title: "Speed Challenge",   emoji: "⚡", desc: "Em→Am at 80 BPM.",                 type: "drill"    },
      { id: 5, title: "Play-Along",        emoji: "🎵", desc: "Full song accompaniment.",          type: "lesson"   },
    ],
  },
  {
    id: 2, type: "tutorial", title: "G & D Chords", subtitle: "Open Position", emoji: "🎼",
    hasRealLesson: false,
    desc: "Two essential major chords that open up dozens of songs.",
    exercises: [
      { id: 1, title: "G Chord Shape",     emoji: "📹", desc: "Learn the open G major chord.",    type: "video"    },
      { id: 2, title: "D Chord Shape",     emoji: "📹", desc: "Learn the open D major chord.",    type: "video"    },
      { id: 3, title: "G → D Switch",      emoji: "🔄", desc: "Smooth chord transitions.",        type: "drill"    },
      { id: 4, title: "Four-Chord Loop",   emoji: "🔁", desc: "G D Em C progression.",            type: "drill"    },
      { id: 5, title: "Mini Song",         emoji: "🎵", desc: "Simple song using G and D.",        type: "lesson"   },
    ],
  },
  {
    id: 3, type: "tutorial", title: "Barre Chords", subtitle: "Level Up", emoji: "⭐",
    hasRealLesson: false,
    desc: "Unlock every key on the guitar with moveable shapes.",
    exercises: [
      { id: 1, title: "F Major Shape",     emoji: "📹", desc: "The foundational barre chord.",    type: "video"    },
      { id: 2, title: "Bm Shape",          emoji: "📹", desc: "Minor barre at the 2nd fret.",     type: "video"    },
      { id: 3, title: "Moving Barres",     emoji: "🎸", desc: "Slide shapes up and down.",        type: "drill"    },
      { id: 4, title: "Muting Technique",  emoji: "🤫", desc: "Clean up string buzz.",            type: "drill"    },
      { id: 5, title: "Barre Song",        emoji: "🎵", desc: "Full song with barre chords.",     type: "lesson"   },
    ],
  },
  {
    id: 4, type: "tutorial", title: "Power Chords", subtitle: "Rock Basics", emoji: "⚡",
    hasRealLesson: false,
    desc: "Two-finger chords that work in any genre.",
    exercises: [
      { id: 1, title: "E5 Shape",           emoji: "📹", desc: "Power chord on low E.",           type: "video"    },
      { id: 2, title: "A5 Shape",           emoji: "📹", desc: "Power chord on A string.",        type: "video"    },
      { id: 3, title: "Moving Power Chords",emoji: "🔄", desc: "Run through the neck.",           type: "drill"    },
      { id: 4, title: "Palm Muting",        emoji: "🤚", desc: "Percussive rock rhythm.",         type: "drill"    },
      { id: 5, title: "Power Riff",         emoji: "🎵", desc: "Classic rock-style riff.",        type: "lesson"   },
    ],
  },
  {
    id: 5, type: "tutorial", title: "Fingerpicking", subtitle: "Patterns", emoji: "🖐",
    hasRealLesson: false,
    desc: "Develop independence between your thumb and fingers.",
    exercises: [
      { id: 1, title: "Thumb & Index",     emoji: "📹", desc: "Basic two-finger pattern.",        type: "video"    },
      { id: 2, title: "Three-Finger",      emoji: "📹", desc: "Add the middle finger.",           type: "video"    },
      { id: 3, title: "Alternating Bass",  emoji: "🔄", desc: "Walking bass line.",               type: "drill"    },
      { id: 4, title: "Travis Picking",    emoji: "⚡", desc: "Classic country/folk pattern.",    type: "drill"    },
      { id: 5, title: "Full Pattern",      emoji: "🎵", desc: "Complete fingerpicking song.",     type: "lesson"   },
    ],
  },
  {
    id: 6, type: "tutorial", title: "Chord Theory", subtitle: "Why It Works", emoji: "📐",
    hasRealLesson: false,
    desc: "Understand the musical logic behind chord progressions.",
    exercises: [
      { id: 1, title: "The Major Scale",   emoji: "📹", desc: "Foundation of Western music.",     type: "video"    },
      { id: 2, title: "The Minor Scale",   emoji: "📹", desc: "Darker, emotional tones.",         type: "video"    },
      { id: 3, title: "Chord Building",    emoji: "🧱", desc: "Stack thirds to build chords.",    type: "drill"    },
      { id: 4, title: "Key Signatures",    emoji: "🔑", desc: "Which chords belong together.",    type: "drill"    },
      { id: 5, title: "Apply Theory",      emoji: "🎵", desc: "Write your own progression.",      type: "lesson"   },
    ],
  },
  {
    id: 7, type: "tutorial", title: "Jewish Modes", subtitle: "Freygish", emoji: "🕍",
    hasRealLesson: false,
    desc: "The distinctive scales of klezmer and Jewish prayer music.",
    exercises: [
      { id: 1, title: "Ahava Raba Scale",   emoji: "📹", desc: "The core Jewish mode.",           type: "video"    },
      { id: 2, title: "Phrygian Dominant",  emoji: "📹", desc: "Western name for Freygish.",      type: "video"    },
      { id: 3, title: "Freygish Melodies",  emoji: "🎸", desc: "Traditional modal phrases.",      type: "drill"    },
      { id: 4, title: "Klezmer Licks",      emoji: "🎻", desc: "Ornaments and expression.",       type: "drill"    },
      { id: 5, title: "Full Improvisation", emoji: "🎵", desc: "Free modal playing.",             type: "lesson"   },
    ],
  },
  {
    id: 8, type: "tutorial", title: "Advanced Techniques", subtitle: "Hammer-Ons & Pull-Offs", emoji: "🔥",
    hasRealLesson: false,
    desc: "Add legato fluidity to your playing.",
    exercises: [
      { id: 1, title: "Hammer-On Basics",  emoji: "📹", desc: "Sound notes without picking.",    type: "video"    },
      { id: 2, title: "Pull-Offs",         emoji: "📹", desc: "Descending legato technique.",     type: "video"    },
      { id: 3, title: "Slurs",             emoji: "🎸", desc: "Combine hammer-ons & pull-offs.", type: "drill"    },
      { id: 4, title: "Legato Lines",      emoji: "🌊", desc: "Smooth melodic phrases.",          type: "drill"    },
      { id: 5, title: "Speed Exercise",    emoji: "⚡", desc: "Build hammer-on speed.",           type: "lesson"   },
    ],
  },
  // === WORKOUTS (ids 9–14) ===
  {
    id: 9, type: "workout", title: "Chord Changes", subtitle: "Speed Drill", emoji: "⚡",
    hasRealLesson: false,
    desc: "Build lightning-fast transitions between common chords.",
    exercises: [
      { id: 1, title: "Em → Am Drill",     emoji: "🔄", desc: "100 reps at 60 BPM.",             type: "drill"    },
      { id: 2, title: "G → D Drill",       emoji: "🔄", desc: "100 reps at 60 BPM.",             type: "drill"    },
      { id: 3, title: "Four-Chord Loop",   emoji: "🔁", desc: "G D Em C at 80 BPM.",             type: "drill"    },
      { id: 4, title: "BPM Challenge",     emoji: "⚡", desc: "How fast can you go?",             type: "drill"    },
      { id: 5, title: "Endurance Round",   emoji: "🏋", desc: "5 minutes non-stop.",             type: "lesson"   },
    ],
  },
  {
    id: 10, type: "workout", title: "Strumming Patterns", subtitle: "Rhythm Training", emoji: "🥁",
    hasRealLesson: false,
    desc: "Master essential strumming patterns for any style.",
    exercises: [
      { id: 1, title: "Down-Down-Up",      emoji: "📹", desc: "Basic 3/4 strum.",                type: "video"    },
      { id: 2, title: "D-DU-UDU",          emoji: "📹", desc: "Classic 4/4 pattern.",            type: "video"    },
      { id: 3, title: "Reggae Offbeat",    emoji: "🏝", desc: "Upstroke-only groove.",           type: "drill"    },
      { id: 4, title: "Flamenco Rasgueado",emoji: "💃", desc: "Finger-roll strum.",              type: "drill"    },
      { id: 5, title: "Full Rhythm Set",   emoji: "🎵", desc: "All patterns in one song.",       type: "lesson"   },
    ],
  },
  {
    id: 11, type: "workout", title: "Scale Runs", subtitle: "Finger Strength", emoji: "🎯",
    hasRealLesson: false,
    desc: "Build the muscle memory and dexterity for fluid playing.",
    exercises: [
      { id: 1, title: "Major Scale",       emoji: "📹", desc: "Ascending & descending.",         type: "video"    },
      { id: 2, title: "Spider Exercise",   emoji: "🕷", desc: "Four-finger independence.",        type: "drill"    },
      { id: 3, title: "Chromatic Run",     emoji: "🎯", desc: "All 12 notes in sequence.",       type: "drill"    },
      { id: 4, title: "Two-Octave Scale",  emoji: "⬆", desc: "Full range of the neck.",          type: "drill"    },
      { id: 5, title: "Speed Challenge",   emoji: "⚡", desc: "Max BPM test.",                   type: "lesson"   },
    ],
  },
  {
    id: 12, type: "workout", title: "Fingerpicking Speed", subtitle: "Precision", emoji: "🖐",
    hasRealLesson: false,
    desc: "Develop speed and precision in your right hand.",
    exercises: [
      { id: 1, title: "Single String",     emoji: "📹", desc: "Alternate i & m on one string.", type: "video"    },
      { id: 2, title: "Two-String Alt.",   emoji: "🔄", desc: "Alternation across strings.",     type: "drill"    },
      { id: 3, title: "Arpeggio Pattern",  emoji: "🎸", desc: "p-i-m-a pattern.",                type: "drill"    },
      { id: 4, title: "Melody + Bass",     emoji: "🎵", desc: "Independent voices.",             type: "drill"    },
      { id: 5, title: "Full Speed Test",   emoji: "⚡", desc: "Max tempo challenge.",            type: "lesson"   },
    ],
  },
  {
    id: 13, type: "workout", title: "Rhythm Mastery", subtitle: "Syncopation", emoji: "🎵",
    hasRealLesson: false,
    desc: "Feel the pocket and play with rhythmic confidence.",
    exercises: [
      { id: 1, title: "Quarter Notes",     emoji: "📹", desc: "Solid rhythmic foundation.",      type: "video"    },
      { id: 2, title: "Eighth Notes",      emoji: "📹", desc: "Double the subdivision.",         type: "video"    },
      { id: 3, title: "Syncopation",       emoji: "🔀", desc: "Accents between the beats.",      type: "drill"    },
      { id: 4, title: "Mixed Rhythms",     emoji: "🎯", desc: "Quarter + eighth combos.",        type: "drill"    },
      { id: 5, title: "Poly Challenge",    emoji: "🧠", desc: "Two patterns at once.",           type: "lesson"   },
    ],
  },
  {
    id: 14, type: "workout", title: "Lead Expression", subtitle: "Vibrato & Bends", emoji: "🌊",
    hasRealLesson: false,
    desc: "Add emotion and soul to every note you play.",
    exercises: [
      { id: 1, title: "Vibrato Basics",    emoji: "📹", desc: "Oscillate the pitch naturally.", type: "video"    },
      { id: 2, title: "String Bending",    emoji: "📹", desc: "Push the string up a whole step.",type: "video"   },
      { id: 3, title: "Bends + Vibrato",   emoji: "🌊", desc: "Combine for blues feel.",         type: "drill"    },
      { id: 4, title: "Slides",            emoji: "🎸", desc: "Smooth position shifts.",         type: "drill"    },
      { id: 5, title: "Expression Combo",  emoji: "🎵", desc: "Full expressive solo.",           type: "lesson"   },
    ],
  },
  // === SONGS (ids 15–20) ===
  {
    id: 15, type: "song", title: "First Song", subtitle: "Put It Together", emoji: "🎤",
    hasRealLesson: false,
    desc: "Your very first complete song from start to finish.",
    exercises: [
      { id: 1, title: "Learn the Melody",  emoji: "📹", desc: "Note by note breakdown.",         type: "video"    },
      { id: 2, title: "Add Chords",        emoji: "🎸", desc: "Chord backing track.",            type: "practice" },
      { id: 3, title: "Full Arrangement",  emoji: "🎼", desc: "Melody + chords together.",       type: "drill"    },
      { id: 4, title: "Slow Play-Along",   emoji: "🐢", desc: "60% speed backing track.",        type: "drill"    },
      { id: 5, title: "Full Speed",        emoji: "🎵", desc: "Performance tempo.",              type: "lesson"   },
    ],
  },
  {
    id: 16, type: "song", title: "Wonderwall", subtitle: "Oasis", emoji: "🎶",
    hasRealLesson: false,
    desc: "The iconic 90s anthem that started many guitar journeys.",
    exercises: [
      { id: 1, title: "Intro Pattern",     emoji: "📹", desc: "The signature fingerpicking.",    type: "video"    },
      { id: 2, title: "Verse Chords",      emoji: "🎸", desc: "Em7 G Dsus4 A7sus4.",            type: "practice" },
      { id: 3, title: "Chorus",            emoji: "🎼", desc: "'Because maybe...'",              type: "drill"    },
      { id: 4, title: "Bridge",            emoji: "🌉", desc: "The middle section.",             type: "drill"    },
      { id: 5, title: "Full Song",         emoji: "🎵", desc: "All sections in sequence.",       type: "lesson"   },
    ],
  },
  {
    id: 17, type: "song", title: "Knockin' On Heaven's Door", subtitle: "Bob Dylan", emoji: "🚪",
    hasRealLesson: false,
    desc: "A timeless Dylan classic with a gentle open feel.",
    exercises: [
      { id: 1, title: "Main Progression",  emoji: "📹", desc: "G D Am7 intro.",                  type: "video"    },
      { id: 2, title: "Verse",             emoji: "🎸", desc: "Verse chord pattern.",             type: "practice" },
      { id: 3, title: "Chorus",            emoji: "🎼", desc: "The iconic 'Knock knock...'",     type: "drill"    },
      { id: 4, title: "Strumming Feel",    emoji: "🎵", desc: "Dylan's loose, open strum.",      type: "drill"    },
      { id: 5, title: "Full Song",         emoji: "🎵", desc: "Complete play-through.",           type: "lesson"   },
    ],
  },
  {
    id: 18, type: "song", title: "Yerushalayim Shel Zahav", subtitle: "Jerusalem of Gold", emoji: "🕍",
    hasRealLesson: false,
    desc: "Naomi Shemer's beloved Israeli anthem.",
    exercises: [
      { id: 1, title: "Melody Line",       emoji: "📹", desc: "Iconic opening phrase.",          type: "video"    },
      { id: 2, title: "Chord Backing",     emoji: "🎸", desc: "Accompaniment pattern.",          type: "practice" },
      { id: 3, title: "Full Arrangement",  emoji: "🎼", desc: "Melody & harmony together.",      type: "drill"    },
      { id: 4, title: "Slow Play-Along",   emoji: "🐢", desc: "Gentle tempo to feel it.",        type: "drill"    },
      { id: 5, title: "Full Song",         emoji: "🎵", desc: "Complete performance.",            type: "lesson"   },
    ],
  },
  {
    id: 19, type: "song", title: "Od Yishama", subtitle: "Jewish Wedding Classic", emoji: "💍",
    hasRealLesson: false,
    desc: "The joyful song sung at every Jewish wedding.",
    exercises: [
      { id: 1, title: "Main Theme",        emoji: "📹", desc: "The opening melody.",             type: "video"    },
      { id: 2, title: "Verse Chords",      emoji: "🎸", desc: "Chord sequence breakdown.",       type: "practice" },
      { id: 3, title: "Chorus Build",      emoji: "🎼", desc: "Building energy and joy.",        type: "drill"    },
      { id: 4, title: "Key Modulation",    emoji: "🔑", desc: "The lift at the bridge.",         type: "drill"    },
      { id: 5, title: "Full Song",         emoji: "🎵", desc: "Complete wedding performance.",   type: "lesson"   },
    ],
  },
  {
    id: 20, type: "song", title: "Hava Nagila", subtitle: "Traditional", emoji: "🎊",
    hasRealLesson: false,
    desc: "The quintessential Jewish celebration song.",
    exercises: [
      { id: 1, title: "Main Riff",         emoji: "📹", desc: "The iconic opening riff.",        type: "video"    },
      { id: 2, title: "Full Melody",       emoji: "🎸", desc: "Complete melodic line.",          type: "practice" },
      { id: 3, title: "Rhythm Pattern",    emoji: "🥁", desc: "Festive strum pattern.",          type: "drill"    },
      { id: 4, title: "Speed Build",       emoji: "⚡", desc: "Accelerando to full speed.",      type: "drill"    },
      { id: 5, title: "Full Festive",      emoji: "🎊", desc: "Full speed celebration version.", type: "lesson"   },
    ],
  },
];

// ─── Achievements ─────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: "first_strum",       emoji: "🪕", title: "First Strum",       desc: "Play your first clean chord.",       check: s => s.totalCompleted >= 1            },
  { id: "three_day_fire",    emoji: "🔥", title: "3-Day Fire",         desc: "Practice 3 days in a row.",         check: s => s.streak >= 3                    },
  { id: "kumzitz_starter",   emoji: "🎶", title: "Kumzitz Starter",    desc: "Play your first Jewish song.",       check: s => s.completedSongs >= 1            },
  { id: "kumzitz_leader",    emoji: "🎤", title: "Kumzitz Leader",     desc: "Play 5 full songs.",                 check: s => s.completedSongs >= 5            },
  { id: "niggun_master",     emoji: "🎼", title: "Niggun Master",      desc: "Learn 10 Jewish songs.",             check: s => s.totalCompleted >= 10           },
  { id: "seven_day_streak",  emoji: "🔥", title: "7-Day Streak",       desc: "Practice 7 days straight.",         check: s => s.streak >= 7                    },
  { id: "thirty_day_streak", emoji: "🌋", title: "30-Day Streak",      desc: "Practice for an entire month.",     check: s => s.streak >= 30                   },
  { id: "consistency_king",  emoji: "👑", title: "Consistency King",   desc: "Practice 50 sessions total.",       check: s => s.sessionCount >= 50             },
];

function computeAchievements(completedMods, sessionCount, streak) {
  const completedIds  = Object.keys(completedMods).map(Number);
  const songIds       = ALL_MODULES.filter(m => m.type === "song").map(m => m.id);
  const completedSongs = completedIds.filter(id => songIds.includes(id)).length;
  const stats = { totalCompleted: completedIds.length, completedSongs, sessionCount, streak };
  return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(stats) }));
}

// ─── Leaderboard mock data ────────────────────────────────────────────────────

const LEADERBOARD_MOCK = [
  { id: "l1", name: "Moshe L.",   avatar: "🎸", level: 47, stars: 203, streak: 42 },
  { id: "l2", name: "Rivka K.",   avatar: "🎵", level: 39, stars: 178, streak: 30 },
  { id: "l3", name: "Dani G.",    avatar: "🎼", level: 35, stars: 156, streak: 21 },
  { id: "l4", name: "Yosef M.",   avatar: "⭐", level: 28, stars: 134, streak: 14 },
  { id: "l5", name: "Sarah B.",   avatar: "🎤", level: 24, stars: 112, streak: 12 },
  { id: "l6", name: "Chana R.",   avatar: "🎵", level: 8,  stars: 44,  streak: 3  },
  { id: "l7", name: "Avraham D.", avatar: "🎼", level: 6,  stars: 31,  streak: 2  },
  { id: "l8", name: "Leah F.",    avatar: "🎸", level: 4,  stars: 18,  streak: 1  },
  { id: "l9", name: "Noam S.",    avatar: "⭐", level: 2,  stars: 7,   streak: 1  },
];

// ─── Tab / navigation data ────────────────────────────────────────────────────

const TABS = [
  { id: "learn",       label: "Learn",   emoji: "📖", world: "JOURNEY", title: "Zero To Kumziz"  },
  { id: "workouts",    label: "Train",   emoji: "⚡",  world: "GYM",     title: "Practice Drills" },
  { id: "songs",       label: "Songs",   emoji: "🎵",  world: "STAGE",   title: "Your Setlist"    },
  { id: "leaderboard", label: "Ranks",   emoji: "🏆",  world: null,      title: null              },
  { id: "profile",     label: "Profile", emoji: "👤",  world: null,      title: null              },
];

function modulesForTab(tabId) {
  if (tabId === "learn")    return ALL_MODULES.filter(m => m.type === "tutorial");
  if (tabId === "workouts") return ALL_MODULES.filter(m => m.type === "workout");
  if (tabId === "songs")    return ALL_MODULES.filter(m => m.type === "song");
  return [];
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
      shadowColor: glowColor, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: nodeState !== "locked" ? 0.85 : 0,
      shadowRadius: 16, elevation: nodeState !== "locked" ? 10 : 2,
    }}>
      <Pressable onPress={onPress} style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bgColor,
        borderWidth: nodeState === "available" ? 4 : 3, borderColor,
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
          const center      = nodeCenters[i];
          const isUnlocked  = unlockedIds.includes(mod.id);
          const isCompleted = !!completedModules[mod.id];
          const nodeState   = !isUnlocked ? "locked" : isCompleted ? "completed" : "available";
          return (
            <React.Fragment key={mod.id}>
              <ModuleNode
                mod={mod} nodeState={nodeState} center={center} size={NODE_SIZE}
                onPress={() => onSelectModule(mod, nodeState)}
              />
              <NodeLabel
                mod={mod} nodeState={nodeState} stars={completedModules[mod.id]?.stars || 0}
                center={center} nodeSize={NODE_SIZE} screenWidth={width}
              />
            </React.Fragment>
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

// ─── Module landing screen (Em & Am only) ────────────────────────────────────

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

// ─── Module detail screen (modules 2–20) ─────────────────────────────────────

const TYPE_LABEL = { video: "Video", practice: "Practice", drill: "Drill", lesson: "Play-Along" };

function ModuleDetailScreen({ mod, completedModules, onBack, onExercise }) {
  const isCompleted = !!completedModules[mod.id];
  const stars = completedModules[mod.id]?.stars || 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={mdSt.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Path</Text>
        </Pressable>
        <View style={mdSt.heroRow}>
          <View style={mdSt.emojiWrap}>
            <Text style={{ fontSize: 48 }}>{mod.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mdSt.title}>{mod.title}</Text>
            <Text style={mdSt.subtitle}>{mod.subtitle}</Text>
            {isCompleted && (
              <Text style={{ color: C.gold, fontSize: 20, marginTop: 4 }}>
                {"★".repeat(stars)}{"☆".repeat(3 - stars)}
              </Text>
            )}
          </View>
        </View>
        <Text style={mdSt.desc}>{mod.desc}</Text>
      </View>

      <Text style={mdSt.sectionHeading}>5 Exercises</Text>

      {mod.exercises.map((ex, idx) => (
        <Pressable key={ex.id} onPress={() => onExercise(ex)} style={mdSt.exRow}>
          <View style={mdSt.exNum}>
            <Text style={mdSt.exNumText}>{idx + 1}</Text>
          </View>
          <Text style={{ fontSize: 24, marginHorizontal: 12 }}>{ex.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={mdSt.exTitle}>{ex.title}</Text>
            <Text style={mdSt.exDesc}>{ex.desc}</Text>
          </View>
          <View style={mdSt.exBadge}>
            <Text style={mdSt.exBadgeText}>{TYPE_LABEL[ex.type] || ex.type}</Text>
          </View>
          <Text style={{ color: C.gold, fontSize: 18, marginLeft: 8 }}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Coming-soon exercise screen ──────────────────────────────────────────────

function ComingSoonScreen({ exercise, onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Pressable onPress={onBack} style={[styles.backButton, { position: "absolute", top: 16, left: 16 }]}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <Text style={{ fontSize: 64, marginBottom: 20 }}>{exercise.emoji}</Text>
      <Text style={{ color: C.white, fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>{exercise.title}</Text>
      <Text style={{ color: "#888", fontSize: 15, textAlign: "center", marginBottom: 32, lineHeight: 22 }}>{exercise.desc}</Text>
      <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: "center", width: "100%" }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🚧</Text>
        <Text style={{ color: C.gold, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>Coming Soon</Text>
        <Text style={{ color: "#666", fontSize: 13, textAlign: "center" }}>
          This exercise is in development. Keep practicing the unlocked content — more is on the way!
        </Text>
      </View>
    </View>
  );
}

// ─── Leaderboard screen ───────────────────────────────────────────────────────

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const LB_FILTERS  = ["All Time", "This Week", "Friends"];

function LeaderboardScreen({ completedModules }) {
  const [filter, setFilter] = useState("All Time");

  const userStars = Object.values(completedModules).reduce((s, m) => s + (m.stars || 0), 0);
  const userLevel = Math.max(1, Math.floor(userStars / 4) + 1);

  const userRow = { id: "me", name: "You", avatar: "🎸", level: userLevel, stars: userStars, streak: 0, isMe: true };

  const allPlayers = [...LEADERBOARD_MOCK, userRow]
    .sort((a, b) => b.stars - a.stars)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={lbSt.header}>
        <Text style={lbSt.title}>🏆 Leaderboard</Text>
        <Text style={lbSt.subtitle}>See how you stack up</Text>
      </View>

      <View style={lbSt.filterRow}>
        {LB_FILTERS.map(f => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[lbSt.filterBtn, filter === f && lbSt.filterBtnActive]}>
            <Text style={[lbSt.filterText, filter === f && lbSt.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
        {allPlayers.map(player => (
          <View key={player.id} style={[lbSt.row, player.isMe && lbSt.rowMe]}>
            <Text style={lbSt.rank}>
              {player.rank <= 3 ? RANK_MEDALS[player.rank - 1] : `#${player.rank}`}
            </Text>
            <View style={lbSt.avatar}>
              <Text style={{ fontSize: 22 }}>{player.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[lbSt.name, player.isMe && { color: C.gold }]}>
                {player.name}{player.isMe ? " (You)" : ""}
              </Text>
              <Text style={lbSt.meta}>Lvl {player.level} · {player.streak > 0 ? `🔥 ${player.streak}d streak` : "No streak yet"}</Text>
            </View>
            <View style={lbSt.starsWrap}>
              <Text style={lbSt.starsNum}>{player.stars}</Text>
              <Text style={lbSt.starIcon}>★</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Achievement detail modal ─────────────────────────────────────────────────

const SPARKLE_COLORS = [C.gold, "#FFFFFF", C.bronze, C.perfect, C.gold, "#FFFFFF", C.bronze, C.gold, "#FFFFFF", C.perfect, C.gold, C.bronze];

function AchievementModal({ achievement, onClose }) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale       = useRef(new Animated.Value(0.78)).current;
  const cardOpacity     = useRef(new Animated.Value(0)).current;
  const emojiPulse      = useRef(new Animated.Value(1)).current;
  const ring1           = useRef(new Animated.Value(0)).current;
  const ring2           = useRef(new Animated.Value(0)).current;
  const sparkles = useRef(
    Array.from({ length: 12 }, () => ({ anim: new Animated.Value(0), opacity: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(cardScale,       { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity,     { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    if (!achievement.earned) return;

    // Sparkle burst
    Animated.parallel(sparkles.map((s, i) =>
      Animated.sequence([
        Animated.delay(i * 18),
        Animated.parallel([
          Animated.timing(s.anim,    { toValue: 1, duration: 560, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(s.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(s.opacity, { toValue: 0, duration: 460, useNativeDriver: true }),
          ]),
        ]),
      ])
    )).start();

    // Expanding rings
    const ringLoop = (val, delay) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]));
    ringLoop(ring1, 0).start();
    ringLoop(ring2, 550).start();

    // Emoji pulse
    Animated.loop(Animated.sequence([
      Animated.timing(emojiPulse, { toValue: 1.09, duration: 750, useNativeDriver: true }),
      Animated.timing(emojiPulse, { toValue: 1,    duration: 750, useNativeDriver: true }),
    ])).start();
  }, []);

  function close() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardOpacity,     { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 0.88, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  const DIST = 88;

  return (
    <View style={achModalSt.overlay}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000000D0", opacity: backdropOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>

      <Animated.View style={[achModalSt.card, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
        {/* Emoji stage with rings + sparkles */}
        <View style={achModalSt.stage}>
          {achievement.earned && [ring1, ring2].map((r, i) => (
            <Animated.View key={i} style={[achModalSt.ring, {
              opacity:   r.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.65, 0] }),
              transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.4] }) }],
            }]} />
          ))}

          {achievement.earned && sparkles.map((s, i) => {
            const angle = (i / sparkles.length) * Math.PI * 2;
            return (
              <Animated.View key={i} style={[achModalSt.sparkle, {
                backgroundColor: SPARKLE_COLORS[i],
                opacity: s.opacity,
                transform: [
                  { translateX: s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * DIST] }) },
                  { translateY: s.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * DIST] }) },
                  { scale:      s.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1.5, 0.5] }) },
                ],
              }]} />
            );
          })}

          <Animated.View style={[
            achModalSt.emojiCircle,
            achievement.earned && achModalSt.emojiCircleEarned,
            { transform: [{ scale: emojiPulse }] },
          ]}>
            <Text style={{ fontSize: 60 }}>{achievement.earned ? achievement.emoji : "🔒"}</Text>
          </Animated.View>
        </View>

        <View style={[achModalSt.badge, !achievement.earned && achModalSt.badgeLocked]}>
          <Text style={[achModalSt.badgeText, !achievement.earned && { color: "#555", letterSpacing: 1 }]}>
            {achievement.earned ? "✦  UNLOCKED  ✦" : "LOCKED"}
          </Text>
        </View>

        <Text style={achModalSt.title}>{achievement.title}</Text>
        <Text style={achModalSt.desc}>{achievement.desc}</Text>

        {!achievement.earned && (
          <Text style={achModalSt.hint}>Keep playing to unlock this achievement.</Text>
        )}

        <Pressable onPress={close} style={[achModalSt.closeBtn, achievement.earned && achModalSt.closeBtnEarned]}>
          <Text style={[achModalSt.closeBtnText, achievement.earned && { color: C.black }]}>
            {achievement.earned ? "Nice!" : "OK"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────

function ProfileScreen({ completedModules, sessionCount }) {
  const [selectedAch, setSelectedAch] = useState(null);

  const achievements = computeAchievements(completedModules, sessionCount, 0);
  const totalStars   = Object.values(completedModules).reduce((s, m) => s + (m.stars || 0), 0);
  const totalModules = Object.keys(completedModules).length;
  const level        = Math.max(1, Math.floor(totalStars / 4) + 1);
  const xpInLevel    = (totalStars % 4);
  const earnedCount  = achievements.filter(a => a.earned).length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View style={prSt.hero}>
          <View style={prSt.avatarCircle}>
            <Text style={{ fontSize: 52 }}>🎸</Text>
          </View>
          <Text style={prSt.name}>Guitar Student</Text>
          <View style={prSt.levelBadge}>
            <Text style={prSt.levelText}>Level {level}</Text>
          </View>
          <View style={prSt.xpBar}>
            <View style={[prSt.xpFill, { width: `${(xpInLevel / 4) * 100}%` }]} />
          </View>
          <Text style={prSt.xpLabel}>{xpInLevel} / 4 XP to next level</Text>
        </View>

        {/* Stats row */}
        <View style={prSt.statsRow}>
          <View style={prSt.statBox}>
            <Text style={prSt.statVal}>{totalStars}</Text>
            <Text style={prSt.statLabel}>Stars</Text>
          </View>
          <View style={[prSt.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border }]}>
            <Text style={prSt.statVal}>{totalModules}</Text>
            <Text style={prSt.statLabel}>Modules</Text>
          </View>
          <View style={prSt.statBox}>
            <Text style={prSt.statVal}>{sessionCount}</Text>
            <Text style={prSt.statLabel}>Sessions</Text>
          </View>
        </View>

        {/* Achievements */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={prSt.sectionTitle}>Achievements</Text>
            <Text style={{ color: "#666", fontSize: 13 }}>{earnedCount} / {achievements.length}</Text>
          </View>

          <View style={prSt.achGrid}>
            {achievements.map(a => (
              <Pressable key={a.id} onPress={() => setSelectedAch(a)} style={[prSt.achCard, !a.earned && prSt.achCardLocked]}>
                <Text style={[prSt.achEmoji, !a.earned && { opacity: 0.25 }]}>{a.emoji}</Text>
                {a.earned && <View style={prSt.achDot} />}
                <Text style={[prSt.achTitle, !a.earned && { color: "#444" }]}>{a.title}</Text>
                <Text style={[prSt.achDesc,  !a.earned && { color: "#333" }]}>{a.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {selectedAch && (
        <AchievementModal achievement={selectedAch} onClose={() => setSelectedAch(null)} />
      )}
    </View>
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

// ─── Achievement toast ────────────────────────────────────────────────────────

function AchievementToast({ achievement, onDone, onPress }) {
  const slideY  = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;
  const timerRef = useRef(null);

  function dismiss(callback) {
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 120, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 220, useNativeDriver: true }),
    ]).start(() => { onDone(); callback?.(); });
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
    timerRef.current = setTimeout(() => dismiss(), 3200);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <Animated.View style={[toastSt.wrap, { opacity, transform: [{ translateY: slideY }, { scale }] }]}>
      <Pressable style={toastSt.pressable} onPress={() => dismiss(onPress)}>
        <View style={toastSt.shine} />
        <View style={toastSt.emojiWrap}>
          <Text style={{ fontSize: 38 }}>{achievement.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={toastSt.label}>Achievement Unlocked</Text>
          <Text style={toastSt.title}>{achievement.title}</Text>
          <Text style={toastSt.desc}>{achievement.desc}</Text>
        </View>
        <Text style={toastSt.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function App() {
  const [screen,           setScreen]           = useState("path");
  const [activeTab,        setActiveTab]        = useState("learn");
  const [selectedModule,   setSelectedModule]   = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [completedModules, setCompletedModules] = useState({});
  const [sessionCount,     setSessionCount]     = useState(0);
  const [earnedIds,        setEarnedIds]        = useState(new Set());
  const [toastAch,         setToastAch]         = useState(null);

  const isPathTab = ["learn", "workouts", "songs"].includes(activeTab);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    if (screen !== "path") setScreen("path");
  }

  function handleSelectModule(mod, nodeState) {
    if (nodeState === "locked") {
      const tabMods = modulesForTab(activeTab);
      const idx  = tabMods.findIndex(m => m.id === mod.id);
      const prev = idx > 0 ? tabMods[idx - 1] : null;
      Alert.alert("🔒 Locked", prev ? `Complete "${prev.title}" to unlock this.` : "Complete the previous lesson first.", [{ text: "Got it" }]);
      return;
    }
    setSelectedModule(mod);
    setScreen(mod.hasRealLesson ? "landing" : "module_detail");
  }

  function handleExercise(ex) {
    if (!selectedModule) return;
    // Module 1 exercise 1 → landing (has video), exercise 2 → practice
    if (selectedModule.hasRealLesson) {
      if (ex.id === 1) { setScreen("landing"); return; }
      if (ex.id === 2) { setScreen("practice"); return; }
    }
    setSelectedExercise(ex);
    setScreen("exercise");
  }

  function recordCompletion(moduleId, stars) {
    setCompletedModules(prev => {
      const next = { ...prev, [moduleId]: { stars: Math.max(stars, prev[moduleId]?.stars || 0) } };
      // Check for newly unlocked achievements
      const newAchs = computeAchievements(next, sessionCount + 1, 0);
      const newlyEarned = newAchs.find(a => a.earned && !earnedIds.has(a.id));
      if (newlyEarned) {
        setEarnedIds(s => { const n = new Set(s); n.add(newlyEarned.id); return n; });
        setToastAch(newlyEarned);
      }
      return next;
    });
    setSessionCount(prev => prev + 1);
  }

  function handleLessonFinish(stats) {
    if (!selectedModule) return;
    const stars = stats.score >= 9 ? 3 : stats.score >= 3 ? 2 : 1;
    recordCompletion(selectedModule.id, stars);
    setScreen("path");
  }

  function handlePracticeBack() {
    if (selectedModule) recordCompletion(selectedModule.id, 1);
    setScreen(selectedModule?.hasRealLesson ? "landing" : "path");
  }

  const currentTabConfig = TABS.find(t => t.id === activeTab);

  return (
    <SafeAreaView style={styles.safe}>
      {screen === "path" && (
        <>
          {isPathTab ? (
            <PathScreen
              modules={modulesForTab(activeTab)}
              tabConfig={currentTabConfig}
              completedModules={completedModules}
              onSelectModule={handleSelectModule}
            />
          ) : activeTab === "leaderboard" ? (
            <LeaderboardScreen completedModules={completedModules} />
          ) : (
            <ProfileScreen completedModules={completedModules} sessionCount={sessionCount} />
          )}
          <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </>
      )}

      {screen === "landing" && (
        <LandingScreen
          onLesson={()  => setScreen("lesson")}
          onPractice={() => setScreen("practice")}
          onBack={()    => setScreen("path")}
        />
      )}
      {screen === "lesson" && (
        <LessonScreen onFinish={handleLessonFinish} />
      )}
      {screen === "practice" && (
        <StringPractice onBack={handlePracticeBack} />
      )}
      {screen === "module_detail" && selectedModule && (
        <ModuleDetailScreen
          mod={selectedModule}
          completedModules={completedModules}
          onBack={() => setScreen("path")}
          onExercise={handleExercise}
        />
      )}
      {screen === "exercise" && selectedExercise && (
        <ComingSoonScreen
          exercise={selectedExercise}
          onBack={() => setScreen("module_detail")}
        />
      )}

      {toastAch && (
        <AchievementToast
          achievement={toastAch}
          onDone={() => setToastAch(null)}
          onPress={() => { setActiveTab("profile"); setScreen("path"); }}
        />
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
  worldLabel: { color: C.gold,  fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  worldTitle: { color: C.white, fontSize: 20, fontWeight: "700", marginTop: 2 },
  starsBox:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1A1A1A", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  starIcon:   { color: C.gold,  fontSize: 16 },
  starsCount: { color: C.white, fontWeight: "700", fontSize: 14 },
});

// ─── Tab bar styles ───────────────────────────────────────────────────────────

const tabSt = StyleSheet.create({
  bar:           { flexDirection: "row", backgroundColor: "#0D0D0D", borderTopWidth: 1, borderTopColor: "#1E1E1E", paddingBottom: 4 },
  tab:           { flex: 1, alignItems: "center", paddingVertical: 8, position: "relative" },
  indicator:     { position: "absolute", top: 0, left: "20%", right: "20%", height: 2, backgroundColor: C.gold, borderRadius: 1 },
  tabEmoji:      { fontSize: 18, opacity: 0.4 },
  tabEmojiActive:{ opacity: 1 },
  tabLabel:      { marginTop: 2, fontSize: 10, fontWeight: "600", color: "#555" },
  tabLabelActive:{ color: C.gold },
});

// ─── Module detail styles ─────────────────────────────────────────────────────

const mdSt = StyleSheet.create({
  header:        { padding: 20, paddingBottom: 0 },
  heroRow:       { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  emojiWrap:     { width: 80, height: 80, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  title:         { color: C.white, fontSize: 22, fontWeight: "800" },
  subtitle:      { color: "#888", fontSize: 14, marginTop: 2 },
  desc:          { color: "#ADADAD", fontSize: 14, lineHeight: 20, marginTop: 14, marginBottom: 8 },
  sectionHeading:{ color: C.white, fontSize: 17, fontWeight: "700", marginTop: 20, marginBottom: 8, paddingHorizontal: 20 },
  exRow:         { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  exNum:         { width: 28, height: 28, borderRadius: 14, backgroundColor: "#2A2A2A", alignItems: "center", justifyContent: "center" },
  exNumText:     { color: "#888", fontWeight: "700", fontSize: 13 },
  exTitle:       { color: C.white, fontWeight: "700", fontSize: 14 },
  exDesc:        { color: "#888", fontSize: 12, marginTop: 2 },
  exBadge:       { backgroundColor: "#2A2A2A", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  exBadgeText:   { color: "#888", fontSize: 10, fontWeight: "700" },
});

// ─── Leaderboard styles ───────────────────────────────────────────────────────

const lbSt = StyleSheet.create({
  header:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" },
  title:          { color: C.white, fontSize: 22, fontWeight: "800" },
  subtitle:       { color: "#888", fontSize: 13, marginTop: 2 },
  filterRow:      { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterBtn:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card },
  filterBtnActive:{ backgroundColor: C.gold },
  filterText:     { color: "#888", fontWeight: "600", fontSize: 13 },
  filterTextActive:{ color: C.black },
  row:            { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowMe:          { borderWidth: 1.5, borderColor: C.gold, backgroundColor: "#1A1600" },
  rank:           { width: 36, color: C.white, fontWeight: "800", fontSize: 16, textAlign: "center" },
  avatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: "#2A2A2A", alignItems: "center", justifyContent: "center", marginLeft: 4, marginRight: 12 },
  name:           { color: C.white, fontWeight: "700", fontSize: 15 },
  meta:           { color: "#666", fontSize: 12, marginTop: 2 },
  starsWrap:      { flexDirection: "row", alignItems: "center", gap: 3 },
  starsNum:       { color: C.gold, fontWeight: "800", fontSize: 18 },
  starIcon:       { color: C.gold, fontSize: 14 },
});

// ─── Profile styles ───────────────────────────────────────────────────────────

const prSt = StyleSheet.create({
  hero:         { alignItems: "center", paddingTop: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  name:         { color: C.white, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  levelBadge:   { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  levelText:    { color: C.black, fontWeight: "800", fontSize: 13 },
  xpBar:        { width: 200, height: 6, backgroundColor: "#2A2A2A", borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  xpFill:       { height: "100%", backgroundColor: C.gold, borderRadius: 3 },
  xpLabel:      { color: "#666", fontSize: 12 },
  statsRow:     { flexDirection: "row", marginHorizontal: 16, marginTop: 20, backgroundColor: C.card, borderRadius: 16 },
  statBox:      { flex: 1, alignItems: "center", paddingVertical: 18 },
  statVal:      { color: C.gold, fontSize: 28, fontWeight: "800" },
  statLabel:    { color: "#888", fontSize: 12, marginTop: 4 },
  sectionTitle: { color: C.white, fontSize: 18, fontWeight: "800" },
  achGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  achCard:      { width: "47%", backgroundColor: C.card, borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#2A2A2A" },
  achCardLocked:{ opacity: 0.6 },
  achEmoji:     { fontSize: 36, marginBottom: 6 },
  achDot:       { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.perfect },
  achTitle:     { color: C.white, fontWeight: "700", fontSize: 13, textAlign: "center", marginBottom: 4 },
  achDesc:      { color: "#888", fontSize: 11, textAlign: "center", lineHeight: 15 },
});

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

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

// ─── Achievement toast styles ─────────────────────────────────────────────────

const toastSt = StyleSheet.create({
  wrap: {
    position: "absolute", bottom: 90, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1C1600",
    borderWidth: 1.5, borderColor: C.gold,
    borderRadius: 20, padding: 16,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 20,
    overflow: "hidden",
  },
  shine: {
    position: "absolute", top: 0, left: 0, right: 0, height: 1,
    backgroundColor: C.gold, opacity: 0.35,
  },
  emojiWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#2A1F00",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.bronze,
  },
  pressable: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  label:   { color: C.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 2 },
  title:   { color: C.white, fontSize: 17, fontWeight: "800", marginBottom: 2 },
  desc:    { color: "#ADADAD", fontSize: 12, lineHeight: 16 },
  chevron: { color: C.gold, fontSize: 28, opacity: 0.7 },
});

// ─── Achievement modal styles ─────────────────────────────────────────────────

const achModalSt = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50, alignItems: "center", justifyContent: "center",
  },
  card: {
    width: "88%", backgroundColor: "#131008", borderRadius: 28,
    padding: 28, alignItems: "center",
    borderWidth: 1.5, borderColor: "#2A2000",
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 32, elevation: 30,
  },
  stage: {
    width: 220, height: 220,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  ring: {
    position: "absolute",
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 1.5, borderColor: C.gold,
  },
  sparkle: {
    position: "absolute",
    width: 9, height: 9, borderRadius: 5,
  },
  emojiCircle: {
    width: 116, height: 116, borderRadius: 58,
    backgroundColor: "#1A1A1A", borderWidth: 2.5, borderColor: "#2A2A2A",
    alignItems: "center", justifyContent: "center",
  },
  emojiCircleEarned: {
    backgroundColor: "#1C1500",
    borderColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 18,
  },
  badge: {
    backgroundColor: "#2A2000", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16,
    borderWidth: 1, borderColor: C.bronze,
  },
  badgeLocked: { backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" },
  badgeText:   { color: C.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title:       { color: C.white, fontSize: 22, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  desc:        { color: "#ADADAD", fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 6 },
  hint:        { color: "#484848", fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 8, fontStyle: "italic" },
  closeBtn:    { marginTop: 16, borderWidth: 1.5, borderColor: C.bronze, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 44 },
  closeBtnEarned:  { backgroundColor: C.gold, borderColor: C.gold },
  closeBtnText:    { color: C.gold, fontWeight: "700", fontSize: 15 },
});
