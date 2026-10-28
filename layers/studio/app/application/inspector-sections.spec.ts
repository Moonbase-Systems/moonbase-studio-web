import { describe, expect, it } from 'vitest';

import { inspectorShowsVisualSections, inspectorTabsForElementType } from './inspector-sections';

describe('inspectorTabsForElementType', () => {
  it('uses mix and sync tabs for audio elements without transform', () => {
    const tabs = inspectorTabsForElementType('audioVisual');
    expect(tabs.map((tab) => tab.id)).toEqual(['mix', 'sync']);
    expect(inspectorShowsVisualSections('audioVisual')).toBe(false);
  });

  it('starts text elements with a primary text tab', () => {
    const tabs = inspectorTabsForElementType('text');
    expect(tabs[0]?.id).toBe('text');
    expect(tabs[0]?.panels).toContain('textPrimary');
  });

  it('groups crop with visual settings on video elements', () => {
    const visual = inspectorTabsForElementType('video').find((tab) => tab.id === 'visual');
    expect(visual?.panels).toEqual(['visualFit', 'crop']);
  });

  it('includes separate crop tab for image elements', () => {
    const tabs = inspectorTabsForElementType('image').map((tab) => tab.id);
    expect(tabs).toContain('crop');
    expect(tabs).toContain('visual');
  });
});
