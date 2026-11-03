import { onScopeDispose, watch } from 'vue';

import type { SceneId } from '../models/ids.domain';
import type { AnimationElement } from '../models/scene-elements';
import type { AnimationSource } from '../models/source.domain';
import {
  holdAnimationControls,
  peekAnimationPlayer,
  releaseAnimationControls,
} from '../playback/animation-player-registry';
import { useStudioSessionStore } from '../store/studio-session.store';

const sceneStartTriggers = new Set(['on-activate', 'on-scene-start']);

export function useAnimationPlayback(
  sceneId: SceneId,
  element: () => AnimationElement,
  source: () => AnimationSource | null,
) {
  const store = useStudioSessionStore();
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let stopEnded: (() => void) | undefined;
  let plays = 0;

  function player() {
    return peekAnimationPlayer(element().id);
  }

  function clearTimers() {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = undefined;
    }
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = undefined;
    }
  }

  function shouldRepeat(current: AnimationSource) {
    if (!current.repeatCount && current.playbackMode === 'loop') {
      return true;
    }
    return plays < (current.repeatCount ?? 1);
  }

  function finish() {
    const current = source();
    const active = player();
    if (!current || !active) {
      return;
    }
    plays += 1;
    if (active.capabilities.loopCount && shouldRepeat(current)) {
      active.restart();
      return;
    }
    if (current.endBehavior === 'reset') {
      active.seek(0);
      active.pause();
      return;
    }
    if (current.endBehavior === 'stop') {
      active.stop();
      return;
    }
    if (current.endBehavior === 'hide') {
      store.updateLayer(sceneId, element().id, { visibility: false });
    }
  }

  function bindEnded() {
    stopEnded?.();
    const active = player();
    if (!active) {
      return;
    }
    stopEnded = active.onEnded(finish);
  }

  function begin() {
    const current = source();
    const active = player();
    if (!current || !active || active.getState() === 'playing') {
      return;
    }
    if (active.capabilities.seek) {
      active.seek(current.startPositionMs);
    }
    if (active.capabilities.rate) {
      active.setRate(current.playbackRate);
    }
    active.setVolume(0);
    if (active.kind === 'image') {
      active.restart();
      return;
    }
    active.play();
  }

  function beginAfterDelay() {
    const current = source();
    if (!current) {
      return;
    }
    if (delayTimer) {
      clearTimeout(delayTimer);
    }
    const wait = current.startOffsetMs;
    if (wait > 0 && current.trigger !== 'manual' && current.trigger !== 'on-click') {
      delayTimer = setTimeout(begin, wait);
      return;
    }
    begin();
  }

  function armAutomatic() {
    clearTimers();
    plays = 0;
    const current = source();
    if (!current) {
      return;
    }
    if (
      sceneStartTriggers.has(current.trigger) ||
      current.trigger === 'on-appear' ||
      current.trigger === 'after-delay'
    ) {
      if (current.trigger === 'on-appear' && !element().visibility) {
        return;
      }
      beginAfterDelay();
    }
    if (current.trigger === 'interval' && current.intervalMs && current.intervalMs > 0) {
      intervalTimer = setInterval(beginAfterDelay, current.intervalMs);
    }
  }

  watch(
    () => source()?.playbackRate,
    (rate) => {
      const active = player();
      if (active?.capabilities.rate && rate) {
        active.setRate(rate);
      }
    },
  );

  watch(
    () => element().visibility,
    (visible) => {
      const current = source();
      const active = player();
      if (!current || !active) {
        return;
      }
      if (!visible && current.pauseOnHide && active.capabilities.pause) {
        active.pause();
        return;
      }
      if (visible && current.trigger === 'on-appear') {
        beginAfterDelay();
      }
    },
  );

  watch(
    () => store.activeSceneId,
    (activeSceneId) => {
      if (activeSceneId !== sceneId) {
        return;
      }
      const current = source();
      const active = player();
      if (current?.resetOnSceneStart && active) {
        plays = 0;
        active.restart();
      }
      if (current && sceneStartTriggers.has(current.trigger)) {
        beginAfterDelay();
      }
    },
  );

  function startFromControl() {
    plays = 0;
    begin();
  }

  holdAnimationControls(element().id, {
    play: startFromControl,
    pause: () => player()?.pause(),
    stop: () => {
      plays = 0;
      player()?.stop();
    },
    restart: () => {
      plays = 0;
      player()?.restart();
    },
  });

  onScopeDispose(() => {
    clearTimers();
    stopEnded?.();
    releaseAnimationControls(element().id);
  });

  return {
    armAutomatic,
    bindEnded,
    startFromControl,
    clearTimers,
  };
}
