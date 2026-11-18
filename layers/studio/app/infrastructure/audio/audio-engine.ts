import { routeChannel, routeOverlayBus, sceneHasSolo } from '../../application/audio-routing';
import {
  type AudioEffect,
  type AudioMonitoringMode,
  dbToGain,
  LEVEL_FLOOR_DB,
  measureTimeDomain,
} from '../../models/audio.domain';
import { curveFromEffect } from './effects/biquad-response';
import { buildEffect } from './effects/build-effect';
import { EffectInsert, type EffectInsertHost } from './effects/effect-insert';
import { applyMonitorSink, type MonitorSinkResult } from './monitor-sink';
import { OverlayBufferCache } from './overlay-buffer-cache';
import { attachOverlayVoice, type OverlayVoiceGain, type OverlayVoiceSource, rampOverlayGain } from './overlay-voice';

export type { MonitorSinkResult } from './monitor-sink';

export type AudioLevelReading = {
  rmsDb: number;
  peakDb: number;
};

export type AudioLevels = {
  channels: Record<string, AudioLevelReading>;
  master: AudioLevelReading;
  reductions: Record<string, number>;
  chainError: string | null;
  overlay: AudioLevelReading;
};

export type AudioGraphChannel = {
  id: string;
  sourceIds: string[];
  trimDb: number;
  faderDb: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  monitoring: AudioMonitoringMode;
  enabledInScene: boolean;
  effects: AudioEffect[];
};

export type AudioGraphSnapshot = {
  master: { volume: number; muted: boolean; effects: AudioEffect[] };
  channels: AudioGraphChannel[];
  overlay: {
    faderDb: number;
    muted: boolean;
    solo: boolean;
    monitoring: AudioMonitoringMode;
    effects: AudioEffect[];
  };
};

export type OverlayInstanceStart = {
  instanceId: string;
  buffer: AudioBuffer;
  volumeDb: number;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
  startTimeSec: number;
  endTimeSec?: number;
};

/** Program send joins the master input. Monitor send joins the headphone sum. Neither is the program stream. */
export const connectOverlaySends = (
  programSend: { connect: (node: AudioNode) => void },
  monitorSend: { connect: (node: AudioNode) => void },
  masterInput: AudioNode,
  monitorInput: AudioNode,
): void => {
  programSend.connect(masterInput);
  monitorSend.connect(monitorInput);
};

type ArmedSource = {
  node: AudioNode;
  release: () => void;
  /** Input the node is already patched to. Sync must not reconnect a live source. */
  connectedTo: AudioNode | null;
};

type ChannelStrip = {
  sourceIds: string[];
  input: GainNode;
  trim: GainNode;
  insert: EffectInsert;
  fader: GainNode;
  pan: StereoPannerNode;
  mute: GainNode;
  analyser: AnalyserNode;
  programSend: GainNode;
  monitorSend: GainNode;
};

const FLOOR: AudioLevelReading = { rmsDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB };
const PEAK_HOLD_MS = 800;

const silent = (): AudioLevels => ({
  channels: {},
  master: { ...FLOOR },
  overlay: { ...FLOOR },
  reductions: {},
  chainError: null,
});

