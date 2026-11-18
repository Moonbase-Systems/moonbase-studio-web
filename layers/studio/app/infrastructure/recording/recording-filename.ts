const pad = (value: number): string => String(value).padStart(2, '0');

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

export const recordingFileName = (projectName: string, at: Date, extension: string): string => {
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${sanitizeProjectName(projectName)}-${stamp}.${extension}`;
};
