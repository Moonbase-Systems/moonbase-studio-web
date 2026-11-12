import { describe, expect, it } from 'vitest';

import { createDefaultShapeElementSettings } from '../models/scene-elements/shape-element.domain';
import { createDefaultTextElementSettings, type TextElement } from '../models/scene-elements/text-element.domain';
import { createDefaultAnimationSourceFields } from '../models/source.domain';
import { measureDynamicTextFrame } from '../playback/measure-text-frame';
import { shapeSettingsSchema, textSettingsSchema } from '../schemas/scene-elements/scene-element.schema';
import { createSessionWithProject } from '../test-utils/studio-session-fixtures';
import { addAsset } from './commands/asset-commands';
import { addLayer, updateLayer } from './commands/layer-commands';
import { addSource } from './commands/source-commands';
import { SHAPE_FRAME_SIZE } from './element-frame';

const openStudio = () =>
  createSessionWithProject([
    'project',
    'scene-1',
    'scene-2',
    'asset-plain',
    'source-shape',
    'element-shape',
    'source-text',
    'element-text',
    'source-image',
    'element-image',
    'asset-sized',
    'source-sized',
    'element-sized',
    'source-screen',
    'element-screen',
    'source-display',
    'element-display',
    'source-animation',
    'element-animation',
  ]);

describe('element creation frames', () => {
  it('gives shapes a 100 by 100 frame and turns a legacy line into a triangle', () => {
    const { session, ctx } = openStudio();
    const sceneId = session.project!.scenes[0]!.id;
    const sourced = addSource(session, { type: 'shape', name: 'Line', shapeKind: 'line' }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok) {
      return;
    }

    const added = addLayer(sourced.value, sceneId, sourced.value.project!.sources[0]!.id, undefined, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const element = added.value.project!.scenes[0]!.elements[0]!;
    expect(element.type).toBe('shape');
    if (element.type !== 'shape') {
      return;
    }
    expect(element.settings.shapeType).toBe('triangle');
    expect(element.transform.width).toBe(SHAPE_FRAME_SIZE);
    expect(element.transform.height).toBe(SHAPE_FRAME_SIZE);
  });

  it('creates text as a dynamic frame that follows later edits until the size is set by hand', () => {
    const { session, ctx } = openStudio();
    const sceneId = session.project!.scenes[0]!.id;
    const sourced = addSource(session, { type: 'text', name: 'Title', content: 'Hello' }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok) {
      return;
    }

    const added = addLayer(sourced.value, sceneId, sourced.value.project!.sources[0]!.id, undefined, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const created = added.value.project!.scenes[0]!.elements[0]!;
    expect(created.type).toBe('text');
    if (created.type !== 'text') {
      return;
    }
    const initial = measureDynamicTextFrame(createDefaultTextElementSettings('Hello'));
    expect(created.settings.sizing).toBe('dynamic');
    expect(created.transform.width).toBe(initial.width);
    expect(created.transform.height).toBe(initial.height);

    const edited = updateLayer(added.value, sceneId, created.id, { settings: { text: 'Hello there' } }, ctx);
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    const text = edited.value.project!.scenes[0]!.elements[0] as TextElement;
    expect(text.transform.width).toBe(measureDynamicTextFrame(text.settings).width);
    expect(text.settings.sizing).toBe('dynamic');

    const locked = updateLayer(edited.value, sceneId, created.id, { transform: { width: 320 } }, ctx);
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    const fixed = updateLayer(locked.value, sceneId, created.id, { settings: { text: 'A much longer caption' } }, ctx);
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) {
      return;
    }
    const held = fixed.value.project!.scenes[0]!.elements[0] as TextElement;
    expect(held.settings.sizing).toBe('fixed');
    expect(held.transform.width).toBe(320);
  });

  it('starts screen, image and animation at 0 by 0 and copies the size once the source has one', () => {
    const { session, ctx } = openStudio();
    const sceneId = session.project!.scenes[0]!.id;

    const imageSource = addSource(session, { type: 'image', name: 'Empty', assetId: 'asset-plain' }, ctx);
    expect(imageSource.ok).toBe(true);
    if (!imageSource.ok) {
      return;
    }
    const imageLayer = addLayer(
      imageSource.value,
      sceneId,
      imageSource.value.project!.sources.at(-1)!.id,
      undefined,
      ctx,
    );
    expect(imageLayer.ok).toBe(true);
    if (!imageLayer.ok) {
      return;
    }
    expect(imageLayer.value.project!.scenes[0]!.elements.at(-1)!.transform).toMatchObject({ width: 0, height: 0 });

    const asset = addAsset(
      imageLayer.value,
      {
        name: 'photo.png',
        type: 'image',
        location: { kind: 'storageKey', key: 'local/photo' },
        availability: 'available',
        metadata: { width: 800, height: 600 },
      },
      ctx,
    );
    expect(asset.ok).toBe(true);
    if (!asset.ok) {
      return;
    }
    const sizedSource = addSource(
      asset.value,
      { type: 'image', name: 'Photo', assetId: asset.value.project!.assets.at(-1)!.id },
      ctx,
    );
    expect(sizedSource.ok).toBe(true);
    if (!sizedSource.ok) {
      return;
    }
    const imageId = imageLayer.value.project!.scenes[0]!.elements.at(-1)!.id;
    const photoId = sizedSource.value.project!.sources.at(-1)!.id;
    const picked = updateLayer(sizedSource.value, sceneId, imageId, { sourceId: photoId }, ctx);
    expect(picked.ok).toBe(true);
    if (!picked.ok) {
      return;
    }
    expect(picked.value.project!.scenes[0]!.elements[0]!.transform).toMatchObject({ width: 800, height: 600 });

    const screen = addSource(picked.value, { type: 'screen', name: 'Desktop', width: 2560, height: 1440 }, ctx);
    expect(screen.ok).toBe(true);
    if (!screen.ok) {
      return;
    }
    const screenLayer = addLayer(screen.value, sceneId, screen.value.project!.sources.at(-1)!.id, undefined, ctx);
    expect(screenLayer.ok).toBe(true);
    if (!screenLayer.ok) {
      return;
    }
    expect(screenLayer.value.project!.scenes[0]!.elements.at(-1)!.transform).toMatchObject({
      width: 2560,
      height: 1440,
    });

    const animation = addSource(
      screenLayer.value,
      { type: 'animation', name: 'Loop', ...createDefaultAnimationSourceFields('gif') },
      ctx,
    );
    expect(animation.ok).toBe(true);
    if (!animation.ok) {
      return;
    }
    const animationLayer = addLayer(
      animation.value,
      sceneId,
      animation.value.project!.sources.at(-1)!.id,
      undefined,
      ctx,
    );
    expect(animationLayer.ok).toBe(true);
    if (!animationLayer.ok) {
      return;
    }
    expect(animationLayer.value.project!.scenes[0]!.elements.at(-1)!.transform).toMatchObject({ width: 0, height: 0 });
  });

  it('accepts saved text without a sizing field and rewrites a saved line shape', () => {
    const { sizing: _sizing, ...textWithoutSizing } = createDefaultTextElementSettings('Hi');
    expect(textSettingsSchema.parse(textWithoutSizing).sizing).toBe('dynamic');

    expect(shapeSettingsSchema.parse({ ...createDefaultShapeElementSettings(), shapeType: 'line' }).shapeType).toBe(
      'triangle',
    );
  });
});
