import { onMounted, onScopeDispose, watch } from 'vue';

import { routeOverlayBus } from '../application/audio-routing';
import { cueForAlert } from '../application/overlay-alerts';
import { subscribeOverlayCueTrace, subscribeOverlayPlaybackNotice } from '../application/overlay-cue-trace';
import { dispatchOverlayCue } from '../application/overlay-cues';
import type { OverlayAudioLogEntry, OverlayAudioStatus, StudioLabRequest } from '../application/overlay-event-port';
import { audioEntriesFromStatus, audioEntriesFromTrace, audioEntryFromNotice } from '../application/overlay-lab-log';
import { channelAudibleInScene } from '../models/audio.domain';
import { useStudioSessionStore } from '../store/studio-session.store';
import { getOverlayEventPort } from './useOverlayEventPort';
import type { StudioAudioEngineHandle } from './useStudioAudioEngine';
import type { StudioOverlayPlayback } from './useStudioOverlayPlayback';

/**
 * Studio is the only page that turns an alert into a cue. Triggers play through the cue
 * subscription. A sound carried by the alert is a separate one-shot on the same bus.
 */
export function useStudioOverlayEventBridge(engine: StudioAudioEngineHandle, playback: StudioOverlayPlayback): void {
  const store = useStudioSessionStore();
  let port: ReturnType<typeof getOverlayEventPort> | null = null;
  let lastSoundName: string | null = null;
  let lastOutcome: string | null = null;
  let previous: OverlayAudioStatus | null = null;
  let lastPublish = 0;
  let logId = 0;
  let queued: ReturnType<typeof setTimeout> | null = null;

  const publishEntries = (entries: Omit<OverlayAudioLogEntry, 'id'>[]) => {
    if (!port) {
      return;
    }
    for (const entry of entries) {
      logId += 1;
      port.publish({ kind: 'audio-log', entry: { ...entry, id: `studio-log-${logId}` } });
    }
  };

  const buildStatus = (): OverlayAudioStatus | null => {
    const project = store.project;
    if (!project) {
      return null;
    }
    const overlay = project.audioMixer.overlay;
    const scene = project.scenes.find((item) => item.id === store.activeSceneId);
    const enabled = new Set<string>();
    for (const element of scene?.elements ?? []) {
      if (element.type === 'audioVisual' && element.visibility) {
        enabled.add(element.channelId);
      }
    }
    const route = routeOverlayBus({
      monitoring: overlay.monitoring,
      solo: overlay.solo,
      anyChannelSolo: project.audioMixer.channels.some(
        (channel) => channel.solo && channelAudibleInScene(channel, enabled),
      ),
    });
    return {
      engineReady: true,
      busMuted: overlay.muted,
      busSolo: overlay.solo,
      monitoring: overlay.monitoring,
      program: route.program,
      monitor: route.monitor,
      faderDb: overlay.faderDb,
      rmsDb: engine.levels.overlay.rmsDb,
      peakDb: engine.levels.overlay.peakDb,
      activeInstances: playback.instances.value.length,
      queued: playback.queuedCount.value,
      lastSoundName,
      lastOutcome,
      masterMuted: project.audioMixer.master.muted,
      masterVolume: project.audioMixer.master.volume,
      masterRmsDb: engine.levels.master.rmsDb,
      effectCount: overlay.effects.filter((effect) => effect.enabled).length,
      chainError: engine.levels.chainError,
    };
  };

  const publishStatus = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPublish < 100) {
      if (!queued) {
        queued = setTimeout(() => {
          queued = null;
          publishStatus();
        }, 100);
      }
      return;
    }
    lastPublish = now;
    const status = buildStatus();
    if (!status) {
      return;
    }
    publishEntries(audioEntriesFromStatus(previous, status));
    previous = status;
    port?.publish({ kind: 'audio', status, at: now });
  };

  const applyRequest = (request: StudioLabRequest) => {
    if (request.name === 'overlay-mute') {
      store.updateOverlayBus({ muted: request.muted });
    } else if (request.name === 'overlay-monitoring') {
      store.updateOverlayBus({ monitoring: request.monitoring });
    } else if (request.name === 'master-mute') {
      store.updateAudioMaster({ muted: request.muted });
    } else if (request.name === 'master-volume') {
      store.updateAudioMaster({ volume: request.volume });
    } else {
      void playback.stopAll();
    }
    publishStatus(true);
  };

  let stopPort = () => {};
  let stopTrace = () => {};
  let stopNotice = () => {};
  let beat: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    port = getOverlayEventPort();
    stopPort = port.subscribe((message) => {
      if (message.kind === 'alert') {
        dispatchOverlayCue(cueForAlert(message.alert, store.activeSceneId));
        const sound = message.alert.sound;
        if (sound) {
          void playback.playUrl(sound.url, sound.volumeDb, store.activeSceneId);
        }
        return;
      }
      if (message.kind === 'studio-request') {
        applyRequest(message.request);
      }
    });

    stopTrace = subscribeOverlayCueTrace((trace) => {
      const last = trace.outcomes[trace.outcomes.length - 1];
      if (last) {
        lastSoundName = last.name;
        lastOutcome = last.outcome;
      }
      publishEntries(audioEntriesFromTrace(trace));
      publishStatus(true);
    });

    stopNotice = subscribeOverlayPlaybackNotice((notice) => {
      publishEntries([audioEntryFromNotice(notice)]);
    });

    beat = setInterval(() => {
      port?.publish({ kind: 'presence', role: 'studio', overlayId: 'studio', at: Date.now() });
      publishStatus();
    }, 1000);

    watch(
      () => [
        engine.levels.overlay.rmsDb,
        engine.levels.overlay.peakDb,
        engine.levels.master.rmsDb,
        engine.levels.chainError,
        playback.instances.value.length,
        playback.queuedCount.value,
        store.project?.audioMixer.overlay.muted,
        store.project?.audioMixer.overlay.monitoring,
        store.project?.audioMixer.master.muted,
        store.project?.audioMixer.master.volume,
      ],
      () => publishStatus(),
    );

    publishStatus(true);
  });

  onScopeDispose(() => {
    if (beat) {
      clearInterval(beat);
    }
    if (queued) {
      clearTimeout(queued);
    }
    stopPort();
    stopTrace();
    stopNotice();
  });
}
