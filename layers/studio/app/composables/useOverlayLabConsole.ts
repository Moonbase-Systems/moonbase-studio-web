import type { InjectionKey, Ref } from 'vue';
import { computed, inject, onMounted, onScopeDispose, provide, reactive, ref, watch } from 'vue';

import { alertText, createOverlayAlert, type OverlayAlert } from '../application/overlay-alerts';
import type {
  OverlayAudioLogEntry,
  OverlayAudioStatus,
  OverlayEventMessage,
  OverlayEventPort,
  StudioLabRequest,
} from '../application/overlay-event-port';
import { evaluateOverlayLabTest, type LabVerdict, type OverlayLabTestId } from '../application/overlay-lab-tests';
import type { OverlayAlertType } from '../models/overlay-sound.domain';
import { getOverlayEventPort } from './useOverlayEventPort';

export type OverlayLabDrafts = {
  follow: { username: string; displayName: string; avatarUrl: string };
  subscription: { username: string; plan: string; months: number; message: string };
  donation: { username: string; amount: number; currency: string; message: string };
  raid: { username: string; viewerCount: number };
  cheer: { username: string; amount: number; message: string };
  chat: { username: string; message: string };
  custom: { title: string; message: string };
};

export type OverlayLabEventRow = {
  id: string;
  at: number;
  code: 'sent' | 'invalid' | 'renderer' | 'clear';
  detail: string;
};

