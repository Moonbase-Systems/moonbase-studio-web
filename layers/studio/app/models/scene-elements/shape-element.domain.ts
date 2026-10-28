import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type ShapeType = 'rectangle' | 'ellipse' | 'line';

export type ShapeGradientStop = {
  offset: number;
  color: string;
};

export type ShapeGradient = {
  type: 'linear' | 'radial';
  angle: number;
  stops: ShapeGradientStop[];
};

export type ShapeElementSettings = {
  shapeType: ShapeType;
  fillColor: string | null;
  fillOpacity: number;
  strokeColor: string | null;
  strokeWidth: number;
  cornerRadius: number;
  gradient: ShapeGradient | null;
};

export type ShapeElement = SceneElementBase & {
  type: 'shape';
  sourceId: SourceId;
  settings: ShapeElementSettings;
};

export const createDefaultShapeElementSettings = (shapeType: ShapeType = 'rectangle'): ShapeElementSettings => ({
  shapeType,
  fillColor: '#3b82f6',
  fillOpacity: 1,
  strokeColor: null,
  strokeWidth: 0,
  cornerRadius: 0,
  gradient: null,
});

export const shapeKindToShapeType = (shapeKind: string): ShapeType => {
  if (shapeKind === 'ellipse' || shapeKind === 'line') {
    return shapeKind;
  }
  return 'rectangle';
};
