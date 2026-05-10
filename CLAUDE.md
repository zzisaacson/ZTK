# Zero To Kumziz — Codebase Guide

## What this app is

A React Native / Expo guitar-learning app. The core loop: watch an instructional video, then play along with a scrolling target timeline that grades your chord hits in real time via the device microphone.

## Stack

- **Expo** (managed workflow), entry at `index.js` → `App.js`
- **expo-av** for mic recording on native; Web Audio API autocorrelation for web pitch detection
- **expo-status-bar**, core React Native primitives only — no third-party UI libraries
- Single-file app: all screens and components live in `App.js` (except `StringPractice` and `InstructionalVideo` which are in `src/components/`)

## File map

```
App.js                              Main file — all screens, path UI, lesson engine
src/
  components/
    InstructionalVideo.native.js    Expo-AV video player (native)
    InstructionalVideo.web.js       HTML5 video player (web)
    StringPractice.js               String-by-string Em practice with FFT chord detection
  data/lessons/
    em_am_test.json                 MIDI-derived lesson data (targets with time, noteNames, midiNotes)
context/
  Zero To Kumziz_ final project files 3/
    Logo Design/TRANSPARENT/PNG/    Logo assets used in LandingScreen
    Fonts/                          RedHatDisplay (not yet wired into app)
assets/videos/                      Em instructional video (mp4 + mov)
scripts/
  build_lesson_json.mjs             Converts MIDI → lesson JSON
  extract_pdf_text.py               Brand asset extraction
```

## App architecture

### Screens (state machine in `App`)

| `screen` value | Component        | Description |
|----------------|-----------------|-------------|
| `"path"`       | `PathScreen` + `TabBar` | Home — journey map with tab navigation |
| `"landing"`    | `LandingScreen`  | Module 1 detail — video + two sub-module cards |
| `"lesson"`     | `LessonScreen`   | Scrolling fretboard lesson with mic grading |
| `"practice"`   | `StringPractice` | String-by-string Em chord practice |

### Key state (in `App`)
- `activeTab` — `"learn"` | `"workouts"` | `"songs"`
- `selectedModule` — the module the user tapped into
- `completedModules` — `{ [moduleId]: { stars: 1|2|3 } }` — persists unlock state in-session

### Completion / unlock logic
- Completing the lesson (`onFinish(stats)`) records 1–3 stars based on score (≥9 = 3★, ≥3 = 2★, else 1★)
- Exiting `StringPractice` always records at least 1★ for that module
- Each tab computes its own unlock chain: module `i` unlocks when module `i-1` is in `completedModules`
- Module 1 is always unlocked

## Modules & tabs

```
ALL_MODULES (9 total):
  Tutorials (id 1–3): Em & Am (real lesson), G & D Chords, Barre Chords
  Workouts  (id 4–6): Chord Changes, Strumming, Scale Runs
  Songs     (id 7–9): First Song, Wonderwall, Knockin' On Heaven

TABS:
  Learn    📖 → shows ALL_MODULES  (world header: "JOURNEY / Zero To Kumziz")
  Workouts ⚡ → type === "workout" (world header: "GYM / Practice Drills")
  Songs    🎵 → type === "song"    (world header: "STAGE / Your Setlist")
```

## Lesson engine (LessonScreen)

- Scrolling fretboard (guitar-neck aesthetic, dark wood `#1a0e05`)
- 6 string tracks; silver strings at top (E, A, D), gold strings at bottom (G, B, e)
- Chord blocks slide left on a timeline; a gold ball marks "now"
- Chord name floats **above** the string lines (separate absolutely-positioned label, `zIndex: 8`)
- Hit grading: autocorrelation → MIDI → pitch-class comparison against target
  - Perfect: ≥66% coverage + Δt ≤ 120ms
  - Good:    ≥34% coverage + Δt ≤ 320ms
  - Miss: anything else (or auto-assigned after 520ms)
- Flash overlay on each hit (color-coded)
- Metronome BPM control

## StringPractice (src/components/StringPractice.js)

- Phase 1 `"strings"`: autocorrelation, one string at a time, requires `CONF_NEED=6` consecutive hits
- Phase 2 `"chord"`: FFT analysis of all 6 strings simultaneously, 4 consecutive OK frames = done
- Takes `{ onBack }` prop only

## Styling conventions

- Color palette in `C` constant at top of `App.js`
- Three StyleSheet objects: `pathSt` (path/header), `tabSt` (tab bar), `styles` (everything else)
- No third-party icon or styling libraries — emoji used for icons throughout
- Dark theme throughout (`C.bg = "#121212"`)

## Lesson data format

```json
{
  "id": "em-am-test",
  "bpm": 50,
  "durationSeconds": 153.597,
  "targets": [
    { "id": "t1", "time": 2.4, "noteNames": ["E2","B2","E3","G3","B3","E4"], "midiNotes": [40,47,...] }
  ]
}
```

## Known gaps / next up

- Workouts and Songs modules are all placeholders ("coming soon")
- Native iOS/Android mic pitch detection is stubbed — full experience on web only
- No persistence (completed modules reset on reload)
- Fonts (RedHatDisplay) not yet applied
- No user accounts or progress sync
