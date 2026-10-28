import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type TextFontStyle = 'normal' | 'italic';
export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type TextOverflow = 'clip' | 'ellipsis' | 'visible';

export type TextShadowSettings = {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
};

export type TextElementSettings = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle: TextFontStyle;
  color: string;
  textAlign: TextAlign;
  verticalAlign: TextVerticalAlign;
  lineHeight: number;
  letterSpacing: number;
  wrap: boolean;
  overflow: TextOverflow;
  maxLines: number | null;
  backgroundColor: string | null;
  backgroundOpacity: number;
  padding: number;
  strokeColor: string | null;
  strokeWidth: number;
  shadow: TextShadowSettings | null;
};

export type TextElement = SceneElementBase & {
  type: 'text';
  sourceId: SourceId;
  settings: TextElementSettings;
};

export const createDefaultTextElementSettings = (initialText = ''): TextElementSettings => ({
  text: initialText,
  fontFamily: 'Roboto',
  fontSize: 48,
  fontWeight: 400,
  fontStyle: 'normal',
  color: '#ffffff',
  textAlign: 'left',
  verticalAlign: 'top',
  lineHeight: 1.2,
  letterSpacing: 0,
  wrap: true,
  overflow: 'clip',
  maxLines: null,
  backgroundColor: null,
  backgroundOpacity: 0,
  padding: 8,
  strokeColor: null,
  strokeWidth: 0,
  shadow: null,
});
