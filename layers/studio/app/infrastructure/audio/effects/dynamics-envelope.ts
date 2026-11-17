import { dbToGain } from '../../../models/audio.domain';

export type GateState = {
  envelope: number;
  holdSamplesLeft: number;
};

export type GateStep = {
  thresholdDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
  rangeDb: number;
};

export type LimiterState = { gain: number };

const onePole = (ms: number, sampleRate: number): number => {
  const seconds = Math.max(ms, 0.0001) / 1000;
  return 1 - Math.exp(-1 / (seconds * sampleRate));
};

/**
 * Envelope gain for the noise gate. The closed target is the range, so the gain slews instead of jumping to zero.
 * The AudioWorklet in public/audio-worklets/noise-gate-processor.js uses the same coefficients.
 */
export const stepGate = (
  state: GateState,
  peak: number,
  params: GateStep,
  sampleRate: number,
): { state: GateState; gain: number } => {
  const threshold = dbToGain(params.thresholdDb);
  const closed = dbToGain(params.rangeDb);
  const open = peak >= threshold;
  let holdSamplesLeft = state.holdSamplesLeft;
  let target = closed;
  if (open) {
    target = 1;
    holdSamplesLeft = Math.round((params.holdMs / 1000) * sampleRate);
  } else if (holdSamplesLeft > 0) {
    target = 1;
    holdSamplesLeft -= 1;
  }
  const movingOpen = open || holdSamplesLeft > 0;
  const envelope =
    state.envelope + (target - state.envelope) * onePole(movingOpen ? params.attackMs : params.releaseMs, sampleRate);
  return { state: { envelope, holdSamplesLeft }, gain: envelope };
};

/**
 * Peak limiter gain. Attack is immediate. Release slews back toward unity.
 * Lookahead is a DelayNode in front of this gain, not a high-ratio compressor.
 * public/audio-worklets/limiter-processor.js uses the same release coefficient.
 */
export const stepLimiter = (
  state: LimiterState,
  peak: number,
  params: { ceilingDb: number; releaseMs: number },
  sampleRate: number,
): { state: LimiterState; gain: number } => {
  const ceiling = dbToGain(params.ceilingDb);
  const needed = peak > ceiling && peak > 0 ? ceiling / peak : 1;
  let gain = state.gain;
  if (needed < gain) {
    gain = needed;
  } else {
    gain += (needed - gain) * onePole(params.releaseMs, sampleRate);
  }
  return { state: { gain }, gain };
};

export const limiterDelaySeconds = (lookaheadMs: number): number => lookaheadMs / 1000;

export const compressorSeconds = (ms: number): number => ms / 1000;
