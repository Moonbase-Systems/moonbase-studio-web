export const DEFAULT_RECORDING_NAME_PATTERN = '{name}-{date}-{time}';

const pad = (value: number): string => String(value).padStart(2, '0');

const NAME_TOKEN = /\{(name|date|time|year|month|day|hour|minute|second)\}/g;

/** File-name safe project title. Empty names become `recording`. */
export const sanitizeProjectName = (name: string): string => {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'recording';
};

/** `{name}` `{date}` `{time}` `{year}` `{month}` `{day}` `{hour}` `{minute}` `{second}`. */
export const recordingNameFromPattern = (pattern: string, projectName: string, at: Date, extension: string): string => {
  const year = String(at.getFullYear());
  const month = pad(at.getMonth() + 1);
  const day = pad(at.getDate());
  const hour = pad(at.getHours());
  const minute = pad(at.getMinutes());
  const second = pad(at.getSeconds());
  const tokens: Record<string, string> = {
    name: sanitizeProjectName(projectName),
    date: `${year}${month}${day}`,
    time: `${hour}${minute}${second}`,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
  const source = pattern.trim() || DEFAULT_RECORDING_NAME_PATTERN;
  const replaced = source.replace(NAME_TOKEN, (token, key: string) => tokens[key] ?? token);
  const base = sanitizeProjectName(replaced.replace(/\./g, '-'));
  return `${base}.${extension}`;
};

export const recordingFileName = (projectName: string, at: Date, extension: string): string =>
  recordingNameFromPattern(DEFAULT_RECORDING_NAME_PATTERN, projectName, at, extension);
