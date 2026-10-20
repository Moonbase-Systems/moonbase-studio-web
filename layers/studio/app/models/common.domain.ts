export type Transform2D = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

export type Appearance = {
  opacity: number;
  blendMode?: string;
};

type ElementEffectBase = {
  id: string;
  enabled: boolean;
};

export type CropEffectParameters = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ChromaKeyEffectParameters = {
  keyColor: string;
  similarity: number;
  smoothness: number;
  spill: number;
};

export type ColorCorrectionEffectParameters = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
};

export type BlurEffectParameters = {
  radius: number;
};

export type CropEffect = ElementEffectBase & {
  type: 'crop';
  parameters: CropEffectParameters;
};

export type ChromaKeyEffect = ElementEffectBase & {
  type: 'chroma-key';
  parameters: ChromaKeyEffectParameters;
};

export type ColorCorrectionEffect = ElementEffectBase & {
  type: 'color-correction';
  parameters: ColorCorrectionEffectParameters;
};

export type BlurEffect = ElementEffectBase & {
  type: 'blur';
  parameters: BlurEffectParameters;
};

export type ElementEffect = CropEffect | ChromaKeyEffect | ColorCorrectionEffect | BlurEffect;

export type ElementEffectType = ElementEffect['type'];