const EVENT_TESTS = new Set<OverlayLabTestId>([
  'play',
  'multiple',
  'rapid',
  'loop',
  'stop-all',
  'cooldown',
  'max-instances',
  'restart',
  'overlay-mute',
  'effects',
]);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function useOverlayLabConsole() {
  let port: OverlayEventPort | null = null;
  const portAvailable = ref(false);
  const requirePort = (): OverlayEventPort => {
    port ??= getOverlayEventPort();
    return port;
  };
  const overlayId = ref('lab');
  const selected = ref<OverlayAlertType>('follow');
  const burstCount = ref(8);
  const issues = ref<string[]>([]);
  const eventLog = ref<OverlayLabEventRow[]>([]);
  const audioLog = ref<OverlayAudioLogEntry[]>([]);
  const status = ref<OverlayAudioStatus | null>(null);
  const renderer = ref<Extract<OverlayEventMessage, { kind: 'renderer' }> | null>(null);
  const lastStudio = ref(0);
  const lastRenderer = ref(0);
  const clock = ref(Date.now());
  const running = ref<OverlayLabTestId | null>(null);
  const lastVerdict = ref<{ id: OverlayLabTestId; verdict: LabVerdict } | null>(null);
  const results = reactive<Partial<Record<OverlayLabTestId, LabVerdict>>>({});
  const drafts = reactive<OverlayLabDrafts>({
    follow: { username: 'moonbase', displayName: 'MoonBase', avatarUrl: '' },
    subscription: { username: 'moonbase', plan: 'Tier 1', months: 3, message: '' },
    donation: { username: 'moonbase', amount: 20, currency: 'PLN', message: 'Dzięki' },
    raid: { username: 'moonbase', viewerCount: 42 },
    cheer: { username: 'moonbase', amount: 100, message: '' },
    chat: { username: 'moonbase', message: 'Cześć' },
    custom: { title: 'Test', message: 'Zdarzenie własne' },
  });
  const soundDraft = reactive({ url: '', volumeDb: 0 });
  let rowId = 0;
  let lastAlert: OverlayAlert | null = null;
  let seenRenderer = '';

  const pushEvent = (code: OverlayLabEventRow['code'], detail: string) => {
    rowId += 1;
    eventLog.value = [{ id: `lab-event-${rowId}`, at: Date.now(), code, detail }, ...eventLog.value].slice(0, 40);
  };

  const alertSound = (): { url: string; volumeDb: number } | undefined => {
    const url = soundDraft.url.trim();
    if (!url) {
      return undefined;
    }
    const volume = Number(soundDraft.volumeDb);
    return { url, volumeDb: Number.isFinite(volume) ? volume : 0 };
  };

  const sendAlert = (
    type: OverlayAlertType,
    payload: unknown,
    sound?: { url: string; volumeDb?: number } | null,
  ): OverlayAlert | null => {
    const created = createOverlayAlert({
      type,
      overlayId: overlayId.value.trim(),
      payload,
      sound: sound === undefined ? alertSound() : (sound ?? undefined),
    });
    if (!created.ok) {
      issues.value = created.issues;
      pushEvent('invalid', created.issues[0] ?? type);
      return null;
    }
    issues.value = [];
    requirePort().publish({ kind: 'alert', alert: created.alert });
    lastAlert = created.alert;
    pushEvent('sent', `${created.alert.type} ${alertText(created.alert).name}`);
    return created.alert;
  };

  const send = (): boolean => sendAlert(selected.value, drafts[selected.value]) !== null;

  const sendMany = (count: number): number => {
    let sent = 0;
    for (let index = 0; index < count; index += 1) {
      if (!send()) {
        break;
      }
      sent += 1;
    }
    return sent;
  };

  const resend = () => {
    if (!lastAlert) {
      return;
    }
    sendAlert(lastAlert.type, lastAlert.payload, lastAlert.sound ?? null);
  };

  const burst = () => {
    const count = Math.min(20, Math.max(2, Math.round(burstCount.value) || 2));
    burstCount.value = count;
    sendMany(count);
  };

  const clearQueue = () => {
    const id = overlayId.value.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      issues.value = ['overlayId: invalid'];
      return;
    }
    requirePort().publish({ kind: 'clear-queue', overlayId: id, at: Date.now() });
    pushEvent('clear', id);
  };

  const request = (body: StudioLabRequest) => {
    requirePort().publish({ kind: 'studio-request', request: body, at: Date.now() });
  };

  let stopMessages = () => {};
  let clockTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    const current = requirePort();
    portAvailable.value = current.available;
    stopMessages = current.subscribe((message) => {
      if (message.kind === 'presence' && message.role === 'studio') {
        lastStudio.value = message.at;
      }
      if (message.kind === 'presence' && message.role === 'renderer' && message.overlayId === overlayId.value.trim()) {
        lastRenderer.value = message.at;
      }
      if (message.kind === 'audio') {
        status.value = message.status;
        lastStudio.value = message.at;
      }
      if (message.kind === 'audio-log') {
        audioLog.value = [message.entry, ...audioLog.value].slice(0, 40);
        lastStudio.value = message.entry.at;
      }
      if (message.kind === 'renderer' && message.overlayId === overlayId.value.trim()) {
        renderer.value = message;
        lastRenderer.value = message.at;
        const key = `${message.phase}:${message.alert?.id ?? ''}:${message.queued}`;
        if (key !== seenRenderer) {
          seenRenderer = key;
          pushEvent('renderer', message.alert ? alertText(message.alert).name : message.phase);
        }
      }
    });

    clockTimer = setInterval(() => {
      clock.value = Date.now();
    }, 500);
  });

  watch(overlayId, () => {
    lastRenderer.value = 0;
    renderer.value = null;
    seenRenderer = '';
  });

  onScopeDispose(() => {
    if (clockTimer) {
      clearInterval(clockTimer);
    }
    stopMessages();
  });

  const studioConnected = computed(() => clock.value - lastStudio.value < 3000);
  const rendererConnected = computed(() => clock.value - lastRenderer.value < 3000);
  const overlayHref = computed(() => `/overlay/${encodeURIComponent(overlayId.value.trim() || 'lab')}`);

  const slice = (since: number) => audioLog.value.filter((entry) => entry.at >= since - 30);

  const restore = (id: OverlayLabTestId, before: OverlayAudioStatus | null) => {
    if (!before) {
      return;
    }
    if (id === 'overlay-mute') {
      request({ name: 'stop-all' });
      request({ name: 'overlay-mute', muted: before.busMuted });
    }
    if (id === 'master-mute') {
      request({ name: 'master-mute', muted: before.masterMuted });
    }
    if (id === 'master-volume') {
      request({ name: 'master-volume', volume: before.masterVolume });
    }
    if (id === 'program' || id === 'monitoring') {
      request({ name: 'overlay-monitoring', monitoring: before.monitoring });
      request({ name: 'overlay-mute', muted: before.busMuted });
      request({ name: 'master-mute', muted: before.masterMuted });
    }
  };

  const runTest = async (id: OverlayLabTestId) => {
    if (running.value) {
      return;
    }
    running.value = id;
    const since = Date.now();
    const before = status.value ? { ...status.value } : null;
    let sent = 0;
    try {
      if (id === 'multiple') {
        sent = sendMany(3);
      } else if (id === 'rapid' || id === 'max-instances') {
        sent = sendMany(8);
      } else if (id === 'cooldown' || id === 'restart') {
        sent = sendMany(2);
      } else if (id === 'overlay-mute') {
        request({ name: 'overlay-mute', muted: true });
        await wait(200);
        sent = send() ? 1 : 0;
      } else if (id === 'master-mute') {
        request({ name: 'master-mute', muted: true });
      } else if (id === 'master-volume') {
        request({ name: 'master-volume', volume: 0.2 });
      } else if (id === 'program') {
        request({ name: 'overlay-mute', muted: false });
        request({ name: 'master-mute', muted: false });
        request({ name: 'overlay-monitoring', monitoring: 'monitor-and-output' });
      } else if (id === 'monitoring') {
        request({ name: 'overlay-monitoring', monitoring: 'monitor' });
      } else if (id === 'stop-all') {
        sent = send() ? 1 : 0;
        await wait(400);
        request({ name: 'stop-all' });
      } else {
        sent = send() ? 1 : 0;
      }
      if (EVENT_TESTS.has(id) && sent === 0) {
        const verdict = { state: 'fail' as const, code: issues.value.length > 0 ? 'invalid-payload' : 'no-trace' };
        results[id] = verdict;
        lastVerdict.value = { id, verdict };
        return;
      }
      const timeout = id === 'rapid' || id === 'max-instances' ? 3000 : 1800;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const log = slice(since);
        const heard = log.some((entry) =>
          ['playback-started', 'playback-queued', 'playback-ignored', 'playback-error', 'trigger-miss'].includes(
            entry.code,
          ),
        );
        const flags =
          (id === 'master-mute' && status.value?.masterMuted) ||
          (id === 'master-volume' && status.value !== null && Math.abs(status.value.masterVolume - 0.2) < 0.02) ||
          (id === 'program' &&
            status.value?.monitoring === 'monitor-and-output' &&
            status.value.program &&
            status.value.monitor) ||
          (id === 'monitoring' && status.value?.monitoring === 'monitor') ||
          (id === 'stop-all' && heard && status.value?.activeInstances === 0);
        if (
          flags ||
          (EVENT_TESTS.has(id) &&
            id !== 'stop-all' &&
            heard &&
            log.filter((entry) => entry.code === 'event-received').length >= sent)
        ) {
          break;
        }
        await wait(40);
      }
      if (id === 'overlay-mute') {
        await wait(350);
      }
      const verdict = evaluateOverlayLabTest(id, {
        studioConnected: studioConnected.value,
        sent,
        log: slice(since),
        status: status.value,
      });
      results[id] = verdict;
      lastVerdict.value = { id, verdict };
    } finally {
      restore(id, before);
      running.value = null;
    }
  };

  const api = {
    portAvailable,
    overlayId,
    overlayHref,
    selected,
    drafts,
    soundDraft,
    issues,
    burstCount,
    eventLog,
    audioLog,
    status,
    renderer,
    studioConnected,
    rendererConnected,
    running,
    lastVerdict,
    results,
    send,
    resend,
    burst,
    clearQueue,
    runTest,
  };
  provide(OverlayLabConsoleKey, api);
  return api;
}

export type OverlayLabConsole = {
  drafts: OverlayLabDrafts;
  soundDraft: { url: string; volumeDb: number };
  selected: Ref<OverlayAlertType>;
  issues: Ref<string[]>;
};

const OverlayLabConsoleKey: InjectionKey<OverlayLabConsole> = Symbol('overlay-lab');

export function useOverlayLabFields(): OverlayLabConsole {
  const console = inject(OverlayLabConsoleKey, null);
  if (!console) {
    throw new Error('Overlay Lab is not mounted');
  }
  return console;
}
