import { routeChannel, sceneHasSolo } from '../../application/audio-routing';
import { type AudioMonitoringMode, dbToGain, LEVEL_FLOOR_DB, measureTimeDomain } from '../../models/audio.domain';

export type AudioLevelReading = {
  rmsDb: number;
  peakDb: number;
};

export type AudioLevels = {
  channels: Record<string, AudioLevelReading>;
  master: AudioLevelReading;
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
};

export type AudioGraphSnapshot = {
  master: { volume: number; muted: boolean };
  channels: AudioGraphChannel[];
};

type ArmedSource = {
  node: AudioNode;
  release: () => void;
  /** Input the node is already patched to. Sync must not reconnect a live source. */
  connectedTo: AudioNode | null;
};

/** Capture the microphone as it is. Browser noise suppression, gain riding and echo cancel chop speech. */
export const rawMicrophoneConstraints = (deviceId?: string): MediaTrackConstraints => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
});

type ChannelStrip = {
  sourceIds: string[];
  input: GainNode;
  trim: GainNode;
  /** Empty insert between trim and fader. Later effects connect here. */
  effectsInsert: GainNode;
  fader: GainNode;
  pan: StereoPannerNode;
  mute: GainNode;
  analyser: AnalyserNode;
  programSend: GainNode;
  monitorSend: GainNode;
};

const FLOOR: AudioLevelReading = { rmsDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB };
const PEAK_HOLD_MS = 800;

const silent = (): AudioLevels => ({ channels: {}, master: { ...FLOOR } });

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
  private readonly channels = new Map<string, ChannelStrip>();
  private readonly armed = new Map<string, ArmedSource>();
  private readonly ballistics = new Map<string, { rms: number; peak: number; peakAt: number }>();
  private samples: Float32Array<ArrayBuffer> | null = null;
  private frame = 0;
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

  armStream(sourceId: string, stream: MediaStream): void {
    const context = this.ensureContext();
    void context.resume();
    this.releaseSource(sourceId);
    const node = context.createMediaStreamSource(stream);
    this.armed.set(sourceId, {
      node,
      connectedTo: null,
      release: () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      },
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
    }

    if (this.masterVolume && this.masterMute) {
      this.masterVolume.gain.value = snapshot.master.volume;
      this.masterMute.gain.value = snapshot.master.muted ? 0 : 1;
    }

    this.startMeter();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const sourceId of [...this.armed.keys()]) {
      this.releaseSource(sourceId);
    }
    this.channels.clear();
    this.ballistics.clear();
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
    const masterVolume = context.createGain();
    const masterMute = context.createGain();
    const masterAnalyser = context.createAnalyser();
    masterAnalyser.fftSize = 2048;
    const programDestination = context.createMediaStreamDestination();
    masterInput.connect(masterVolume);
    masterVolume.connect(masterMute);
    masterMute.connect(masterAnalyser);
    masterAnalyser.connect(programDestination);

    const monitorInput = context.createGain();
    monitorInput.connect(context.destination);

    this.context = context;
    this.masterInput = masterInput;
    this.masterVolume = masterVolume;
    this.masterMute = masterMute;
    this.masterAnalyser = masterAnalyser;
    this.programDestination = programDestination;
    this.monitorInput = monitorInput;
    this.samples = new Float32Array(masterAnalyser.fftSize);
    return context;
  }

  private createStrip(context: AudioContext): ChannelStrip {
    const input = context.createGain();
    const trim = context.createGain();
    const effectsInsert = context.createGain();
    const fader = context.createGain();
    const pan = context.createStereoPanner();
    const mute = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    const programSend = context.createGain();
    const monitorSend = context.createGain();
    const sourceIds: string[] = [];

    input.connect(trim);
    trim.connect(effectsInsert);
    effectsInsert.connect(fader);
    fader.connect(pan);
    pan.connect(mute);
    mute.connect(analyser);
    analyser.connect(programSend);
    analyser.connect(monitorSend);
    programSend.connect(this.masterInput!);
    monitorSend.connect(this.monitorInput!);

    return { sourceIds, input, trim, effectsInsert, fader, pan, mute, analyser, programSend, monitorSend };
  }

  private disconnectStrip(strip: ChannelStrip): void {
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
    for (const [id, strip] of this.channels) {
      strip.analyser.getFloatTimeDomainData(this.samples);
      channels[id] = this.applyBallistics(id, measureTimeDomain(this.samples));
    }
    let master = { ...FLOOR };
    if (this.masterAnalyser) {
      this.masterAnalyser.getFloatTimeDomainData(this.samples);
      master = this.applyBallistics('master', measureTimeDomain(this.samples));
    }
    this.listener?.({ channels, master });
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
