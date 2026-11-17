import { rawMicrophoneConstraints } from './audio-engine';

export type DeviceTrack = {
  readyState: string;
  stop: () => void;
  addEventListener: (type: 'ended', listener: () => void) => void;
  removeEventListener: (type: 'ended', listener: () => void) => void;
};

export type DeviceStream = {
  getAudioTracks: () => DeviceTrack[];
  getTracks: () => DeviceTrack[];
};

export type DeviceInfo = {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
};

export type AudioDevicePort = {
  enumerateDevices: () => Promise<DeviceInfo[]>;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<DeviceStream>;
  addDeviceChangeListener: (listener: () => void) => void;
  removeDeviceChangeListener: (listener: () => void) => void;
};

export type AudioInputStatus = 'available' | 'active' | 'disconnected' | 'start-error';

export type AudioInputView = {
  deviceId: string;
  label: string;
  groupId: string;
  named: boolean;
  status: AudioInputStatus;
  error: string | null;
};

export type AudioOutputView = {
  deviceId: string;
  label: string;
  groupId: string;
  named: boolean;
};

export type AudioDeviceSnapshot = {
  permission: 'unknown' | 'granted' | 'denied';
  /** Devices exist, but the browser has not revealed their names yet. This is not a device error. */
  labelsHidden: boolean;
  inputs: AudioInputView[];
  outputs: AudioOutputView[];
};

const denied = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
};

/**
 * Session inventory of audio devices. It does not live in the project file.
 * Losing a microphone marks the device disconnected and leaves the source id in place.
 * Screen and tab capture are never started here.
 */
export class AudioDeviceSession {
  private listedInputs: DeviceInfo[] = [];
  private listedOutputs: DeviceInfo[] = [];
  private permission: AudioDeviceSnapshot['permission'] = 'unknown';
  private readonly activeBySource = new Map<string, { deviceId: string; tracks: DeviceTrack[] }>();
  private readonly disconnected = new Set<string>();
  private readonly startErrors = new Map<string, string>();
  private readonly stoppedByUs = new WeakSet<DeviceTrack>();
  private readonly listeners = new Set<(snapshot: AudioDeviceSnapshot) => void>();
  private deviceChange: (() => void) | null = null;

  constructor(private readonly port: AudioDevicePort) {}

  ownedSourceIds(): string[] {
    return [...this.activeBySource.keys()];
  }

  start(): () => void {
    this.deviceChange = () => {
      void this.refresh();
    };
    this.port.addDeviceChangeListener(this.deviceChange);
    void this.refresh();
    return () => {
      if (this.deviceChange) {
        this.port.removeDeviceChangeListener(this.deviceChange);
        this.deviceChange = null;
      }
    };
  }

  subscribe(listener: (snapshot: AudioDeviceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): AudioDeviceSnapshot {
    const extras: DeviceInfo[] = [];
    for (const active of this.activeBySource.values()) {
      if (!this.listedInputs.some((device) => device.deviceId === active.deviceId)) {
        extras.push({ deviceId: active.deviceId, kind: 'audioinput', label: '', groupId: '' });
      }
    }
    const inputs = [...this.listedInputs, ...extras].map((device) => this.viewInput(device));
    const labelsHidden = this.permission !== 'granted' && inputs.some((device) => !device.named);
    return {
      permission: this.permission,
      labelsHidden,
      inputs,
      outputs: this.listedOutputs.map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
        groupId: device.groupId,
        named: device.label.trim().length > 0,
      })),
    };
  }

  async refresh(): Promise<void> {
    const devices = await this.port.enumerateDevices();
    this.listedInputs = devices.filter((device) => device.kind === 'audioinput');
    this.listedOutputs = devices.filter((device) => device.kind === 'audiooutput');
    const known = new Set(this.listedInputs.map((device) => device.deviceId));
    for (const active of this.activeBySource.values()) {
      if (!known.has(active.deviceId)) {
        this.disconnected.add(active.deviceId);
      }
    }
    this.emit();
  }

  /** User gesture that lets the browser reveal device names. The probe stream is closed immediately. */
  async revealLabels(): Promise<void> {
    try {
      const stream = await this.port.getUserMedia({ audio: rawMicrophoneConstraints() });
      this.stopTracks(stream.getTracks());
      this.permission = 'granted';
    } catch (error) {
      if (denied(error)) {
        this.permission = 'denied';
      } else {
        throw error;
      }
    }
    await this.refresh();
  }

  async startMicrophone(sourceId: string, deviceId: string): Promise<DeviceStream> {
    try {
      const stream = await this.port.getUserMedia({ audio: rawMicrophoneConstraints(deviceId) });
      const previous = this.activeBySource.get(sourceId);
      const tracks = stream.getAudioTracks();
      this.activeBySource.set(sourceId, { deviceId, tracks });
      this.disconnected.delete(deviceId);
      this.startErrors.delete(deviceId);
      this.permission = 'granted';
      for (const track of tracks) {
        track.addEventListener('ended', () => {
          this.onEnded(sourceId, deviceId, track);
        });
      }
      if (previous) {
        this.stopTracks(previous.tracks);
      }
      this.emit();
      return stream;
    } catch (error) {
      if (denied(error)) {
        this.permission = 'denied';
      } else {
        const message = error instanceof Error ? error.message : 'start-error';
        this.startErrors.set(deviceId, message);
      }
      this.emit();
      throw error;
    }
  }

  /** Stops these tracks. Forgets the source only when they are still the active ones. */
  releaseTracks(sourceId: string, tracks: readonly DeviceTrack[]): void {
    this.stopTracks(tracks);
    const active = this.activeBySource.get(sourceId);
    if (
      !active ||
      active.tracks.length !== tracks.length ||
      active.tracks.some((track, index) => track !== tracks[index])
    ) {
      return;
    }
    this.activeBySource.delete(sourceId);
    const stillUsed = [...this.activeBySource.values()].some((item) => item.deviceId === active.deviceId);
    if (!stillUsed) {
      this.disconnected.delete(active.deviceId);
    }
    this.emit();
  }

  /** Drops the bookkeeping for a source. Does not remove the project source. */
  releaseSource(sourceId: string): void {
    const active = this.activeBySource.get(sourceId);
    if (!active) {
      return;
    }
    this.releaseTracks(sourceId, active.tracks);
  }

  private stopTracks(tracks: readonly DeviceTrack[]): void {
    for (const track of tracks) {
      this.stoppedByUs.add(track);
      track.stop();
    }
  }

  private onEnded(sourceId: string, deviceId: string, track: DeviceTrack): void {
    if (this.stoppedByUs.has(track)) {
      return;
    }
    const active = this.activeBySource.get(sourceId);
    if (!active || !active.tracks.includes(track)) {
      return;
    }
    this.disconnected.add(deviceId);
    this.emit();
  }

  private viewInput(device: DeviceInfo): AudioInputView {
    const named = device.label.trim().length > 0;
    let status: AudioInputStatus = 'available';
    if (this.startErrors.has(device.deviceId)) {
      status = 'start-error';
    } else if (this.disconnected.has(device.deviceId)) {
      status = 'disconnected';
    } else if ([...this.activeBySource.values()].some((item) => item.deviceId === device.deviceId)) {
      status = 'active';
    }
    return {
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
      named,
      status,
      error: this.startErrors.get(device.deviceId) ?? null,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
