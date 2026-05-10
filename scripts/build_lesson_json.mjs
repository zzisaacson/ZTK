import fs from "node:fs";
import path from "node:path";
import toneMidiPkg from "@tonejs/midi";
const { Midi } = toneMidiPkg;

const MIDI_INPUT = path.resolve("context/EM_AMtest.mid");
const OUTPUT_PATH = path.resolve("src/data/lessons/em_am_test.json");

const midiData = fs.readFileSync(MIDI_INPUT);
const midi = new Midi(midiData);

const noteEvents = midi.tracks.flatMap((track) =>
  track.notes.map((note) => ({
    midi: note.midi,
    name: note.name,
    time: note.time,
    duration: note.duration,
    velocity: note.velocity,
    trackName: track.name || "Track"
  }))
);

noteEvents.sort((a, b) => a.time - b.time);

const grouped = [];
const CHORD_WINDOW_SECONDS = 0.06;

for (const event of noteEvents) {
  const previous = grouped[grouped.length - 1];
  if (previous && Math.abs(previous.time - event.time) <= CHORD_WINDOW_SECONDS) {
    previous.notes.push(event);
  } else {
    grouped.push({
      id: `evt-${grouped.length + 1}`,
      time: Number(event.time.toFixed(3)),
      duration: Number(event.duration.toFixed(3)),
      notes: [event]
    });
  }
}

const lesson = {
  id: "em-am-test",
  title: "E Minor to A Minor Test",
  sourceMidi: "context/EM_AMtest.mid",
  bpm: Math.round(midi.header.tempos[0]?.bpm ?? 90),
  ppq: midi.header.ppq,
  durationSeconds: Number(midi.duration.toFixed(3)),
  totalTargets: grouped.length,
  targets: grouped.map((target) => ({
    id: target.id,
    time: target.time,
    duration: target.duration,
    midiNotes: target.notes.map((n) => n.midi),
    noteNames: target.notes.map((n) => n.name)
  }))
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(lesson, null, 2));

console.log(`Built lesson JSON: ${OUTPUT_PATH}`);
