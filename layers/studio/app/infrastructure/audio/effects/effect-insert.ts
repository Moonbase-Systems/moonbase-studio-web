import type { AudioEffect } from '../../../models/audio-effect.domain';
import { effectsInSignalPath } from '../../../models/audio-effect.domain';

export const EFFECT_CROSSFADE_MS = 20;

export type BuiltEffect = {
  id: string;
  input: AudioNode;
  output: AudioNode;
  latencyMs: number;
  update: (effect: AudioEffect) => void;
  reductionDb: () => number | null;
  dispose: () => void;
};

export type EffectInsertHost = {
  now: () => number;
  createGain: () => GainNode;
  build: (effect: AudioEffect) => Promise<BuiltEffect>;
  after: (ms: number, fn: () => void) => void;
};

type Slot = {
  gain: GainNode;
  built: BuiltEffect[];
  epoch: number;
};

/**
 * The insert's input and output stay connected for the life of the strip.
 * Rebuilds crossfade between two slots so the source node and the program stream are not unplugged.
 */
export class EffectInsert {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly slots: [Slot, Slot];
  private active = 0;
  private signature = '';
  private epoch = 0;
  private disposed = false;

  constructor(private readonly host: EffectInsertHost) {
    this.input = host.createGain();
    this.output = host.createGain();
    const makeSlot = (): Slot => {
      const gain = host.createGain();
      gain.gain.value = 0;
      this.input.connect(gain);
      gain.connect(this.output);
      return { gain, built: [], epoch: 0 };
    };
    this.slots = [makeSlot(), makeSlot()];
    this.slots[0].gain.gain.value = 1;
  }

  private slot(index: number): Slot {
    const slot = this.slots[index];
    if (!slot) {
      throw new Error('Missing effect insert slot');
    }
    return slot;
  }

  reductions(): Record<string, number> {
    const reading: Record<string, number> = {};
    for (const built of this.slot(this.active).built) {
      const value = built.reductionDb();
      if (value !== null && Number.isFinite(value)) {
        reading[built.id] = value;
      }
    }
    return reading;
  }

  async sync(effects: readonly AudioEffect[]): Promise<void> {
    const path = effectsInSignalPath(effects);
    const signature = path.map((effect) => `${effect.id}:${effect.type}`).join('>');
    if (signature === this.signature) {
      const live = this.slot(this.active);
      for (const effect of path) {
        live.built.find((item) => item.id === effect.id)?.update(effect);
      }
      return;
    }

    const epoch = ++this.epoch;
    const built: BuiltEffect[] = [];
    try {
      for (const effect of path) {
        built.push(await this.host.build(effect));
      }
    } catch (error) {
      for (const item of built) {
        item.dispose();
      }
      throw error;
    }
    if (epoch !== this.epoch) {
      for (const item of built) {
        item.dispose();
      }
      return;
    }

    const idleIndex = this.active === 0 ? 1 : 0;
    const idle = this.slot(idleIndex);
    this.clear(idle);
    this.wire(idle, built);
    idle.epoch = epoch;
    this.fade(this.slot(this.active).gain, idle.gain);
    const retiring = this.slot(this.active);
    const retiredEpoch = retiring.epoch;
    this.active = idleIndex;
    this.signature = signature;
    this.host.after(EFFECT_CROSSFADE_MS + 15, () => {
      if (this.disposed || retiring.epoch !== retiredEpoch || this.slot(this.active) === retiring) {
        return;
      }
      this.clear(retiring);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.epoch += 1;
    this.clear(this.slot(0));
    this.clear(this.slot(1));
    this.input.disconnect();
    this.output.disconnect();
  }

  private fade(outgoing: GainNode, incoming: GainNode): void {
    const now = this.host.now();
    const end = now + EFFECT_CROSSFADE_MS / 1000;
    outgoing.gain.setValueAtTime(outgoing.gain.value, now);
    outgoing.gain.linearRampToValueAtTime(0, end);
    incoming.gain.cancelScheduledValues(now);
    incoming.gain.setValueAtTime(0, now);
    incoming.gain.linearRampToValueAtTime(1, end);
  }

  private wire(slot: Slot, built: BuiltEffect[]): void {
    slot.gain.disconnect();
    let cursor: AudioNode = slot.gain;
    for (const effect of built) {
      cursor.connect(effect.input);
      cursor = effect.output;
    }
    cursor.connect(this.output);
    slot.built = built;
  }

  private clear(slot: Slot): void {
    const now = this.host.now();
    slot.gain.disconnect();
    slot.gain.gain.cancelScheduledValues(now);
    slot.gain.gain.value = 0;
    slot.gain.gain.setValueAtTime(0, now);
    slot.gain.connect(this.output);
    for (const built of slot.built) {
      built.dispose();
    }
    slot.built = [];
  }
}
