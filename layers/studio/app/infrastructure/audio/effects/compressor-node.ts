import { dbToGain } from '../../../models/audio.domain';
import type { CompressorParameters } from '../../../models/audio-effect.domain';
import { compressorSeconds } from './dynamics-envelope';

const ramp = (param: AudioParam, value: number, time?: number) => {
  if (time === undefined) {
    param.value = value;
    return;
  }
  param.setTargetAtTime(value, time, 0.015);
};

/** The node's reduction, in dB. Nothing is estimated on top of this reading. */
export const readCompressorReduction = (node: { reduction: number }): number => node.reduction;

export const makeupLinear = (makeupDb: number): number => dbToGain(makeupDb);

export const applyCompressor = (
  compressor: DynamicsCompressorNode,
  makeup: GainNode,
  parameters: CompressorParameters,
  time?: number,
): void => {
  ramp(compressor.threshold, parameters.thresholdDb, time);
  ramp(compressor.knee, parameters.kneeDb, time);
  ramp(compressor.ratio, parameters.ratio, time);
  ramp(compressor.attack, compressorSeconds(parameters.attackMs), time);
  ramp(compressor.release, compressorSeconds(parameters.releaseMs), time);
  ramp(makeup.gain, makeupLinear(parameters.makeupDb), time);
};
