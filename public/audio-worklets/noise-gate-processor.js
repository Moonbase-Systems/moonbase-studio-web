class MoonbaseNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.envelope = 1;
    this.hold = 0;
  }

  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -40, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.005, minValue: 0.0001, maxValue: 0.2, automationRate: 'k-rate' },
      { name: 'hold', defaultValue: 0.08, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.15, minValue: 0.005, maxValue: 2, automationRate: 'k-rate' },
      { name: 'range', defaultValue: -60, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || !input[0] || !output[0]) {
      return true;
    }
    const frames = input[0].length;
    const threshold = 10 ** (MoonbaseNoiseGate.param(parameters.threshold) / 20);
    const closed = 10 ** (MoonbaseNoiseGate.param(parameters.range) / 20);
    const attack = Math.max(MoonbaseNoiseGate.param(parameters.attack), 0.0001);
    const release = Math.max(MoonbaseNoiseGate.param(parameters.release), 0.0001);
    const holdSeconds = MoonbaseNoiseGate.param(parameters.hold);
    for (let index = 0; index < frames; index += 1) {
      let peak = 0;
      for (let channel = 0; channel < input.length; channel += 1) {
        const sample = Math.abs(input[channel][index] || 0);
        if (sample > peak) {
          peak = sample;
        }
      }
      const open = peak >= threshold;
      let target = closed;
      if (open) {
        target = 1;
        this.hold = holdSeconds * sampleRate;
      } else if (this.hold > 0) {
        target = 1;
        this.hold -= 1;
      }
      const movingOpen = open || this.hold > 0;
      const seconds = movingOpen ? attack : release;
      const coeff = 1 - Math.exp(-1 / (seconds * sampleRate));
      this.envelope += (target - this.envelope) * coeff;
      for (let channel = 0; channel < output.length; channel += 1) {
        const source = input[channel] || input[0];
        output[channel][index] = (source[index] || 0) * this.envelope;
      }
    }
    return true;
  }

  static param(value) {
    return value && value.length ? value[0] : 0;
  }
}

registerProcessor('moonbase-noise-gate', MoonbaseNoiseGate);
