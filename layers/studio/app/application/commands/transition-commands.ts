import type { TransitionId } from '../../models/ids.domain';
import type { Transition } from '../../models/transition.domain';
import { portErr } from '../../ports/result';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type TransitionDraft = Omit<Transition, 'id'>;

export type TransitionChanges = {
  durationMs?: number;
  easing?: string;
  settings?: Transition['settings'];
};

export const addTransition = (
  session: StudioSession,
  draft: TransitionDraft,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const transition = { ...structuredClone(draft), id: ctx.generateId() } as Transition;

  return withClonedProject(
    session,
    (project) => {
      project.transitions.push(transition);
    },
    ctx,
  );
};

export const updateTransition = (
  session: StudioSession,
  transitionId: TransitionId,
  changes: TransitionChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (!session.project.transitions.some((item) => item.id === transitionId)) {
    return portErr({ kind: 'transition-not-found', transitionId });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.transitions.find((item) => item.id === transitionId)!;
      if (changes.durationMs !== undefined) {
        target.durationMs = changes.durationMs;
      }
      if (changes.easing !== undefined) {
        target.easing = changes.easing;
      }
      if (changes.settings !== undefined) {
        target.settings = structuredClone(changes.settings);
      }
    },
    ctx,
  );
};

export const removeTransition = (
  session: StudioSession,
  transitionId: TransitionId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (!session.project.transitions.some((item) => item.id === transitionId)) {
    return portErr({ kind: 'transition-not-found', transitionId });
  }

  const usedByScene = session.project.scenes.some((scene) => scene.settings.defaultTransitionId === transitionId);
  if (usedByScene) {
    return portErr({
      kind: 'rule-violation',
      rule: 'transition-in-use',
      message: 'Transition is still set as a scene default',
    });
  }

  return withClonedProject(
    session,
    (project) => {
      project.transitions = project.transitions.filter((item) => item.id !== transitionId);
    },
    ctx,
  );
};
