export interface Point2D {
  x: number;
  y: number;
}

export const distanceBetweenPoints = (a: Point2D, b: Point2D): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
};

export const lerpValue = (current: number, target: number, alpha: number): number =>
  alpha * target + (1 - alpha) * current;

export const emaSmoothPoint = (
  previous: Point2D,
  current: Point2D,
  alpha: number,
): Point2D => ({
  x: lerpValue(previous.x, current.x, alpha),
  y: lerpValue(previous.y, current.y, alpha),
});

export const clampPointToBounds = (
  point: Point2D,
  width: number,
  height: number,
  padding = 0,
): Point2D => ({
  x: Math.max(padding, Math.min(width - padding, point.x)),
  y: Math.max(padding, Math.min(height - padding, point.y)),
});

export const computeMeanCornerDrift = (
  first: readonly [Point2D, Point2D, Point2D, Point2D],
  second: readonly [Point2D, Point2D, Point2D, Point2D],
): number => {
  const d0 = distanceBetweenPoints(first[0], second[0]);
  const d1 = distanceBetweenPoints(first[1], second[1]);
  const d2 = distanceBetweenPoints(first[2], second[2]);
  const d3 = distanceBetweenPoints(first[3], second[3]);
  return (d0 + d1 + d2 + d3) / 4;
};
