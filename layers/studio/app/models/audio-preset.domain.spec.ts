import { describe, expect, it } from 'vitest';

import { instantiateEffectTemplate } from './audio-effect.domain';
import { channelMatchesPreset, effectMatchesTemplate, SYSTEM_CHANNEL_PRESETS } from './audio-preset.domain';

describe('audio preset match', () => {
  it('treats a copied chain as the applied preset and drops the match after an edit', () => {
    const preset = SYSTEM_CHANNEL_PRESETS[0];
    expect(preset).toBeDefined();
    if (!preset) {
      return;
    }
    const effects = preset.effects.map((template, index) => instantiateEffectTemplate(template, `effect-${index}`));
    const channel = { trimDb: preset.trimDb, faderDb: preset.faderDb, pan: preset.pan, muted: preset.muted, effects };

    expect(channelMatchesPreset(channel, preset)).toBe(true);
    expect(channelMatchesPreset({ ...channel, faderDb: -6 }, preset)).toBe(false);
    expect(channelMatchesPreset({ ...channel, effects: effects.slice(1) }, preset)).toBe(false);

    const edited = effects[0];
    const template = preset.effects[0];
    expect(edited?.type).toBe('high-pass');
    if (edited?.type !== 'high-pass' || !template) {
      return;
    }
    const changed = {
      ...edited,
      parameters: { ...edited.parameters, frequencyHz: edited.parameters.frequencyHz + 10 },
    };
    expect(channelMatchesPreset({ ...channel, effects: [changed, ...effects.slice(1)] }, preset)).toBe(false);
    expect(effectMatchesTemplate(changed, template)).toBe(false);
    expect(effectMatchesTemplate(edited, template)).toBe(true);
  });
});
