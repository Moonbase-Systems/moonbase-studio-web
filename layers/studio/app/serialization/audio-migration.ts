import {
  type AudioMonitoringMode,
  SYNC_OFFSET_MS_MAX,
  SYNC_OFFSET_MS_MIN,
  volumeToFaderDb,
} from '../models/audio.domain';

export type AudioMigrationVoteOrigin =
  | { kind: 'scene'; sceneId: string; sceneName: string; elementId: string }
  | { kind: 'channel'; channelId: string; channelName: string };

export type AudioChannelStrip = {
  trimDb: number;
  faderDb: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  monitoring: AudioMonitoringMode;
  syncOffsetMs: number;
};

export type AudioMigrationVote = {
  origin: AudioMigrationVoteOrigin;
  strip: AudioChannelStrip;
};

export type AudioMigrationConflict = {
  sourceId: string;
  channelId: string;
  channelName: string;
  /** The strip written onto the channel. Always the neutral strip when this record exists. */
  strip: AudioChannelStrip;
  votes: AudioMigrationVote[];
};

type JsonRecord = Record<string, unknown>;

const NEUTRAL_STRIP: AudioChannelStrip = {
  trimDb: 0,
  faderDb: 0,
  pan: 0,
  muted: false,
  solo: false,
  monitoring: 'off',
  syncOffsetMs: 0,
};

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const monitoringOf = (value: unknown): AudioMonitoringMode =>
  value === 'monitor' || value === 'monitor-and-output' || value === 'off' ? value : 'off';

const roundDb = (value: number): number => Math.round(value * 100) / 100;

const clampOffset = (value: number): number => Math.round(clamp(value, SYNC_OFFSET_MS_MIN, SYNC_OFFSET_MS_MAX));

const stripsEqual = (left: AudioChannelStrip, right: AudioChannelStrip): boolean =>
  Math.abs(left.trimDb - right.trimDb) < 0.05 &&
  Math.abs(left.faderDb - right.faderDb) < 0.05 &&
  Math.abs(left.pan - right.pan) < 0.001 &&
  left.muted === right.muted &&
  left.solo === right.solo &&
  left.monitoring === right.monitoring &&
  left.syncOffsetMs === right.syncOffsetMs;

const distinctStrips = (votes: AudioMigrationVote[]): AudioChannelStrip[] => {
  const unique: AudioChannelStrip[] = [];
  for (const vote of votes) {
    if (!unique.some((strip) => stripsEqual(strip, vote.strip))) {
      unique.push(vote.strip);
    }
  }
  return unique;
};

const stripFromElement = (settings: unknown): AudioChannelStrip => {
  const record = isRecord(settings) ? settings : {};
  const volume = typeof record.volume === 'number' ? record.volume : 1;
  const gainDb = typeof record.gainDb === 'number' ? record.gainDb : 0;
  const pan = typeof record.pan === 'number' ? record.pan : 0;
  return {
    trimDb: roundDb(clamp(gainDb, -24, 24)),
    faderDb: volumeToFaderDb(volume),
    pan: clamp(pan, -1, 1),
    muted: record.muted === true,
    solo: record.solo === true,
    monitoring: monitoringOf(record.monitoring),
    syncOffsetMs: typeof record.syncOffsetMs === 'number' ? clampOffset(record.syncOffsetMs) : 0,
  };
};

const stripFromChannel = (channel: JsonRecord): AudioChannelStrip => {
  if (typeof channel.faderDb === 'number' || typeof channel.trimDb === 'number') {
    return {
      trimDb: roundDb(clamp(typeof channel.trimDb === 'number' ? channel.trimDb : 0, -24, 24)),
      faderDb: roundDb(clamp(typeof channel.faderDb === 'number' ? channel.faderDb : 0, -60, 12)),
      pan: clamp(typeof channel.pan === 'number' ? channel.pan : 0, -1, 1),
      muted: channel.muted === true,
      solo: channel.solo === true,
      monitoring: monitoringOf(channel.monitoring),
      syncOffsetMs: typeof channel.syncOffsetMs === 'number' ? clampOffset(channel.syncOffsetMs) : 0,
    };
  }
  const volume = typeof channel.volume === 'number' ? channel.volume : 1;
  return {
    trimDb: 0,
    faderDb: volumeToFaderDb(volume),
    pan: clamp(typeof channel.pan === 'number' ? channel.pan : 0, -1, 1),
    muted: channel.muted === true,
    solo: channel.solo === true,
    monitoring: monitoringOf(channel.monitoring),
    syncOffsetMs: typeof channel.syncOffsetMs === 'number' ? clampOffset(channel.syncOffsetMs) : 0,
  };
};

const isFactoryChannel = (channel: JsonRecord): boolean => {
  const strip = stripFromChannel(channel);
  const filters = Array.isArray(channel.filters) ? channel.filters.length : 0;
  const effects = Array.isArray(channel.effects) ? channel.effects.length : 0;
  return stripsEqual(strip, NEUTRAL_STRIP) && filters === 0 && effects === 0;
};

const sourceIdOfChannel = (channel: JsonRecord): string | null => {
  if (typeof channel.sourceId === 'string' && channel.sourceId.length > 0) {
    return channel.sourceId;
  }
  if (Array.isArray(channel.sourceIds) && channel.sourceIds.length === 1 && typeof channel.sourceIds[0] === 'string') {
    return channel.sourceIds[0];
  }
  return null;
};

const isAudioLayer = (element: JsonRecord): boolean => element.type === 'audioVisual' || element.type === 'audio';

