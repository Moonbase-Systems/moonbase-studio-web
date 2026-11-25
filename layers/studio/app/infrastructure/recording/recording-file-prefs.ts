import type { VideoBitratePreset } from './recording-bitrate';
import { DEFAULT_RECORDING_NAME_PATTERN } from './recording-filename';
import type { RecordingContainer } from './recording-mime';

export type RecordingFilePrefs = {
  quality: VideoBitratePreset;
  container: RecordingContainer;
  namePattern: string;
};

export const DEFAULT_RECORDING_FILE_PREFS: RecordingFilePrefs = {
  quality: 'standard',
  container: 'auto',
  namePattern: DEFAULT_RECORDING_NAME_PATTERN,
};

const QUALITIES = new Set<VideoBitratePreset>(['low', 'standard', 'high', 'veryHigh']);
const CONTAINERS = new Set<RecordingContainer>(['auto', 'webm', 'mp4']);

export const parseRecordingFilePrefs = (raw: string | null): RecordingFilePrefs => {
  if (!raw) {
    return { ...DEFAULT_RECORDING_FILE_PREFS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RecordingFilePrefs>;
    const quality = QUALITIES.has(parsed.quality as VideoBitratePreset)
      ? (parsed.quality as VideoBitratePreset)
      : DEFAULT_RECORDING_FILE_PREFS.quality;
    const container = CONTAINERS.has(parsed.container as RecordingContainer)
      ? (parsed.container as RecordingContainer)
      : DEFAULT_RECORDING_FILE_PREFS.container;
    const namePattern =
      typeof parsed.namePattern === 'string' && parsed.namePattern.trim().length > 0
        ? parsed.namePattern
        : DEFAULT_RECORDING_FILE_PREFS.namePattern;
    return { quality, container, namePattern };
  } catch {
    return { ...DEFAULT_RECORDING_FILE_PREFS };
  }
};
