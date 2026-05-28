import type {
  AudioSessionStatus as PrismaAudioSessionStatus,
  TranscriptStatus as PrismaTranscriptStatus,
  TranscriptionProvider as PrismaTranscriptionProvider,
} from "@prisma/client";
import type { AudioSessionStatus, TranscriptionProvider, TranscriptStatus } from "@rag/types";

import { prisma } from "@/lib/prisma";
import type {
  AudioSessionUpdate,
  TranscriptCorrectionInput,
  TranscriptSegmentInput,
  TranscriptUpdate,
  TranscriptionSessionConfig,
} from "@/lib/transcription/types";

const providerToPrisma = {
  deepgram: "DEEPGRAM",
  whisper: "WHISPER",
  assemblyai: "ASSEMBLYAI",
} satisfies Record<TranscriptionProvider, PrismaTranscriptionProvider>;

const providerFromPrisma = {
  DEEPGRAM: "deepgram",
  WHISPER: "whisper",
  ASSEMBLYAI: "assemblyai",
} satisfies Record<PrismaTranscriptionProvider, TranscriptionProvider>;

const audioStatusToPrisma = {
  created: "CREATED",
  streaming: "STREAMING",
  processing: "PROCESSING",
  completed: "COMPLETED",
  failed: "FAILED",
  cancelled: "CANCELLED",
} satisfies Record<AudioSessionStatus, PrismaAudioSessionStatus>;

const audioStatusFromPrisma = {
  CREATED: "created",
  STREAMING: "streaming",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} satisfies Record<PrismaAudioSessionStatus, AudioSessionStatus>;

const transcriptStatusToPrisma = {
  draft: "DRAFT",
  streaming: "STREAMING",
  processing: "PROCESSING",
  completed: "COMPLETED",
  failed: "FAILED",
  archived: "ARCHIVED",
} satisfies Record<TranscriptStatus, PrismaTranscriptStatus>;

const transcriptStatusFromPrisma = {
  DRAFT: "draft",
  STREAMING: "streaming",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  ARCHIVED: "archived",
} satisfies Record<PrismaTranscriptStatus, TranscriptStatus>;

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function serializeAudioSession(session: {
  id: string;
  provider: PrismaTranscriptionProvider;
  status: PrismaAudioSessionStatus;
  language: string;
  sampleRate: number;
  source: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: session.id,
    provider: providerFromPrisma[session.provider],
    status: audioStatusFromPrisma[session.status],
    language: session.language,
    sampleRate: session.sampleRate,
    source: session.source,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
  };
}

function serializeSegment(segment: {
  id: string;
  segmentIndex: number;
  speakerLabel: string | null;
  language: string;
  text: string;
  correctedText: string | null;
  startMs: number;
  endMs: number;
  confidence: number | null;
  createdAt: Date;
}) {
  return {
    id: segment.id,
    segmentIndex: segment.segmentIndex,
    speakerLabel: segment.speakerLabel,
    language: segment.language,
    text: segment.text,
    correctedText: segment.correctedText,
    startMs: segment.startMs,
    endMs: segment.endMs,
    confidence: segment.confidence,
    createdAt: segment.createdAt.toISOString(),
  };
}

function serializeTranscript(transcript: {
  id: string;
  audioSessionId: string;
  title: string;
  status: PrismaTranscriptStatus;
  language: string;
  detectedLanguages: string[];
  speakerCount: number;
  durationMs: number;
  wordCount: number;
  confidence: number | null;
  fullText: string;
  correctedText: string | null;
  createdAt: Date;
  updatedAt: Date;
  segments?: Array<Parameters<typeof serializeSegment>[0]>;
}) {
  return {
    id: transcript.id,
    audioSessionId: transcript.audioSessionId,
    title: transcript.title,
    status: transcriptStatusFromPrisma[transcript.status],
    language: transcript.language,
    detectedLanguages: transcript.detectedLanguages,
    speakerCount: transcript.speakerCount,
    durationMs: transcript.durationMs,
    wordCount: transcript.wordCount,
    confidence: transcript.confidence,
    fullText: transcript.fullText,
    correctedText: transcript.correctedText,
    createdAt: transcript.createdAt.toISOString(),
    updatedAt: transcript.updatedAt.toISOString(),
    segments: transcript.segments?.map(serializeSegment),
  };
}

export class TranscriptService {
  async list(organizationId: string, query?: string) {
    const transcripts = await prisma.transcript.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { fullText: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        segments: {
          where: { deletedAt: null },
          orderBy: { startMs: "asc" },
          take: 20,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    return transcripts.map(serializeTranscript);
  }

  async createSession(input: {
    organizationId: string;
    userId: string;
    title: string;
    config: TranscriptionSessionConfig;
  }) {
    const result = await prisma.$transaction(async (tx) => {
      const audioSession = await tx.audioSession.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          provider: providerToPrisma[input.config.provider],
          status: "CREATED",
          language: input.config.language,
          sampleRate: input.config.sampleRate,
          channels: input.config.channels,
          encoding: input.config.encoding,
          source: input.config.source,
          metadata: {
            speakerDetection: input.config.speakerDetection,
            timestamps: input.config.timestamps,
            multiLanguage: input.config.multiLanguage,
          },
        },
      });

      const transcript = await tx.transcript.create({
        data: {
          organizationId: input.organizationId,
          audioSessionId: audioSession.id,
          createdById: input.userId,
          title: input.title,
          status: "DRAFT",
          language: input.config.language,
        },
        include: { segments: true },
      });

      return { audioSession, transcript };
    });

