import type { TextElementSettings } from '../models/scene-elements/text-element.domain';

const estimateContentWidth = (settings: TextElementSettings, lines: readonly string[]): number => {
  let width = 0;
  for (const line of lines) {
    const spacing = Math.max(line.length - 1, 0) * settings.letterSpacing;
    width = Math.max(width, line.length * settings.fontSize * 0.5 + spacing);
  }
  return width;
};

const measureContentWidth = (settings: TextElementSettings, lines: readonly string[]): number => {
  if (typeof document === 'undefined') {
    return estimateContentWidth(settings, lines);
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return estimateContentWidth(settings, lines);
  }

  const family = settings.fontFamily.includes(' ') ? `"${settings.fontFamily}"` : settings.fontFamily;
  context.font = `${settings.fontStyle} ${settings.fontWeight} ${settings.fontSize}px ${family}`;

  let width = 0;
  for (const line of lines) {
    const spacing = Math.max(line.length - 1, 0) * settings.letterSpacing;
    width = Math.max(width, context.measureText(line).width + spacing);
  }
  return width;
};

/** Frame that hugs the text, including padding and stroke. Empty text still occupies one line. */
export const measureDynamicTextFrame = (settings: TextElementSettings): { width: number; height: number } => {
  const lines = settings.text.split('\n');
  const measuredLines = lines.length > 0 ? lines : [''];
  const stroke = settings.strokeWidth > 0 ? settings.strokeWidth * 2 : 0;
  const width = Math.ceil(measureContentWidth(settings, measuredLines) + settings.padding * 2 + stroke);
  const height = Math.ceil(
    Math.max(measuredLines.length, 1) * settings.fontSize * settings.lineHeight + settings.padding * 2 + stroke,
  );

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
};
