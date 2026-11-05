export type BootBeamPoint = { x: number; y: number };

export function computeBeamTrapezoid(
  origin: BootBeamPoint,
  target: BootBeamPoint,
  sourceHalfWidth: number,
  targetHalfWidth: number,
): BootBeamPoint[] {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return [];
  }

  const nx = dx / length;
  const ny = dy / length;
  const px = -ny;
  const py = nx;

  return [
    { x: origin.x + px * sourceHalfWidth, y: origin.y + py * sourceHalfWidth },
    { x: origin.x - px * sourceHalfWidth, y: origin.y - py * sourceHalfWidth },
    { x: target.x - px * targetHalfWidth, y: target.y - py * targetHalfWidth },
    { x: target.x + px * targetHalfWidth, y: target.y + py * targetHalfWidth },
  ];
}

export function bootBeamPointsToAttr(points: BootBeamPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export function centerOfRect(rect: DOMRect): BootBeamPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function toStagePoint(point: BootBeamPoint, stageRect: DOMRect): BootBeamPoint {
  return {
    x: point.x - stageRect.left,
    y: point.y - stageRect.top,
  };
}
