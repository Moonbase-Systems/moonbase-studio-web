import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { PLACEHOLDER_PANEL_ASSET_ID } from '../add-element-definitions';
import { addLayer } from './layer-commands';
import { addSource, findSource, removeSource, renameSource } from './source-commands';

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
