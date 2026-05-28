export type VadFrame = {
  rms: number;
  peak: number;
  speaking: boolean;
};

export class VoiceActivityDetector {
  private activeFrames = 0;
  private silentFrames = 0;
  private speaking = false;

  constructor(
    private readonly threshold = 0.035,
    private readonly activationFrames = 3,
    private readonly releaseFrames = 12,
  ) {}

  analyze(samples: Float32Array): VadFrame {
    let sumSquares = 0;
    let peak = 0;

    for (const sample of samples) {
      const magnitude = Math.abs(sample);
      sumSquares += sample * sample;
      peak = Math.max(peak, magnitude);
    }

    const rms = Math.sqrt(sumSquares / Math.max(samples.length, 1));
    const active = rms >= this.threshold;

    if (active) {
      this.activeFrames += 1;
      this.silentFrames = 0;
    } else {
      this.silentFrames += 1;
      this.activeFrames = 0;
    }

    if (!this.speaking && this.activeFrames >= this.activationFrames) {
      this.speaking = true;
    }

    if (this.speaking && this.silentFrames >= this.releaseFrames) {
      this.speaking = false;
    }

    return { rms, peak, speaking: this.speaking };
  }

  reset() {
    this.activeFrames = 0;
    this.silentFrames = 0;
    this.speaking = false;
  }
}

export function downsampleWaveform(values: number[], targetSize: number) {
  if (values.length <= targetSize) {
    return values;
  }

  const bucketSize = values.length / targetSize;
  return Array.from({ length: targetSize }, (_, index) => {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    const bucket = values.slice(start, end);
    return bucket.reduce((max, value) => Math.max(max, value), 0);
  });
}
