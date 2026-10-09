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

export type ElementEffect = {
  id: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};
