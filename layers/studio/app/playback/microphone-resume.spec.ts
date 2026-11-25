import { describe, expect, it } from 'vitest';

import { BROWSER_TAB_AUDIO_DEVICE_ID } from '../models/source.domain';
import { createValidProject } from '../test-utils/project-fixtures';
import { microphoneSourcesToResume } from './microphone-resume';

describe('microphoneSourcesToResume', () => {
  it('reopens saved microphones and skips system and tab audio', () => {
    const project = createValidProject();
    project.sources = [
      { id: 'mic', name: 'Mic', type: 'audio', deviceId: 'dev-1' },
      { id: 'sys', name: 'System', type: 'audio', deviceId: 'system' },
      { id: 'tab', name: 'Tab', type: 'audio', deviceId: BROWSER_TAB_AUDIO_DEVICE_ID },
      { id: 'file', name: 'File', type: 'audio', assetId: 'asset-1' },
    ];

    expect(microphoneSourcesToResume(project)).toEqual([{ sourceId: 'mic', deviceId: 'dev-1' }]);
  });
});