/**
 * One browser audio graph for the studio session.
 * Registering a source in the project does not open a device. Capture is armed
 * only when the caller already holds a stream or starts file playback from a gesture.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private masterVolume: GainNode | null = null;
  private masterMute: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private programDestination: MediaStreamAudioDestinationNode | null = null;
  private monitorInput: GainNode | null = null;
  private masterInsert: EffectInsert | null = null;
  private readonly channels = new Map<string, ChannelStrip>();
  private readonly armed = new Map<string, ArmedSource>();
  private overlayInput: GainNode | null = null;
  private overlayInsert: EffectInsert | null = null;
  private overlayFader: GainNode | null = null;
  private overlayMute: GainNode | null = null;
  private overlayAnalyser: AnalyserNode | null = null;
  private overlayProgram: GainNode | null = null;
  private overlayMonitor: GainNode | null = null;
  private overlayEnded: ((instanceId: string) => void) | null = null;
  private readonly overlayVoices = new Map<string, { stop: () => void; gain: GainNode }>();
  private readonly overlayCache = new OverlayBufferCache<AudioBuffer>((url) => this.decodeOverlayUrl(url));
  private readonly ballistics = new Map<string, { rms: number; peak: number; peakAt: number }>();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private samples: Float32Array<ArrayBuffer> | null = null;
  private frame = 0;
  private chainGeneration = 0;
  private chainError: string | null = null;
  private listener: ((levels: AudioLevels) => void) | null = null;

  setLevelListener(listener: ((levels: AudioLevels) => void) | null): void {
    this.listener = listener;
  }

  hasArmed(sourceId: string): boolean {
    return this.armed.has(sourceId);
  }

  getProgramStream(): MediaStream | null {
    return this.programDestination?.stream ?? null;
  }

  readCurve(effect: AudioEffect): { frequencies: number[]; magnitudeDb: number[] } | null {
    if (!this.context || (effect.type !== 'eq-band' && effect.type !== 'high-pass')) {
      return null;
    }
    return curveFromEffect(this.context, effect);
  }

  setOverlayEndedListener(listener: ((instanceId: string) => void) | null): void {
    this.overlayEnded = listener;
  }

  loadOverlayBuffer(cacheKey: string, url: string): Promise<AudioBuffer> {
    return this.overlayCache.load(cacheKey, url);
  }

  retainOverlayBuffers(keep: ReadonlySet<string>): void {
    this.overlayCache.retain(keep);
  }

  startOverlayInstance(request: OverlayInstanceStart): void {
    const context = this.ensureContext();
    this.stopOverlayInstance(request.instanceId);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const voice = attachOverlayVoice({
      source: source as unknown as OverlayVoiceSource,
      gain: gain as unknown as OverlayVoiceGain,
      destination: this.overlayInput,
      buffer: request.buffer,
      volumeDb: request.volumeDb,
      muted: request.muted,
      loop: request.loop,
      playbackRate: request.playbackRate,
      startTimeSec: request.startTimeSec,
      endTimeSec: request.endTimeSec,
      now: context.currentTime,
      onEnded: () => {
        this.overlayVoices.delete(request.instanceId);
        this.overlayEnded?.(request.instanceId);
      },
    });
    this.overlayVoices.set(request.instanceId, { stop: voice.stop, gain });
  }

  stopOverlayInstance(instanceId: string): void {
    const voice = this.overlayVoices.get(instanceId);
    if (!voice) {
      return;
    }
    this.overlayVoices.delete(instanceId);
    voice.stop();
  }

  setOverlayInstanceGain(instanceId: string, volumeDb: number, muted: boolean): void {
    const voice = this.overlayVoices.get(instanceId);
    if (!voice || !this.context) {
      return;
    }
    rampOverlayGain(voice.gain.gain, muted ? 0 : dbToGain(volumeDb), this.context.currentTime);
  }

  private async decodeOverlayUrl(url: string): Promise<AudioBuffer> {
    const context = this.ensureContext();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Audio asset failed to load');
    }
    const bytes = await response.arrayBuffer();
    return context.decodeAudioData(bytes.slice(0));
  }

  /**
   * Selects the headphone device. The program MediaStreamDestination is left on its own node.
   * Browsers without setSinkId stay on the default output.
   */
  async setMonitorSink(sinkId: string): Promise<MonitorSinkResult> {
    const context = this.ensureContext();
    return applyMonitorSink(context, sinkId);
  }

  armStream(sourceId: string, stream: MediaStream, release?: () => void): void {
    const context = this.ensureContext();
    void context.resume();
    this.releaseSource(sourceId);
    const node = context.createMediaStreamSource(stream);
    this.armed.set(sourceId, {
      node,
      connectedTo: null,
      release:
        release ??
        (() => {
          for (const track of stream.getTracks()) {
            track.stop();
          }
        }),
    });
    this.connectArmed(sourceId);
  }

  async armFile(sourceId: string, url: string): Promise<void> {
    const context = this.ensureContext();
    void context.resume();
    this.releaseSource(sourceId);
    const audio = new Audio(url);
    audio.loop = true;
    const node = context.createMediaElementSource(audio);
    this.armed.set(sourceId, {
      node,
      connectedTo: null,
      release: () => {
        audio.pause();
        audio.src = '';
      },
    });
    this.connectArmed(sourceId);
    try {
      await audio.play();
    } catch (error) {
      this.releaseSource(sourceId);
      throw error;
    }
  }

  releaseSource(sourceId: string): void {
    const armed = this.armed.get(sourceId);
    if (!armed) {
      return;
    }
    armed.node.disconnect();
    armed.release();
    this.armed.delete(sourceId);
  }

  sync(snapshot: AudioGraphSnapshot): void {
    const context = this.ensureContext();
    const live = new Set(snapshot.channels.map((channel) => channel.id));
    for (const id of this.channels.keys()) {
      if (!live.has(id)) {
        this.disconnectStrip(this.channels.get(id)!);
        this.channels.delete(id);
        this.ballistics.delete(id);
      }
    }

    for (const channel of snapshot.channels) {
      const strip = this.channels.get(channel.id) ?? this.createStrip(context);
      strip.sourceIds = [...channel.sourceIds];
      this.channels.set(channel.id, strip);
    }

    for (const sourceId of this.armed.keys()) {
      this.connectArmed(sourceId);
    }

    const anySoloInScene = sceneHasSolo(snapshot.channels);
    const tasks: Promise<void>[] = [];
    for (const channel of snapshot.channels) {
      const strip = this.channels.get(channel.id);
      if (!strip) {
        continue;
      }
      strip.trim.gain.value = dbToGain(channel.trimDb);
      strip.fader.gain.value = dbToGain(channel.faderDb);
      strip.pan.pan.value = channel.pan;
      strip.mute.gain.value = channel.muted ? 0 : 1;
      const route = routeChannel({
        enabledInScene: channel.enabledInScene,
        monitoring: channel.monitoring,
        solo: channel.solo,
        anySoloInScene,
      });
      strip.programSend.gain.value = route.program ? 1 : 0;
      strip.monitorSend.gain.value = route.monitor ? 1 : 0;
      tasks.push(strip.insert.sync(channel.effects));
    }

    if (this.masterInsert) {
      tasks.push(this.masterInsert.sync(snapshot.master.effects));
    }

    if (this.masterVolume && this.masterMute) {
      this.masterVolume.gain.value = snapshot.master.volume;
      this.masterMute.gain.value = snapshot.master.muted ? 0 : 1;
    }

    if (this.overlayFader && this.overlayMute && this.overlayProgram && this.overlayMonitor && this.overlayInsert) {
      rampOverlayGain(this.overlayFader.gain, dbToGain(snapshot.overlay.faderDb), context.currentTime);
      rampOverlayGain(this.overlayMute.gain, snapshot.overlay.muted ? 0 : 1, context.currentTime);
      const overlayRoute = routeOverlayBus({
        monitoring: snapshot.overlay.monitoring,
        solo: snapshot.overlay.solo,
        anyChannelSolo: anySoloInScene,
      });
      this.overlayProgram.gain.value = overlayRoute.program ? 1 : 0;
      this.overlayMonitor.gain.value = overlayRoute.monitor ? 1 : 0;
      tasks.push(this.overlayInsert.sync(snapshot.overlay.effects));
    }

    const generation = ++this.chainGeneration;
    void Promise.allSettled(tasks).then((results) => {
      if (generation !== this.chainGeneration) {
        return;
      }
      const failed = results.find((result) => result.status === 'rejected');
      this.chainError =
        failed && failed.status === 'rejected'
          ? failed.reason instanceof Error
            ? failed.reason.message
            : 'Effect chain failed'
          : null;
    });

    this.startMeter();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.length = 0;
    for (const sourceId of [...this.armed.keys()]) {
      this.releaseSource(sourceId);
    }
    for (const strip of this.channels.values()) {
      this.disconnectStrip(strip);
    }
    this.channels.clear();
    this.ballistics.clear();
    this.masterInsert?.dispose();
    this.masterInsert = null;
    this.overlayEnded = null;
    for (const voice of this.overlayVoices.values()) {
      voice.stop();
    }
    this.overlayVoices.clear();
    this.overlayCache.retain(new Set());
    this.overlayInsert?.dispose();
    this.overlayInsert = null;
    this.overlayInput = null;
    this.overlayFader = null;
    this.overlayMute = null;
    this.overlayAnalyser = null;
    this.overlayProgram = null;
    this.overlayMonitor = null;
    this.masterInput = null;
    this.masterVolume = null;
    this.masterMute = null;
    this.masterAnalyser = null;
    this.programDestination = null;
    this.monitorInput = null;
    const context = this.context;
    this.context = null;
    if (context) {
      void context.close();
    }
  }

  private ensureContext(): AudioContext {
    if (this.context) {
      return this.context;
    }
    const context = new AudioContext();
    const masterInput = context.createGain();
    const masterInsert = new EffectInsert(this.insertHost(context));
    const masterVolume = context.createGain();
    const masterMute = context.createGain();
    const masterAnalyser = context.createAnalyser();
    masterAnalyser.fftSize = 2048;
    const programDestination = context.createMediaStreamDestination();
    masterInput.connect(masterInsert.input);
    masterInsert.output.connect(masterVolume);
    masterVolume.connect(masterMute);
    masterMute.connect(masterAnalyser);
    masterAnalyser.connect(programDestination);

    const monitorInput = context.createGain();
    monitorInput.connect(context.destination);

    this.context = context;
    this.masterInput = masterInput;
    const overlayInput = context.createGain();
    const overlayInsert = new EffectInsert(this.insertHost(context));
    const overlayFader = context.createGain();
    const overlayMute = context.createGain();
    const overlayAnalyser = context.createAnalyser();
    overlayAnalyser.fftSize = 2048;
    const overlayProgram = context.createGain();
    const overlayMonitor = context.createGain();
    overlayInput.connect(overlayInsert.input);
    overlayInsert.output.connect(overlayFader);
    overlayFader.connect(overlayMute);
    overlayMute.connect(overlayAnalyser);
    overlayAnalyser.connect(overlayProgram);
    overlayAnalyser.connect(overlayMonitor);
    connectOverlaySends(overlayProgram, overlayMonitor, masterInput, monitorInput);

    this.masterInsert = masterInsert;
    this.masterVolume = masterVolume;
    this.masterMute = masterMute;
    this.masterAnalyser = masterAnalyser;
    this.programDestination = programDestination;
    this.monitorInput = monitorInput;
    this.samples = new Float32Array(masterAnalyser.fftSize);
    this.overlayInput = overlayInput;
    this.overlayInsert = overlayInsert;
    this.overlayFader = overlayFader;
    this.overlayMute = overlayMute;
    this.overlayAnalyser = overlayAnalyser;
    this.overlayProgram = overlayProgram;
    this.overlayMonitor = overlayMonitor;
    return context;
  }

  private createStrip(context: AudioContext): ChannelStrip {
    const input = context.createGain();
    const trim = context.createGain();
    const insert = new EffectInsert(this.insertHost(context));
    const fader = context.createGain();
    const pan = context.createStereoPanner();
    const mute = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    const programSend = context.createGain();
    const monitorSend = context.createGain();
    const sourceIds: string[] = [];

    input.connect(trim);
    trim.connect(insert.input);
    insert.output.connect(fader);
    fader.connect(pan);
    pan.connect(mute);
    mute.connect(analyser);
    analyser.connect(programSend);
    analyser.connect(monitorSend);
    programSend.connect(this.masterInput!);
    monitorSend.connect(this.monitorInput!);

    return { sourceIds, input, trim, insert, fader, pan, mute, analyser, programSend, monitorSend };
  }

  private insertHost(context: AudioContext): EffectInsertHost {
    return {
      now: () => context.currentTime,
      createGain: () => context.createGain(),
      build: (effect) => buildEffect(context, effect),
      after: (ms, fn) => {
        this.timers.push(setTimeout(fn, ms));
      },
    };
  }

  private disconnectStrip(strip: ChannelStrip): void {
    strip.insert.dispose();
    strip.input.disconnect();
    strip.programSend.disconnect();
    strip.monitorSend.disconnect();
  }

  private connectArmed(sourceId: string): void {
    const armed = this.armed.get(sourceId);
    if (!armed) {
      return;
    }
    let input: AudioNode | null = null;
    for (const strip of this.channels.values()) {
      if (strip.sourceIds.includes(sourceId)) {
        input = strip.input;
        break;
      }
    }
    if (armed.connectedTo === input) {
      return;
    }
    armed.node.disconnect();
    armed.connectedTo = null;
    if (input) {
      armed.node.connect(input);
      armed.connectedTo = input;
    }
  }

  private startMeter(): void {
    if (this.frame !== 0) {
      return;
    }
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.publishLevels();
    };
    this.frame = requestAnimationFrame(loop);
  }

  private publishLevels(): void {
    if (!this.samples) {
      return;
    }
    const channels: Record<string, AudioLevelReading> = {};
    const reductions: Record<string, number> = {};
    for (const [id, strip] of this.channels) {
      strip.analyser.getFloatTimeDomainData(this.samples);
      channels[id] = this.applyBallistics(id, measureTimeDomain(this.samples));
      Object.assign(reductions, strip.insert.reductions());
    }
    let master = { ...FLOOR };
    if (this.masterAnalyser) {
      this.masterAnalyser.getFloatTimeDomainData(this.samples);
      master = this.applyBallistics('master', measureTimeDomain(this.samples));
    }
    if (this.masterInsert) {
      Object.assign(reductions, this.masterInsert.reductions());
    }
    let overlay = { ...FLOOR };
    if (this.overlayAnalyser) {
      this.overlayAnalyser.getFloatTimeDomainData(this.samples);
      overlay = this.applyBallistics('overlay', measureTimeDomain(this.samples));
    }
    if (this.overlayInsert) {
      Object.assign(reductions, this.overlayInsert.reductions());
    }
    this.listener?.({ channels, master, overlay, reductions, chainError: this.chainError });
  }

  private applyBallistics(id: string, reading: AudioLevelReading): AudioLevelReading {
    const now = performance.now();
    const previous = this.ballistics.get(id) ?? { rms: LEVEL_FLOOR_DB, peak: LEVEL_FLOOR_DB, peakAt: 0 };
    const rms =
      reading.rmsDb > previous.rms
        ? previous.rms * 0.35 + reading.rmsDb * 0.65
        : previous.rms * 0.82 + reading.rmsDb * 0.18;
    const holdExpired = now - previous.peakAt > PEAK_HOLD_MS;
    const peak = reading.peakDb >= previous.peak || holdExpired ? reading.peakDb : previous.peak;
    const peakAt = reading.peakDb >= previous.peak ? now : previous.peakAt;
    this.ballistics.set(id, { rms, peak, peakAt });
    return { rmsDb: rms, peakDb: peak };
  }
}

export const emptyAudioLevels = silent;
