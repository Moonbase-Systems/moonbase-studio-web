class MoonbaseLimiterGain extends AudioWorkletProcessor {
  constructor() {
    super();
    this.gain = 1;
  }

  static get parameterDescriptors() {
    return [
      { name: 'ceiling', defaultValue: -1, minValue: -24, maxValue: 0, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.08, minValue: 0.005, maxValue: 0.5, automationRate: 'k-rate' },
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) {
      return true;
    }
    const frames = output[0].length;
    const ceiling = 10 ** (MoonbaseLimiterGain.param(parameters.ceiling, -1) / 20);
    const release = Math.max(MoonbaseLimiterGain.param(parameters.release, 0.08), 0.0001);
    const coeff = 1 - Math.exp(-1 / (release * sampleRate));
    for (let index = 0; index < frames; index += 1) {
      let peak = 0;
      if (input) {
        for (let channel = 0; channel < input.length; channel += 1) {
          const sample = Math.abs((input[channel] && input[channel][index]) || 0);
          if (sample > peak) {
            peak = sample;
          }
        }
      }
      const needed = peak > ceiling && peak > 0 ? ceiling / peak : 1;
      if (needed < this.gain) {
        this.gain = needed;
      } else {
        this.gain += (needed - this.gain) * coeff;
      }
      output[0][index] = this.gain;
    }
    return true;
  }

  static param(value, fallback) {
    return value && value.length ? value[0] : fallback;
  }
}

registerProcessor('moonbase-limiter-gain', MoonbaseLimiterGain);
