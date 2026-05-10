# GuitarCoach — Project Overview

## What this project is

A cross-platform guitar coaching app built with **React + Expo** (web/iOS/Android). The current build is a standalone testing module focused on chord detection and rhythm accuracy. Long-term goal is to support full songs and backing tracks (licensing/copyright still being investigated).

---

## Architecture

### Entry point
- `App.js` — 4-tab navigation (Learn, Tuner, Chords, Rhythm)

### Source files
```
src/
  utils/
    chordDefs.js      — chord definitions (Em, Am), rhythm pattern, BPM constant
    audioAnalysis.js  — Web Audio API: FFT pitch/chord detection, pitch detection (YIN), metronome
  components/
    NoteByNote.js     — Tab 1: Duolingo-style note-by-note Em lesson with achievement
    GuitarTuner.js    — Tab 2: real-time chromatic guitar tuner
    ChordDetector.js  — Tab 3: real-time E minor chord detection
    RhythmTest.js     — Tab 4: 50 BPM rhythm test with per-beat scoring
```

### Config
- `app.json` — Expo config (targets web, iOS, Android)
- `metro.config.js` — restricts Metro bundler from scanning the entire home directory

---

## Installed packages

| Package | Purpose |
|---------|---------|
| `expo` | Cross-platform framework |
| `react-native-web`, `@expo/metro-runtime` | Web support |
| `@react-native-community/audio-toolkit` | Native audio recording/playback |
| `pitchfinder` | Pitch detection (YIN algorithm — used in tuner) |
| `expo-document-picker` | Pick audio files from device |
| `expo-file-system` | File read/write on device |
| `react-native-sound` | Sound playback (requires bare/custom dev client on Expo) |
| `midi-sounds-react` | MIDI sounds (web only — uses Web Audio API) |

---

## Tab 1 — Learn: Note by Note (`NoteByNote.js`)

Duolingo-style lesson that teaches each note of the E minor chord one at a time.

### Flow
1. Intro screen → "Let's Go!" starts the microphone
2. 6 steps, one per string — user plays the indicated note and holds it
3. Confirmation ring fills over ~480ms of sustained correct pitch
4. Each confirmed note plays a chime at that note's pitch
5. Celebration screen on completion: confetti, animated badge, "First Chord! +50 XP" achievement, 4-note fanfare

### Detection
- Uses YIN pitch detection (`detectPitch()`) for monophonic note detection
- Note tolerance: ±15 Hz around the target frequency
- Requires `CONFIRM_FRAMES = 6` consecutive correct detections (~480ms)
- Confirmation count decays by 1 on a miss (forgiving) rather than hard-resetting

### UX details
- 6-dot progress bar: grey → blue (current) → green (done)
- Ring border colour: dark → blue → amber → green as confidence builds
- String diagram shows which of the 6 strings to pluck
- Fret + finger guidance shown per note (open vs 2nd fret)

---

## Tab 2 — Guitar Tuner (`GuitarTuner.js`)

Real-time chromatic tuner targeting standard guitar tuning (E A D G B E).

### Detection
- Uses YIN pitch detection from `pitchfinder` (via `audioAnalysis.detectPitch()`)
- Detects fundamentals in 20Hz–1400Hz range
- Maps detected frequency to nearest semitone + cents deviation
- Shows note letter only (no octave number), matching real tuner convention

### UI
- Visual guitar neck: 6 strings with realistic thicknesses and colours (gold for wound, silver for plain), nut, fret lines, position dot markers at frets 3 and 5, tuning peg circles
- Active string chip highlights when detected frequency is within ~6% of an open string
- Sliding dot on a colour-zoned track: green (±5¢), amber (±15¢), red (beyond)
- Animated spring on dot for smooth movement

---

## Tab 3 — Chord Detector (`ChordDetector.js`)

Listens in real time and checks whether an E minor chord is being played correctly.

### Em chord definition
| String | Note | Frequency |
|--------|------|-----------|
| 6 | E2 | 82.41 Hz |
| 5 | B2 | 123.47 Hz |
| 4 | E3 | 164.81 Hz |
| 3 | G3 | 196.00 Hz |
| 2 | B3 | 246.94 Hz |
| 1 | E4 | 329.63 Hz |

