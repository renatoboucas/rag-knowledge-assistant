CREATE TYPE "TranscriptionProvider" AS ENUM ('DEEPGRAM', 'WHISPER', 'ASSEMBLYAI');
CREATE TYPE "AudioSessionStatus" AS ENUM ('CREATED', 'STREAMING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "TranscriptStatus" AS ENUM ('DRAFT', 'STREAMING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED');

CREATE TABLE "audio_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "voice_session_id" TEXT,
    "provider" "TranscriptionProvider" NOT NULL,
    "status" "AudioSessionStatus" NOT NULL DEFAULT 'CREATED',
    "language" TEXT NOT NULL DEFAULT 'en',
    "sample_rate" INTEGER NOT NULL DEFAULT 16000,
    "channels" INTEGER NOT NULL DEFAULT 1,
    "encoding" TEXT NOT NULL DEFAULT 'linear16',
    "source" TEXT NOT NULL DEFAULT 'microphone',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "last_event_at" TIMESTAMP(3),
    "error_message" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "audio_session_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "detected_languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "speaker_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "full_text" TEXT NOT NULL DEFAULT '',
    "corrected_text" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "segment_index" INTEGER NOT NULL,
    "speaker_label" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "text" TEXT NOT NULL,
    "corrected_text" TEXT,
    "start_ms" INTEGER NOT NULL DEFAULT 0,
    "end_ms" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "words" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audio_sessions_organization_id_status_deleted_at_idx" ON "audio_sessions"("organization_id", "status", "deleted_at");
CREATE INDEX "audio_sessions_organization_id_provider_created_at_idx" ON "audio_sessions"("organization_id", "provider", "created_at");
CREATE INDEX "audio_sessions_voice_session_id_idx" ON "audio_sessions"("voice_session_id");
CREATE INDEX "audio_sessions_user_id_created_at_idx" ON "audio_sessions"("user_id", "created_at");

CREATE INDEX "transcripts_organization_id_status_deleted_at_idx" ON "transcripts"("organization_id", "status", "deleted_at");
CREATE INDEX "transcripts_organization_id_language_created_at_idx" ON "transcripts"("organization_id", "language", "created_at");
CREATE INDEX "transcripts_audio_session_id_idx" ON "transcripts"("audio_session_id");

CREATE UNIQUE INDEX "transcript_segments_transcript_id_segment_index_key" ON "transcript_segments"("transcript_id", "segment_index");
CREATE INDEX "transcript_segments_organization_id_transcript_id_start_ms_idx" ON "transcript_segments"("organization_id", "transcript_id", "start_ms");
CREATE INDEX "transcript_segments_organization_id_speaker_label_idx" ON "transcript_segments"("organization_id", "speaker_label");

ALTER TABLE "audio_sessions" ADD CONSTRAINT "audio_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audio_sessions" ADD CONSTRAINT "audio_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audio_sessions" ADD CONSTRAINT "audio_sessions_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_audio_session_id_fkey" FOREIGN KEY ("audio_session_id") REFERENCES "audio_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
