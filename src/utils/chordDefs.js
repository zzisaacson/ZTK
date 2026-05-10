export const CHORDS = {
  Em: {
    name: 'E Minor',
    symbol: 'Em',
    strings: [
      { string: 6, note: 'E2', freq: 82.41,  muted: false },
      { string: 5, note: 'B2', freq: 123.47, muted: false },
      { string: 4, note: 'E3', freq: 164.81, muted: false },
      { string: 3, note: 'G3', freq: 196.00, muted: false },
      { string: 2, note: 'B3', freq: 246.94, muted: false },
      { string: 1, note: 'E4', freq: 329.63, muted: false },
    ],
  },
  Am: {
    name: 'A Minor',
    symbol: 'Am',
    strings: [
      { string: 6, note: 'x',  freq: null,   muted: true  },
      { string: 5, note: 'A2', freq: 110.00, muted: false },
      { string: 4, note: 'E3', freq: 164.81, muted: false },
      { string: 3, note: 'A3', freq: 220.00, muted: false },
      { string: 2, note: 'C4', freq: 261.63, muted: false },
      { string: 1, note: 'E4', freq: 329.63, muted: false },
    ],
  },
};

export const RHYTHM_PATTERN = ['Em', 'Em', 'Am', 'Am'];
export const BPM = 50;
export const BEAT_MS = (60 / BPM) * 1000; // 1200ms
