import { describe, expect, it, vi } from 'vitest';

import { applyMonitorSink } from './monitor-sink';

describe('monitor sink', () => {
  it('changes the context sink and leaves the program destination alone', async () => {
    const setSinkId = vi.fn(async () => undefined);
    const program = { stream: { id: 'program' } };
    const result = await applyMonitorSink({ setSinkId }, 'speakers');
    expect(result).toEqual({ ok: true, sinkId: 'speakers' });
    expect(setSinkId).toHaveBeenCalledWith('speakers');
    expect(program.stream.id).toBe('program');
  });

  it('stays on the default output when the browser has no setSinkId', async () => {
    const program = { sinkId: '' };
    const result = await applyMonitorSink({}, 'speakers');
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
    expect(program.sinkId).toBe('');
  });
});
