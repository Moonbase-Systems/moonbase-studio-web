import { createDefaultElementCrop } from '../models/common.domain';
import { createEmptyProject, type Project, type ProjectFile } from '../models/project.domain';
import { createDefaultImageElementSettings } from '../models/scene-elements/image-element.domain';
import { createDefaultElementTransform } from '../models/scene-elements/scene-element-base.domain';
import { toProjectFile } from '../serialization/project-file';

export const createValidProject = (): Project =>
  createEmptyProject({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Test Project',
    type: 'general',
    sceneId: '22222222-2222-4222-8222-222222222222',
  });

export const createValidProjectFile = (): ProjectFile => toProjectFile(createValidProject());

export const createProjectFileWithSources = (): ProjectFile => {
  const file = createValidProjectFile();
  const assetId = '33333333-3333-4333-8333-333333333333';
  const sourceId = '44444444-4444-4444-8444-444444444444';
  const elementId = '55555555-5555-4555-8555-555555555555';
  const video = file.project.settings.video;

  return {
    ...file,
    project: {
      ...file.project,
      assets: [
        {
          id: assetId,
          name: 'hero.png',
          type: 'image',
          location: { kind: 'storageKey', key: 'assets/hero.png' },
          availability: 'available',
        },
      ],
      sources: [
        {
          id: sourceId,
          name: 'Hero Image',
          type: 'image',
          assetId,
        },
      ],
      scenes: [
        {
          ...file.project.scenes[0]!,
          elements: [
            {
              id: elementId,
              name: 'Hero Layer',
              type: 'image',
              sourceId,
              parentGroupId: null,
              transform: createDefaultElementTransform(video),
              crop: createDefaultElementCrop(),
              appearance: { opacity: 1 },
              settings: createDefaultImageElementSettings(),
              effects: [],
              visibility: true,
              locked: false,
            },
          ],
        },
      ],
    },
  };
};
