import { describe, expect, it } from 'vitest';

import { createDefaultAnimationSourceFields } from '../../models/source.domain';
import { animationSourceSettingsSchema } from '../../schemas/animation-source.schema';
import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { PLACEHOLDER_PANEL_ASSET_ID } from '../add-element-definitions';
import { addLayer } from './layer-commands';
import {
  addSource,
  findSource,
  removeSource,
  renameSource,
  updateAnimationSource,
  updateBrowserSource,
} from './source-commands';

describe('source commands', () => {
  it('adds, renames, finds, and removes unused sources', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 's2', 'src-new']);
    let current = session;

    const added = addSource(current, { type: 'text', name: 'Lower Third', content: 'News' }, ctx);
    expect(added.ok).toBe(true);
    if (added.ok) {
      current = added.value;
      expect(current.project?.sources).toHaveLength(1);
    }

    const sourceId = current.project!.sources[0]!.id;
    const renamed = renameSource(current, sourceId, 'LT', ctx);
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      current = renamed.value;
    }

    const found = findSource(current, sourceId);
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.value.name).toBe('LT');
    }

    const removed = removeSource(current, sourceId, ctx);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.project?.sources).toHaveLength(0);
    }
  });

  it('creates a missing asset placeholder when adding an image source', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'src-img']);
    const added = addSource(session, { type: 'image', name: 'Photo', assetId: PLACEHOLDER_PANEL_ASSET_ID }, ctx);
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.value.project?.assets).toHaveLength(1);
      expect(added.value.project?.assets[0]?.availability).toBe('missing');
      expect(added.value.project?.sources).toHaveLength(1);
    }
  });

  it('updates a browser page address and rejects a value that is not a url', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'src-browser']);
    const added = addSource(
      session,
      {
        type: 'browser',
        name: 'Overlay',
        url: 'https://example.com',
        width: 1920,
        height: 1080,
        refreshSettings: { intervalMs: null, refreshOnActivate: true, bypassCache: false },
      },
      ctx,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const sourceId = added.value.project!.sources[0]!.id;
    const updated = updateBrowserSource(
      added.value,
      sourceId,
      { url: 'https://streamlabs.com/alert-box/v3/demo' },
      ctx,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const source = updated.value.project?.sources[0];
      expect(source?.type === 'browser' && source.url).toBe('https://streamlabs.com/alert-box/v3/demo');
    }

    const rejected = updateBrowserSource(added.value, sourceId, { url: 'alert-box' }, ctx);
    expect(rejected.ok).toBe(false);
    const unchanged = added.value.project?.sources[0];
    expect(unchanged?.type === 'browser' && unchanged.url).toBe('https://example.com');
  });

  it('fills playback defaults for an older animation source', () => {
    const parsed = animationSourceSettingsSchema.safeParse({
      mediaKind: 'gif',
      startFrame: 0,
      startOffsetMs: 0,
      durationMs: null,
      trigger: 'on-activate',
      intervalMs: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.playbackMode).toBe('once');
    expect(parsed.data.repeatCount).toBe(1);
    expect(parsed.data.endBehavior).toBe('hold');
    expect(parsed.data.pauseOnHide).toBe(true);
    expect(parsed.data.volume).toBe(1);
  });

  it('updates an animation source and rejects a playback rate of zero', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'src-anim']);
    const added = addSource(
      session,
      { type: 'animation', name: 'Logo', ...createDefaultAnimationSourceFields('gif') },
      ctx,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const sourceId = added.value.project!.sources[0]!.id;
    const updated = updateAnimationSource(
      added.value,
      sourceId,
      { mediaKind: 'video', format: 'webm', volume: 0.4 },
      ctx,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const source = updated.value.project?.sources[0];
      expect(source?.type === 'animation' && source.mediaKind).toBe('video');
      expect(source?.type === 'animation' && source.format).toBe('webm');
      expect(source?.type === 'animation' && source.volume).toBe(0.4);
    }
    const rejected = updateAnimationSource(added.value, sourceId, { playbackRate: 0 }, ctx);
    expect(rejected.ok).toBe(false);
  });

  it('rejects animation updates for a source of another type', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'src-text']);
    const added = addSource(session, { type: 'text', name: 'Caption', content: 'Hi' }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const sourceId = added.value.project!.sources[0]!.id;
    const rejected = updateAnimationSource(added.value, sourceId, { playbackRate: 1 }, ctx);
    expect(rejected.ok).toBe(false);
  });

  it('rejects removing sources referenced by layers', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 's2', 'layer1', 'src1']);
    let current = session;
    const source = addSource(current, { type: 'text', name: 'Caption', content: 'Hi' }, ctx);
    if (source.ok) {
      current = source.value;
    }
    const sourceId = current.project!.sources[0]!.id;
    const sceneId = current.project!.scenes[0]!.id;
    const layer = addLayer(current, sceneId, sourceId, undefined, ctx);
    if (layer.ok) {
      current = layer.value;
    }

    const before = structuredClone(current);
    const result = removeSource(current, sourceId, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('reference-conflict');
    }
    expect(current).toEqual(before);
  });
});
