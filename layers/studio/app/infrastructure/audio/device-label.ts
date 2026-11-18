const NAME_LIMIT = 64;

const clip = (value: string, limit: number): string => {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return trimmed.slice(0, limit).trim();
};

/** First useful token inside the browser's parenthetical vendor suffix. */
const hintFrom = (label: string): string => {
  const inner = label.match(/\(([^)]*)\)/)?.[1] ?? '';
  const tokens = inner
    .replace(/[®™()]/g, ' ')
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && /[A-Za-zÀ-ÿ]/.test(token));
  return tokens[0]?.slice(0, 24) ?? '';
};

/**
 * A readable channel name. The part before the parenthesis is the name when it
 * says something. A second device that would collapse to the same word keeps a short vendor hint.
 */
export const shortDeviceName = (label: string, taken: ReadonlySet<string>): string => {
  const trimmed = label.trim().replace(/\s+/g, ' ');
  const head = trimmed.split('(')[0]?.trim() ?? '';
  const sensible = head.length >= 2 ? head : trimmed;
  const base = clip(sensible, NAME_LIMIT);
  if (base.length > 0 && !taken.has(base)) {
    return base;
  }
  const hint = hintFrom(trimmed);
  if (hint.length > 0) {
    const suffix = ` · ${hint}`;
    const room = Math.max(1, NAME_LIMIT - suffix.length);
    const withHint = `${clip(base || hint, room)}${suffix}`;
    if (!taken.has(withHint)) {
      return withHint;
    }
  }
  const stem = base || clip(trimmed, NAME_LIMIT);
  if (stem.length > 0 && !taken.has(stem)) {
    return stem;
  }
  const numbered = stem.length > 0 ? stem : 'Audio';
  let index = 2;
  let candidate = clip(`${numbered} ${index}`, NAME_LIMIT);
  while (taken.has(candidate) && index < 100) {
    index += 1;
    candidate = clip(`${numbered} ${index}`, NAME_LIMIT);
  }
  return candidate;
};