### Detection logic (`audioAnalysis.analyseChord`)
- FFT size 8192 on `AnalyserNode` (~5.86 Hz/bin), smoothing constant 0.75
- Processes strings **low → high** to enable harmonic suppression
- **Harmonic suppression**: if a string's frequency is close to an overtone (×2, ×3, ×4) of an already-confirmed lower string, it requires `THRESHOLD_DB + HARMONIC_DB_BOOST` to count as independently ringing — prevents E2's harmonics from falsely triggering E3, B3, E4
- Wrong notes: unexpected spectral peaks above `WRONG_NOTE_THRESHOLD_DB`, excluding chord tones and their harmonics from the flagged list
- Per-string temporal smoothing: turns red only after `MUTE_FRAMES_REQUIRED` consecutive muted frames

### Tunable constants (in `audioAnalysis.js`)
```js
const THRESHOLD_DB = -58;            // minimum dB to count as ringing
const FREQ_TOLERANCE_HZ = 10;        // ±Hz window per string
const WRONG_NOTE_THRESHOLD_DB = -44; // threshold for flagging unexpected peaks
const MUTE_FRAMES_REQUIRED = 2;      // frames before string turns red (~160ms)
const HARMONIC_DB_BOOST = 12;        // extra dB required for harmonically suspect strings
```

---

## Tab 4 — Rhythm Test (`RhythmTest.js`)

Guides the user through a repeating chord pattern at **50 BPM** with a metronome click.

### Pattern
```
Em → Em → Am → Am  (repeating, 2 full cycles = 8 beats total)
```

### Am chord definition
| String | Note | Frequency |
|--------|------|-----------|
| 6 | x (muted) | — |
| 5 | A2 | 110.00 Hz |
| 4 | E3 | 164.81 Hz |
| 3 | A3 | 220.00 Hz |
| 2 | C4 | 261.63 Hz |
| 1 | E4 | 329.63 Hz |

### Scoring (shown at end of test)
- **Chord accuracy** — % of beats where the correct chord was detected
- **Note accuracy** — % of expected strings that were ringing across all beats
- **Muted/missing string detection** — % of strings that rang when they should
- Beat-by-beat breakdown shown in results screen

### Metronome
- Scheduled via `AudioContext.currentTime` for sample-accurate timing
- High click (1000 Hz) on beat 1 of each 4-beat group, lower click (800 Hz) on others
- Audio sampled 120ms after each click to capture the user's strum

---

## audioAnalysis.js — key exports

| Export | Description |
|--------|-------------|
| `startAudio()` | Requests mic, creates AudioContext + AnalyserNode, initialises YIN detector |
| `stopAudio()` | Tears down audio graph, clears per-string mute counters |
| `detectPitch()` | YIN monophonic pitch detection — returns Hz or null |
| `analyseChord(chordDef)` | FFT polyphonic chord analysis with harmonic suppression |
| `startMetronome(bpm, onTick)` | Schedules metronome clicks; returns a stop function |
| `getAudioContext()` | Returns the live AudioContext (used for Web Audio sound effects) |

---

## Running the app

```bash
npx expo start --web
```

Then open `http://localhost:8081`. Allow microphone access when the browser prompts.

> **Note:** The app currently targets **web** using the Web Audio API. Native iOS/Android support for real-time audio analysis requires additional native module configuration (e.g. a custom dev client for `react-native-sound`).

---

## Known issues / future work

- Metro emits EPERM warnings for system Library folders on macOS — harmless, just noise
- `react-native-sound` and `midi-sounds-react` are web-incompatible on native without extra setup
- Timing accuracy score in Rhythm Test is implicit (strum sampled on the beat) — explicit timing window scoring not yet built
- `SafeAreaView` deprecation warning in App.js — low priority, cosmetic only
- Song/backing track mode pending licensing research
- NoteByNote only covers Em — future: Am, other chords, full progression lessons
