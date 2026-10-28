import { z } from 'zod';

import type { Asset, AssetAvailability, AssetLocation, AssetMetadata } from '../../models/asset.domain';
import type { AssetId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import type { Source } from '../../models/source.domain';
import { portErr } from '../../ports/result';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

const assetNameSchema = z.string().trim().min(1).max(256);

export type AssetDraft = Omit<Asset, 'id'>;

export type AssetChanges = {
  name?: string;
  availability?: AssetAvailability;
  location?: AssetLocation;
  metadata?: AssetMetadata;
};

const sourceAssetId = (source: Source): AssetId | undefined => {
  switch (source.type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'animation':
      return source.assetId;
    default:
      return undefined;
  }
};

const projectUsesAsset = (project: Project, assetId: AssetId): boolean => {
  for (const source of project.sources) {
    if (sourceAssetId(source) === assetId) {
      return true;
    }
  }

  for (const scene of project.scenes) {
    if (scene.background.kind === 'image' && scene.background.assetId === assetId) {
      return true;
    }
    if (scene.animations.onEnter?.assetId === assetId || scene.animations.onExit?.assetId === assetId) {
      return true;
    }
    for (const element of scene.elements) {
      if (element.type === 'overlay' && element.animations.some((animation) => animation.assetId === assetId)) {
        return true;
      }
    }
  }

  return false;
};

export const addAsset = (
  session: StudioSession,
  draft: AssetDraft,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const parsedName = assetNameSchema.safeParse(draft.name);
  if (!parsedName.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsedName.error.issues[0]?.message ?? 'Invalid asset name',
    });
  }

  const asset: Asset = {
    ...structuredClone(draft),
    id: ctx.generateId(),
    name: parsedName.data,
  };

  return withClonedProject(
    session,
    (project) => {
      project.assets.push(asset);
    },
    ctx,
  );
};

export const updateAsset = (
  session: StudioSession,
  assetId: AssetId,
  changes: AssetChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const asset = session.project.assets.find((item) => item.id === assetId);
  if (!asset) {
    return portErr({ kind: 'asset-not-found', assetId });
  }

  let name: string | undefined;
  if (changes.name !== undefined) {
    const parsedName = assetNameSchema.safeParse(changes.name);
    if (!parsedName.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsedName.error.issues[0]?.message ?? 'Invalid asset name',
      });
    }
    name = parsedName.data;
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.assets.find((item) => item.id === assetId)!;
      if (name !== undefined) {
        target.name = name;
      }
      if (changes.availability !== undefined) {
        target.availability = changes.availability;
      }
      if (changes.location !== undefined) {
        target.location = structuredClone(changes.location);
      }
      if (changes.metadata !== undefined) {
        target.metadata = structuredClone(changes.metadata);
      }
    },
    ctx,
  );
};

export const removeAsset = (
  session: StudioSession,
  assetId: AssetId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (!session.project.assets.some((item) => item.id === assetId)) {
    return portErr({ kind: 'asset-not-found', assetId });
  }

  if (projectUsesAsset(session.project, assetId)) {
    return portErr({
      kind: 'rule-violation',
      rule: 'asset-in-use',
      message: 'Asset is still referenced by a source, scene, or overlay',
    });
  }

  return withClonedProject(
    session,
    (project) => {
      project.assets = project.assets.filter((item) => item.id !== assetId);
    },
    ctx,
  );
};
