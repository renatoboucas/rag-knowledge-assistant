import { describe, expect, it } from "vitest";

import { VoiceActivityDetector, downsampleWaveform } from "@/lib/voice/audio-pipeline";

describe("voice audio pipeline", () => {
  it("detects speech after sustained active frames and releases after silence", () => {
    const detector = new VoiceActivityDetector(0.1, 2, 2);
    const active = new Float32Array([0.2, -0.2, 0.15, -0.15]);
    const silent = new Float32Array([0.01, -0.01, 0.005, -0.005]);

    expect(detector.analyze(active).speaking).toBe(false);
    expect(detector.analyze(active).speaking).toBe(true);
    expect(detector.analyze(silent).speaking).toBe(true);
    expect(detector.analyze(silent).speaking).toBe(false);
  });

  it("downsamples waveform buckets while preserving peaks", () => {
    expect(downsampleWaveform([0, 0.5, 0.2, 1, 0.1, 0.7], 3)).toEqual([0.5, 1, 0.7]);
  });
});
