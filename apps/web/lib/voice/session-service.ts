import type { Prisma, VoiceProvider, VoiceSessionStatus } from "@prisma/client";
import type { VoiceProvider as PublicVoiceProvider, VoiceSessionState } from "@rag/types";

import { prisma } from "@/lib/prisma";
import type { VoiceSessionConfig, VoiceSessionUpdate } from "@/lib/voice/types";

const providerToPrisma = {
  openai_realtime: "OPENAI_REALTIME",
  elevenlabs: "ELEVENLABS",
  deepgram: "DEEPGRAM",
} satisfies Record<PublicVoiceProvider, VoiceProvider>;

const providerFromPrisma = {
  OPENAI_REALTIME: "openai_realtime",
  ELEVENLABS: "elevenlabs",
  DEEPGRAM: "deepgram",
} satisfies Record<VoiceProvider, PublicVoiceProvider>;

const statusToPrisma = {
  initializing: "INITIALIZING",
  connecting: "CONNECTING",
  listening: "LISTENING",
  speaking: "SPEAKING",
  interrupted: "INTERRUPTED",
  ended: "ENDED",
  failed: "FAILED",
} satisfies Record<VoiceSessionState, VoiceSessionStatus>;

const statusFromPrisma = {
  INITIALIZING: "initializing",
  CONNECTING: "connecting",
  LISTENING: "listening",
  SPEAKING: "speaking",
  INTERRUPTED: "interrupted",
  ENDED: "ended",
  FAILED: "failed",
} satisfies Record<VoiceSessionStatus, VoiceSessionState>;

function serialize(session: {
  id: string;
  provider: VoiceProvider;
  model: string;
  voice: string | null;
  status: VoiceSessionStatus;
  transport: string;
  startedAt: Date | null;
  endedAt: Date | null;
  lastEventAt: Date | null;
  createdAt: Date;
  metadata: Prisma.JsonValue;
}) {
  return {
    id: session.id,
    provider: providerFromPrisma[session.provider],
    model: session.model,
    voice: session.voice,
    status: statusFromPrisma[session.status],
    transport: session.transport === "websocket" ? "websocket" : "webrtc",
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    lastEventAt: session.lastEventAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    metadata:
      typeof session.metadata === "object" && session.metadata && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {},
  };
}

export class VoiceSessionService {
  async list(organizationId: string) {
    const sessions = await prisma.voiceSession.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return sessions.map(serialize);
  }

  async create(input: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    config: VoiceSessionConfig;
  }) {
    const session = await prisma.voiceSession.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        conversationId: input.conversationId,
        provider: providerToPrisma[input.config.provider],
        model: input.config.model,
        voice: input.config.voice,
        transport: input.config.transport,
        inputAudioFormat: input.config.inputAudioFormat,
        outputAudioFormat: input.config.outputAudioFormat,
        sampleRate: input.config.sampleRate,
        status: "INITIALIZING",
        metadata: JSON.parse(JSON.stringify({ turnDetection: input.config.turnDetection })),
      },
    });

    return serialize(session);
  }

  async update(input: { organizationId: string; sessionId: string; update: VoiceSessionUpdate }) {
    const existing = await prisma.voiceSession.findFirst({
      where: {
        id: input.sessionId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return null;
    }

    const transcript = Array.isArray(existing.transcript)
      ? [...existing.transcript]
      : ([] as unknown[]);

    if (input.update.transcriptItem) {
      transcript.push(input.update.transcriptItem);
    }

    const currentMetrics =
      typeof existing.metrics === "object" && existing.metrics && !Array.isArray(existing.metrics)
        ? (existing.metrics as Record<string, unknown>)
        : {};

    const status = input.update.status ? statusToPrisma[input.update.status] : existing.status;
    const endedAt = status === "ENDED" || status === "FAILED" ? new Date() : existing.endedAt;

    const session = await prisma.voiceSession.update({
      where: { id: existing.id },
      data: {
        status,
        transcript: JSON.parse(JSON.stringify(transcript)),
        metrics: JSON.parse(JSON.stringify({ ...currentMetrics, ...input.update.metrics })),
        errorMessage: input.update.errorMessage,
        startedAt: existing.startedAt ?? new Date(),
        endedAt,
        lastEventAt: new Date(),
      },
    });

    return serialize(session);
  }
}

export const voiceSessionService = new VoiceSessionService();
