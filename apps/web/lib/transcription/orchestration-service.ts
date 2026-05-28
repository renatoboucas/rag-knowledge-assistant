import { env } from "@/lib/env";
import { telemetry } from "@/lib/observability/telemetry";
import { auditLog } from "@/lib/security/audit-log-service";
import { transcriptionProviders } from "@/lib/transcription/providers";
import { transcriptService } from "@/lib/transcription/transcript-service";
import type { TranscriptSegmentInput, TranscriptionSessionConfig } from "@/lib/transcription/types";

export function defaultTranscriptionConfig(
  overrides: Partial<TranscriptionSessionConfig> = {},
): TranscriptionSessionConfig {
  return {
    provider: env.TRANSCRIPTION_DEFAULT_PROVIDER,
    language: env.TRANSCRIPTION_DEFAULT_LANGUAGE,
    sampleRate: 16000,
    channels: 1,
    encoding: "webm",
    source: "microphone",
    speakerDetection: true,
    timestamps: true,
    multiLanguage: true,
    ...overrides,
  };
}

export class TranscriptionOrchestrationService {
  capabilities() {
    return transcriptionProviders.capabilities();
  }

  async list(input: { organizationId: string; query?: string }) {
    return transcriptService.list(input.organizationId, input.query);
  }

  async createSession(input: {
    organizationId: string;
    userId: string;
    title?: string;
    config?: Partial<TranscriptionSessionConfig>;
    request?: Request;
  }) {
    const config = defaultTranscriptionConfig(input.config);
    const provider = transcriptionProviders.get(config.provider);
    const created = await transcriptService.createSession({
      organizationId: input.organizationId,
      userId: input.userId,
      title: input.title ?? `Transcript ${new Date().toLocaleString()}`,
      config,
    });

    await auditLog.record({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "transcription.session.create",
      resource: "audio_session",
      resourceId: created.audioSession.id,
      request: input.request,
      metadata: { provider: config.provider, language: config.language },
    });

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      category: "voice",
      name: "transcription.session.created",
      provider: config.provider,
      model: config.provider === "whisper" ? env.WHISPER_TRANSCRIPTION_MODEL : config.provider,
      metadata: { audioSessionId: created.audioSession.id, transcriptId: created.transcript.id },
    });

    return {
      ...created,
      streaming: provider.streamingConfig(config),
    };
  }

  async ingestSegment(input: {
    organizationId: string;
    userId: string;
    segment: TranscriptSegmentInput;
    request?: Request;
  }) {
    const segment = await transcriptService.addSegment(input.organizationId, input.segment);

    if (!segment) {
      return null;
    }

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      category: "voice",
      name: "transcription.segment.ingested",
      metadata: {
        transcriptId: input.segment.transcriptId,
        segmentId: segment.id,
        speakerLabel: segment.speakerLabel,
        language: segment.language,
      },
    });

    return segment;
  }
}

export const transcriptionOrchestration = new TranscriptionOrchestrationService();
