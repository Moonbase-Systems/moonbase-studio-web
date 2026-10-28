import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { PLACEHOLDER_PANEL_ASSET_ID } from '../add-element-definitions';
import { addLayer, updateLayer } from './layer-commands';
import { addSource } from './source-commands';

describe('layer settings updates', () => {
  it('updates image settings without changing the linked source', () => {
    const fixture = createSessionWithProject(['p1', 's1', 's2', 'src1', 'layer1', 'asset1']);
    let session = fixture.session;
    const addedSource = addSource(
      session,
      { type: 'image', name: 'Img', assetId: PLACEHOLDER_PANEL_ASSET_ID },
      fixture.ctx,
    );
    if (addedSource.ok) {
      session = addedSource.value;
    }
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    const sourceBefore = structuredClone(session.project!.sources[0]);

    const addedLayer = addLayer(session, sceneId, sourceId, undefined, fixture.ctx);
    expect(addedLayer.ok).toBe(true);
    if (!addedLayer.ok) {
      return;
    }
    session = addedLayer.value;
    const layerId = session.project!.scenes[0]!.elements[0]!.id;

    const updated = updateLayer(session, sceneId, layerId, { settings: { fitMode: 'cover' } }, fixture.ctx);
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      const element = updated.value.project!.scenes[0]!.elements[0]!;
      expect(element.type).toBe('image');
      if (element.type === 'image') {
        expect(element.settings.fitMode).toBe('cover');
      }
      expect(updated.value.project!.sources[0]).toEqual(sourceBefore);
    }
  });

  it('rejects settings fields invalid for element type', () => {
    const fixture = createSessionWithProject(['p1', 's1', 's2', 'src1', 'layer1', 'asset1']);
    let session = fixture.session;
    const addedSource = addSource(session, { type: 'text', name: 'T', content: 'Hi' }, fixture.ctx);
    if (addedSource.ok) {
      session = addedSource.value;
    }
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    const addedLayer = addLayer(session, sceneId, sourceId, undefined, fixture.ctx);
    if (addedLayer.ok) {
      session = addedLayer.value;
    }
    const layerId = session.project!.scenes[0]!.elements[0]!.id;

    const bad = updateLayer(session, sceneId, layerId, { settings: { fitMode: 'cover' } }, fixture.ctx);
    expect(bad.ok).toBe(false);
  });
});