    return {
      audioSession: serializeAudioSession(result.audioSession),
      transcript: serializeTranscript(result.transcript),
    };
  }

  async updateAudioSession(input: {
    organizationId: string;
    audioSessionId: string;
    update: AudioSessionUpdate;
  }) {
    const status = input.update.status ? audioStatusToPrisma[input.update.status] : undefined;
    const endedAt =
      status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
        ? new Date()
        : undefined;

    const session = await prisma.audioSession.update({
      where: { id: input.audioSessionId, organizationId: input.organizationId },
      data: {
        status,
        errorMessage: input.update.errorMessage,
        metadata: input.update.metadata
          ? JSON.parse(JSON.stringify(input.update.metadata))
          : undefined,
        startedAt: status === "STREAMING" ? new Date() : undefined,
        endedAt,
        lastEventAt: new Date(),
      },
    });

    return serializeAudioSession(session);
  }

  async addSegment(organizationId: string, input: TranscriptSegmentInput) {
    const transcript = await prisma.transcript.findFirst({
      where: { id: input.transcriptId, organizationId, deletedAt: null },
      include: { segments: { where: { deletedAt: null }, orderBy: { segmentIndex: "asc" } } },
    });

    if (!transcript) {
      return null;
    }

    const segmentIndex = transcript.segments.length;
    const nextText = [
      ...transcript.segments.map((segment) => segment.correctedText ?? segment.text),
      input.text,
    ]
      .join(" ")
      .trim();
    const languages = new Set([
      ...transcript.detectedLanguages,
      input.language ?? transcript.language,
    ]);
    const speakers = new Set(
      [...transcript.segments.map((segment) => segment.speakerLabel), input.speakerLabel].filter(
        Boolean,
      ),
    );

    const [segment] = await prisma.$transaction([
      prisma.transcriptSegment.create({
        data: {
          organizationId,
          transcriptId: input.transcriptId,
          segmentIndex,
          speakerLabel: input.speakerLabel,
          language: input.language ?? transcript.language,
          text: input.text,
          startMs: input.startMs ?? transcript.durationMs,
          endMs: input.endMs ?? input.startMs ?? transcript.durationMs,
          confidence: input.confidence,
          words: JSON.parse(JSON.stringify(input.words ?? [])),
          metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
        },
      }),
      prisma.transcript.update({
        where: { id: transcript.id },
        data: {
          status: "STREAMING",
          fullText: nextText,
          detectedLanguages: [...languages],
          speakerCount: speakers.size,
          durationMs: Math.max(
            transcript.durationMs,
            input.endMs ?? input.startMs ?? transcript.durationMs,
          ),
          wordCount: wordCount(nextText),
          confidence: input.confidence ?? transcript.confidence,
        },
      }),
    ]);

    return serializeSegment(segment);
  }

  async correctSegment(input: {
    organizationId: string;
    segmentId: string;
    correction: TranscriptCorrectionInput;
  }) {
    const segment = await prisma.transcriptSegment.findFirst({
      where: { id: input.segmentId, organizationId: input.organizationId, deletedAt: null },
      include: {
        transcript: {
          include: { segments: { where: { deletedAt: null }, orderBy: { segmentIndex: "asc" } } },
        },
      },
    });

    if (!segment) {
      return null;
    }

    const updatedSegments = segment.transcript.segments.map((item) =>
      item.id === segment.id ? { ...item, correctedText: input.correction.correctedText } : item,
    );
    const correctedText = updatedSegments
      .map((item) => item.correctedText ?? item.text)
      .join(" ")
      .trim();

    const updated = await prisma.$transaction(async (tx) => {
      const corrected = await tx.transcriptSegment.update({
        where: { id: segment.id },
        data: {
          correctedText: input.correction.correctedText,
          metadata: {
            correctionReason: input.correction.reason,
            correctedAt: new Date().toISOString(),
          },
        },
      });

      await tx.transcript.update({
        where: { id: segment.transcriptId },
        data: {
          correctedText,
          wordCount: wordCount(correctedText),
        },
      });

      return corrected;
    });

    return serializeSegment(updated);
  }

  async updateTranscript(input: {
    organizationId: string;
    transcriptId: string;
    update: TranscriptUpdate;
  }) {
    const transcript = await prisma.transcript.update({
      where: { id: input.transcriptId, organizationId: input.organizationId },
      data: {
        status: input.update.status ? transcriptStatusToPrisma[input.update.status] : undefined,
        correctedText: input.update.correctedText,
      },
      include: { segments: { where: { deletedAt: null }, orderBy: { startMs: "asc" } } },
    });

    return serializeTranscript(transcript);
  }

  async getForExport(organizationId: string, transcriptId: string) {
    const transcript = await prisma.transcript.findFirst({
      where: { id: transcriptId, organizationId, deletedAt: null },
      include: { segments: { where: { deletedAt: null }, orderBy: { startMs: "asc" } } },
    });

    return transcript ? serializeTranscript(transcript) : null;
  }
}

export const transcriptService = new TranscriptService();
