import type { AssetId, ChannelId, ElementId, SceneId, SourceId, TransitionId } from '../models/ids.domain';
import type { PortResult } from '../ports/result';

export type StudioValidationIssue = { path: string; message: string };

export type StudioReference = {
  kind: 'layer' | 'audio-channel';
  sceneId?: SceneId;
  layerId?: ElementId;
  channelId?: string;
};

export type StudioError =
  | { kind: 'no-project' }
  | { kind: 'invalid-state'; reason: string }
  | { kind: 'scene-not-found'; sceneId: SceneId }
  | { kind: 'layer-not-found'; sceneId: SceneId; layerId: ElementId }
  | { kind: 'source-not-found'; sourceId: SourceId }
  | { kind: 'asset-not-found'; assetId: AssetId }
  | { kind: 'channel-not-found'; channelId: ChannelId }
  | { kind: 'transition-not-found'; transitionId: TransitionId }
  | { kind: 'invalid-argument'; message: string; issues?: StudioValidationIssue[] }
  | { kind: 'reference-conflict'; sourceId: SourceId; references: StudioReference[] }
  | {
      kind: 'rule-violation';
      rule: 'last-scene' | 'layer-locked' | 'asset-in-use' | 'transition-in-use';
      message: string;
    };

export type StudioResult<T> = PortResult<T, StudioError>;
