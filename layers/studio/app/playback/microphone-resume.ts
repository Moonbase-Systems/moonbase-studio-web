import type { Project } from '../models/project.domain';
import { BROWSER_TAB_AUDIO_DEVICE_ID } from '../models/source.domain';

const SKIPPED_DEVICE_IDS = new Set(['system', BROWSER_TAB_AUDIO_DEVICE_ID]);

export type MicrophoneResume = {
  sourceId: string;
  deviceId: string;
};

/** Microphones can reopen from a saved device id. System and tab audio need a fresh display capture. */
export function microphoneSourcesToResume(project: Project): MicrophoneResume[] {
  const items: MicrophoneResume[] = [];
  for (const source of project.sources) {
    if (source.type !== 'audio' || !source.deviceId || SKIPPED_DEVICE_IDS.has(source.deviceId)) {
      continue;
    }
    items.push({ sourceId: source.id, deviceId: source.deviceId });
  }
  return items;
}
