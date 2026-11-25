import type { Asset } from './asset.domain';
import type { AudioMixer } from './audio.domain';
import { createDefaultAudioMixer } from './audio.domain';
import type { ProjectHistory } from './history.domain';
import { createEmptyHistory } from './history.domain';
import type { ProjectId } from './ids.domain';
import { createDefaultOutputProfile, type OutputProfile } from './output-profile.domain';
import { createEmptyScene, type Scene } from './scene.domain';
import type { Source } from './source.domain';
import type { Transition } from './transition.domain';

export type ProjectType = 'podcast' | 'gaming' | 'broadcast' | 'general';

/** Color metadata for the frame. Width, height and frame rate live on `OutputProfile`. */
export type ProjectVideoSettings = {
  colorSpace?: string;
};

export type ProjectAudioSettings = {
  sampleRate: number;
  channels: number;
};

/** Transmission slot. Not the output frame. */
export type ProjectOutputSettings = {
  profile?: string;
};

export type ProjectPreferences = {
  defaultSceneName?: string;
};

export type ProjectSettings = {
  video: ProjectVideoSettings;
  /** The project's single output frame. */
  outputProfile: OutputProfile;
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
  formatVersion: 4;
  project: Omit<Project, 'history'>;
};

export const createDefaultProjectSettings = (): ProjectSettings => ({
  video: {},
  outputProfile: createDefaultOutputProfile(crypto.randomUUID()),
  audio: { sampleRate: 48000, channels: 2 },
  output: {},
  preferences: {},
});

export const createEmptyProject = (input: {
  id: ProjectId;
  name: string;
  type: ProjectType;
  /** When set, project starts with one empty scene (tests / fixtures). */
  sceneId?: string;
}): Project => {
  const now = new Date().toISOString();
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    settings: createDefaultProjectSettings(),
    scenes: input.sceneId ? [createEmptyScene({ id: input.sceneId, name: 'Scene 1' })] : [],
    sources: [],
    assets: [],
    audioMixer: createDefaultAudioMixer(),
    transitions: [],
    history: createEmptyHistory(),
    metadata: { createdAt: now, updatedAt: now },
  };
};