export const migrateProjectFileV2ToV3 = (raw: unknown): { file: unknown; conflicts: AudioMigrationConflict[] } => {
  if (!isRecord(raw) || raw.formatVersion !== 2) {
    return { file: raw, conflicts: [] };
  }

  const file = { ...raw };
  const project = isRecord(file.project) ? { ...file.project } : null;
  if (!project) {
    file.formatVersion = 3;
    return { file, conflicts: [] };
  }

  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const mixer = isRecord(project.audioMixer) ? project.audioMixer : {};
  const oldChannels = Array.isArray(mixer.channels) ? mixer.channels.filter(isRecord) : [];

  const votesBySource = new Map<string, AudioMigrationVote[]>();
  const pushVote = (sourceId: string, vote: AudioMigrationVote) => {
    const list = votesBySource.get(sourceId) ?? [];
    list.push(vote);
    votesBySource.set(sourceId, list);
  };

  for (const sceneRaw of scenes) {
    if (!isRecord(sceneRaw) || !Array.isArray(sceneRaw.elements)) {
      continue;
    }
    const sceneId = typeof sceneRaw.id === 'string' ? sceneRaw.id : '';
    const sceneName = typeof sceneRaw.name === 'string' ? sceneRaw.name : sceneId;
    for (const elementRaw of sceneRaw.elements) {
      if (!isRecord(elementRaw) || !isAudioLayer(elementRaw) || typeof elementRaw.sourceId !== 'string') {
        continue;
      }
      pushVote(elementRaw.sourceId, {
        origin: {
          kind: 'scene',
          sceneId,
          sceneName,
          elementId: typeof elementRaw.id === 'string' ? elementRaw.id : '',
        },
        strip: stripFromElement(elementRaw.settings),
      });
    }
  }

  for (const channel of oldChannels) {
    const sourceId = sourceIdOfChannel(channel);
    if (!sourceId || typeof channel.id !== 'string') {
      continue;
    }
    const elementVotes = votesBySource.get(sourceId)?.some((vote) => vote.origin.kind === 'scene') ?? false;
    if (elementVotes && isFactoryChannel(channel)) {
      continue;
    }
    pushVote(sourceId, {
      origin: {
        kind: 'channel',
        channelId: channel.id,
        channelName: typeof channel.name === 'string' ? channel.name : channel.id,
      },
      strip: stripFromChannel(channel),
    });
  }

  const conflicts: AudioMigrationConflict[] = [];
  const channelBySource = new Map<string, JsonRecord>();

  for (const [sourceId, votes] of votesBySource) {
    const previous = oldChannels.find(
      (channel) => sourceIdOfChannel(channel) === sourceId && typeof channel.id === 'string',
    );
    const channelId = previous && typeof previous.id === 'string' ? previous.id : `channel-${sourceId}`;
    const sceneVote = votes.find((vote) => vote.origin.kind === 'scene');
    const sceneElementId = sceneVote?.origin.kind === 'scene' ? sceneVote.origin.elementId : undefined;
    const nameFromScene = sceneElementId
      ? scenes
          .filter(isRecord)
          .flatMap((scene) => (Array.isArray(scene.elements) ? scene.elements.filter(isRecord) : []))
          .find((element) => element.id === sceneElementId && typeof element.name === 'string')
      : undefined;
    const resolvedName =
      (previous && typeof previous.name === 'string' && previous.name.length > 0 ? previous.name : '') ||
      (nameFromScene && typeof nameFromScene.name === 'string' ? nameFromScene.name : '') ||
      sourceId;

    const unique = distinctStrips(votes);
    const strip = unique.length === 1 ? unique[0]! : { ...NEUTRAL_STRIP };
    if (unique.length > 1) {
      conflicts.push({
        sourceId,
        channelId,
        channelName: resolvedName,
        strip,
        votes,
      });
    }

    const filters = previous && Array.isArray(previous.filters) ? previous.filters : [];
    const effects = previous && Array.isArray(previous.effects) ? previous.effects : [];
    channelBySource.set(sourceId, {
      id: channelId,
      name: resolvedName,
      sourceIds: [sourceId],
      ...strip,
      filters,
      effects,
    });
  }

  const keptEmpty = oldChannels
    .filter((channel) => sourceIdOfChannel(channel) === null && typeof channel.id === 'string')
    .map((channel) => ({
      id: channel.id,
      name: typeof channel.name === 'string' && channel.name.length > 0 ? channel.name : 'Audio',
      sourceIds: [],
      ...stripFromChannel(channel),
      filters: Array.isArray(channel.filters) ? channel.filters : [],
      effects: Array.isArray(channel.effects) ? channel.effects : [],
    }));

  project.scenes = scenes.map((sceneRaw) => {
    if (!isRecord(sceneRaw) || !Array.isArray(sceneRaw.elements)) {
      return sceneRaw;
    }
    return {
      ...sceneRaw,
      elements: sceneRaw.elements.map((elementRaw) => {
        if (!isRecord(elementRaw) || !isAudioLayer(elementRaw) || typeof elementRaw.sourceId !== 'string') {
          return elementRaw;
        }
        const channel = channelBySource.get(elementRaw.sourceId);
        if (!channel || typeof channel.id !== 'string') {
          return elementRaw;
        }
        const { sourceId: _sourceId, ...rest } = elementRaw;
        return {
          ...rest,
          type: 'audioVisual',
          channelId: channel.id,
          settings: {},
        };
      }),
    };
  });

  project.audioMixer = {
    ...mixer,
    master: isRecord(mixer.master) ? mixer.master : { volume: 1, muted: false },
    channels: [...channelBySource.values(), ...keptEmpty],
  };

  file.project = project;
  file.formatVersion = 3;
  return { file, conflicts };
};
