import type { ElementEffectBase } from './effect-base.domain';

export type ChromaKeyEffectParameters = {
  keyColor: string;
  similarity: number;
  smoothness: number;
  spill: number;
};

export type ChromaKeyEffect = ElementEffectBase & {
  type: 'chroma-key';
  parameters: ChromaKeyEffectParameters;
};

export const createDefaultChromaKeyEffect = (id: string): ChromaKeyEffect => ({
  id,
  name: 'Chroma key',
  enabled: true,
  type: 'chroma-key',
  parameters: {
    keyColor: '#00ff00',
    similarity: 0.4,
    smoothness: 0.1,
    spill: 0.1,
  },
});
