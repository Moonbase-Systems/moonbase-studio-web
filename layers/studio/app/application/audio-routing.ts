import type { AudioMonitoringMode } from '../models/audio.domain';

export type ChannelRouteInput = {
  enabledInScene: boolean;
  monitoring: AudioMonitoringMode;
  solo: boolean;
  /** Solo among channels that the active scene actually enables. */
  anySoloInScene: boolean;
};

export type ChannelRoute = {
  program: boolean;
  monitor: boolean;
};

/**
 * Program and monitor sends, taken after the channel mute.
 * Mute itself is a gain in front of this split, so a muted channel is silent
 * on both buses. Solo never changes the program send.
 */
export const routeChannel = (input: ChannelRouteInput): ChannelRoute => {
  if (!input.enabledInScene) {
    return { program: false, monitor: false };
  }

  return {
    program: input.monitoring !== 'monitor',
    monitor: input.anySoloInScene ? input.solo : input.monitoring !== 'off',
  };
};

export const sceneHasSolo = (channels: readonly { enabledInScene: boolean; solo: boolean }[]): boolean =>
  channels.some((channel) => channel.enabledInScene && channel.solo);
