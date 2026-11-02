import { describe, expect, it } from 'vitest';

import { inspectorPanelsForRail, inspectorRailsForElementType } from './inspector-sections';

describe('inspectorRailsForElementType', () => {
  it('uses audio and filters rails for audio elements', () => {
    const rails = inspectorRailsForElementType('audioVisual');
    expect(rails.map((rail) => rail.id)).toEqual(['source', 'effects']);
  });

  it('uses source and transform for text', () => {
    expect(inspectorRailsForElementType('text').map((rail) => rail.id)).toEqual(['source', 'transform']);
  });

  it('uses three rails for visual elements without a separate crop rail', () => {
    const rails = inspectorRailsForElementType('image').map((rail) => rail.id);
    expect(rails).toEqual(['source', 'transform', 'effects']);
    expect(rails).not.toContain('crop');
  });

  it('maps transform rail to a single transform panel', () => {
    expect(inspectorPanelsForRail('text', 'transform')).toEqual(['transform']);
    expect(inspectorPanelsForRail('image', 'transform')).toEqual(['transform']);
  });

  it('maps source rail to the primary card for each type', () => {
    expect(inspectorPanelsForRail('text', 'source')).toEqual(['textPrimary']);
    expect(inspectorPanelsForRail('screen', 'source')).toEqual(['visualFit']);
    expect(inspectorPanelsForRail('video', 'source')).toEqual(['videoPlayback']);
  });
});
