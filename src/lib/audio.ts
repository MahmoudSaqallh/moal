/**
 * Procedural ambience via the Web Audio API — no audio files to download.
 *  - "Hall air": low-passed brown noise, the soft wash of a large interior.
 *  - "Fountain": band-passed noise whose level follows distance to the atrium fountain.
 *  - UI chimes for cart feedback.
 * Audio only starts after an explicit user toggle (autoplay policies).
 */

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  water: GainNode;
};

let engine: Engine | null = null;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loop(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

function create(): Engine | null {
  const Ctor =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const air = loop(ctx, noiseBuffer(ctx, 4, true));
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "lowpass";
  airFilter.frequency.value = 420;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.22;
  air.connect(airFilter).connect(airGain).connect(master);

  const water = loop(ctx, noiseBuffer(ctx, 3, false));
  const waterFilter = ctx.createBiquadFilter();
  waterFilter.type = "bandpass";
  waterFilter.frequency.value = 1600;
  waterFilter.Q.value = 0.6;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0;
  water.connect(waterFilter).connect(waterGain).connect(master);

  return { ctx, master, water: waterGain };
}

export const audio = {
  async enable(): Promise<boolean> {
    engine ??= create();
    if (!engine) return false;
    if (engine.ctx.state === "suspended") await engine.ctx.resume();
    engine.master.gain.setTargetAtTime(0.5, engine.ctx.currentTime, 0.6);
    return true;
  },
  disable() {
    if (!engine) return;
    engine.master.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.2);
  },
  /** 0 (far) .. 1 (beside the fountain). Cheap to call ~10×/s. */
  setFountainProximity(v: number) {
    if (!engine) return;
    engine.water.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.09, engine.ctx.currentTime, 0.4);
  },
  chime() {
    if (!engine || engine.master.gain.value < 0.01) return;
    const { ctx, master } = engine;
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.16, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.9);
      osc.connect(g).connect(master);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 1);
    });
  },
  dispose() {
    engine?.ctx.close().catch(() => {});
    engine = null;
  },
};
