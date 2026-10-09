import type { Asset } from './asset.domain';
import type { AudioMixer } from './audio.domain';
import { createDefaultAudioMixer } from './audio.domain';
import type { ProjectHistory } from './history.domain';
import { createEmptyHistory } from './history.domain';
import type { ProjectId } from './ids.domain';
import type { Scene } from './scene.domain';
import type { Source } from './source.domain';
import type { Transition } from './transition.domain';

export type ProjectType = 'podcast' | 'gaming' | 'broadcast' | 'general';

export type ProjectVideoSettings = {
  width: number;
  height: number;
  frameRate: number;
  colorSpace?: string;
};

export type ProjectAudioSettings = {
  sampleRate: number;
  channels: number;
};

export type ProjectOutputSettings = {
  profile?: string;
};

export type ProjectPreferences = {
  defaultSceneName?: string;
};

export type ProjectSettings = {
  video: ProjectVideoSettings;
  audio: ProjectAudioSettings;
  output: ProjectOutputSettings;
  preferences: ProjectPreferences;
};

export type ProjectMetadata = {
  createdAt: string;
  updatedAt: string;
  description?: string;
};

export type Project = {
  id: ProjectId;
  name: string;
  type: ProjectType;
  settings: ProjectSettings;
  scenes: Scene[];
  sources: Source[];
  assets: Asset[];
  audioMixer: AudioMixer;
  transitions: Transition[];
  /** Session-only; omit from ProjectFile. */
  history: ProjectHistory;
  metadata: ProjectMetadata;
};

export type ProjectMeta = {
  id: ProjectId;
  name: string;
  type: ProjectType;
  updatedAt: string;
};

/** Persistable document — history always stripped. */
export type ProjectFile = {
  formatVersion: 1;
  project: Omit<Project, 'history'>;
};

export const createDefaultProjectSettings = (): ProjectSettings => ({
  video: { width: 1920, height: 1080, frameRate: 30 },
  audio: { sampleRate: 48000, channels: 2 },
  output: {},
  preferences: {},
});

export const createEmptyProject = (input: {
  id: ProjectId;
  name: string;
  type: ProjectType;
  sceneId: string;
}): Project => {
  const now = new Date().toISOString();
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    settings: createDefaultProjectSettings(),
    scenes: [
      {
        id: input.sceneId,
        name: 'Scene 1',
        settings: { defaultTransitionId: null },
        background: { kind: 'none' },
        elements: [],
        groups: [],
        animations: { onEnter: null, onExit: null },
      },
    ],
    sources: [],
    assets: [],
    audioMixer: createDefaultAudioMixer(),
    transitions: [],
    history: createEmptyHistory(),
    metadata: { createdAt: now, updatedAt: now },
  };
};
