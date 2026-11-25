import { describe, expect, it } from 'vitest';

import { createElapsedClock, formatRecordingClock } from './recording-clock';
import { createRecordingEngine, type RecorderLike } from './recording-engine';
import { recordingFileName, recordingNameFromPattern, sanitizeProjectName } from './recording-filename';
import { chooseRecordingMime } from './recording-mime';
import { createRecordingRecord, recordingRecordKeepsMedia } from './recording-record';
import { beginRecordingFile, filePickerMimeType } from './recording-writer';

describe('chooseRecordingMime', () => {
  it('prefers VP9, then VP8, then MP4', () => {
    expect(chooseRecordingMime(() => true)?.mimeType).toBe('video/webm;codecs=vp9,opus');
    expect(chooseRecordingMime((mime) => mime.includes('vp8'))?.extension).toBe('webm');
    expect(chooseRecordingMime((mime) => mime.startsWith('video/mp4'))?.extension).toBe('mp4');
    expect(chooseRecordingMime(() => false)).toBeNull();
  });

  it('stays inside the container the operator picked', () => {
    expect(chooseRecordingMime(() => true, 'mp4')?.extension).toBe('mp4');
    expect(chooseRecordingMime((mime) => mime.includes('vp9'), 'mp4')).toBeNull();
    expect(chooseRecordingMime((mime) => mime.includes('vp8'), 'webm')?.mimeType).toContain('vp8');
  });
});

describe('recording clock', () => {
  it('freezes elapsed time while paused', () => {
    let now = 1000;
    const clock = createElapsedClock(() => now);
    clock.start();
    now = 1500;
    clock.pause();
    now = 4000;
    expect(clock.elapsed()).toBe(500);
    clock.resume();
    now = 4500;
    expect(clock.elapsed()).toBe(1000);
    expect(formatRecordingClock(3661000)).toBe('01:01:01');
  });
});

describe('recordingFileName', () => {
  it('cleans the project name and keeps the mime extension', () => {
    expect(sanitizeProjectName('My/Show: live')).toBe('My-Show-live');
    expect(sanitizeProjectName('   ')).toBe('recording');
    const name = recordingFileName('My/Show', new Date(2026, 10, 18, 9, 5, 3), 'webm');
    expect(name).toBe('My-Show-20261118-090503.webm');
  });

  it('fills a custom pattern and still appends the container extension', () => {
    const at = new Date(2026, 10, 18, 9, 5, 3);
    expect(recordingNameFromPattern('{name}_{year}-{month}-{day}', 'My/Show', at, 'mp4')).toBe(
      'My-Show_2026-11-18.mp4',
    );
    expect(recordingNameFromPattern('   ', 'Show', at, 'webm')).toBe('Show-20261118-090503.webm');
  });
});

describe('createRecordingEngine', () => {
  const recorder = (): RecorderLike & { started: boolean } => {
    const value: RecorderLike & { started: boolean } = {
      mimeType: '',
      state: 'inactive',
      started: false,
      start() {
        value.started = true;
        value.state = 'recording';
      },
      stop() {
        value.state = 'inactive';
        value.onstop?.();
      },
      pause() {
        value.state = 'paused';
      },
      resume() {
        value.state = 'recording';
      },
      ondataavailable: null,
      onstop: null,
      onerror: null,
    };
    return value;
  };

  it('rejects a second start and waits for the last chunk on stop', async () => {
    let now = 0;
    const chunks: Blob[] = [];
    let created = 0;
    const engine = createRecordingEngine({
      now: () => now,
      isTypeSupported: (mime) => mime.includes('vp9'),
      onChunk: (chunk) => {
        chunks.push(chunk);
      },
      createRecorder: () => {
        created += 1;
        return recorder();
      },
    });

    const started = engine.start({}, { videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
    expect(started.ok).toBe(true);
    expect(engine.start({}, { videoBitsPerSecond: 1, audioBitsPerSecond: 1 })).toEqual({
      ok: false,
      reason: 'busy',
    });
    expect(created).toBe(1);
    now = 2000;
    engine.pause();
    now = 9000;
    expect(engine.elapsedMs()).toBe(2000);
    const stopped = engine.stop();
    await expect(stopped).resolves.toMatchObject({ ok: true, elapsedMs: 2000 });
    expect(engine.state).toBe('completed');
    expect(chunks).toEqual([]);
  });
});

describe('beginRecordingFile', () => {
  it('passes a container type to the file picker, without codecs', async () => {
    expect(filePickerMimeType('video/webm;codecs=vp9,opus')).toBe('video/webm');
    let accept: Record<string, string[]> | undefined;
    const session = await beginRecordingFile(
      {
        pick: async (options) => {
          accept = options.types[0]?.accept;
          return {
            createWritable: async () => ({
              write: async () => undefined,
              close: async () => undefined,
              abort: async () => undefined,
            }),
          };
        },
      },
      { fileName: 'show.webm', mimeType: 'video/webm;codecs=vp9,opus' },
    );
    expect(accept).toEqual({ 'video/webm': ['.webm'] });
    await session.abort();
  });

  it('treats a cancelled picker as not saved', async () => {
    const session = await beginRecordingFile(
      {
        pick: () => {
          throw new DOMException('The user aborted a request.', 'AbortError');
        },
      },
      { fileName: 'show.webm', mimeType: 'video/webm' },
    );
    expect(session.cancelled).toBe(true);
    await expect(session.close()).resolves.toEqual({ sizeBytes: 0 });
  });

  it('downloads a blob when the browser has no file picker', async () => {
    const downloaded: string[] = [];
    const session = await beginRecordingFile(
      {
        download: (_blob, fileName) => {
          downloaded.push(fileName);
        },
      },
      { fileName: 'show.webm', mimeType: 'video/webm' },
    );
    await session.write(new Blob(['abc']));
    const closed = await session.close();
    expect(closed.sizeBytes).toBe(3);
    expect(downloaded).toEqual(['show.webm']);
    expect(session.handle).toBeNull();
  });
});

describe('recording records', () => {
  it('keeps bytes out of the library row', () => {
    const record = createRecordingRecord({
      id: 'rec-1',
      projectId: 'project-1',
      fileName: 'show.webm',
      mimeType: 'video/webm',
      sizeBytes: 10,
      durationMs: 1000,
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      createdAt: '2026-11-18T00:00:00.000Z',
    });
    expect(recordingRecordKeepsMedia(record)).toBe(false);
    expect(record.frameRate).toBe(29.97);
    expect(record).not.toHaveProperty('blob');
  });
});
