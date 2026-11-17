// All sound is synthesised with WebAudio: no audio files, no network. A
// quiet wind bed runs under play; pickups chime, hits thud, lightning
// rumbles, level-ups arpeggiate. Everything is guarded so a browser that
// blocks audio (or a screenshot run with no gesture yet) stays silent
// instead of throwing.
export function createAudio() {
  let context = null;
  let master = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context !== null && context.state === 'running';
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startWind();
    } catch {
      context = null;
      return false;
    }
    return context.state === 'running';
  }

  function startWind() {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 2.2;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    windGain = context.createGain();
    windGain.gain.value = 0.05;
    source.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    source.start();
  }

  function tone({ frequency, endFrequency = null, type = 'sine', at = 0, dur = 0.15, volume = 0.2 }) {
    if (!ensure()) return;
    const t0 = context.currentTime + at;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(endFrequency, t0 + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ at = 0, dur = 0.3, volume = 0.25, frequency = 800, type = 'lowpass' }) {
    if (!ensure()) return;
    const t0 = context.currentTime + at;
    const length = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    /** Call on the first user gesture so the context is allowed to run. */
    unlock() {
      ensure();
      if (context !== null && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** The wind bed follows the plane's speed, 0..1. */
    setWind(level) {
      if (windGain !== null) windGain.gain.value = 0.03 + level * 0.09;
    },
    star(combo) {
      const base = 660 * Math.pow(1.059, Math.min(combo, 8));
      tone({ frequency: base, type: 'sine', dur: 0.12, volume: 0.16 });
      tone({ frequency: base * 1.5, at: 0.05, type: 'sine', dur: 0.16, volume: 0.12 });
    },
    ring() {
      tone({ frequency: 520, endFrequency: 1040, type: 'sine', dur: 0.22, volume: 0.14 });
    },
    boat() {
      [523, 659, 784].forEach((f, i) => tone({ frequency: f, at: i * 0.07, dur: 0.18, volume: 0.14 }));
    },
    hit() {
      tone({ frequency: 160, endFrequency: 50, type: 'triangle', dur: 0.25, volume: 0.3 });
      noise({ dur: 0.2, volume: 0.25, frequency: 500 });
    },
    dash() {
      noise({ dur: 0.18, volume: 0.12, frequency: 2400, type: 'bandpass' });
    },
    thunder() {
      noise({ dur: 0.7, volume: 0.3, frequency: 220 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ frequency: f, at: i * 0.08, dur: 0.2, volume: 0.14 }));
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ frequency: f, at: i * 0.11, dur: 0.3, volume: 0.15 }));
    },
    over() {
      [392, 330, 262, 196].forEach((f, i) => tone({ frequency: f, at: i * 0.14, dur: 0.3, volume: 0.14 }));
    },
  };
}
