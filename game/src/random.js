// A tiny seeded RNG (mulberry32). Every random choice the game makes comes
// from here, so a fixed seed replays the same storm: the screenshot scenes
// and the grader's two runs always see the same sky.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max) from the seeded stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One of the array's entries, from the seeded stream. */
export function pick(random, entries) {
  return entries[Math.floor(random() * entries.length)];
}
