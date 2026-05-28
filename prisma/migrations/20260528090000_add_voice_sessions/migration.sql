CREATE TYPE "VoiceProvider" AS ENUM ('OPENAI_REALTIME', 'ELEVENLABS', 'DEEPGRAM');
CREATE TYPE "VoiceSessionStatus" AS ENUM ('INITIALIZING', 'CONNECTING', 'LISTENING', 'SPEAKING', 'INTERRUPTED', 'ENDED', 'FAILED');

CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "conversation_id" TEXT,
    "provider" "VoiceProvider" NOT NULL DEFAULT 'OPENAI_REALTIME',
    "model" TEXT NOT NULL,
    "voice" TEXT,
    "status" "VoiceSessionStatus" NOT NULL DEFAULT 'INITIALIZING',
    "transport" TEXT NOT NULL DEFAULT 'webrtc',
    "input_audio_format" TEXT NOT NULL DEFAULT 'pcm16',
    "output_audio_format" TEXT NOT NULL DEFAULT 'pcm16',
    "sample_rate" INTEGER NOT NULL DEFAULT 24000,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "last_event_at" TIMESTAMP(3),
    "error_message" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_sessions_organization_id_status_deleted_at_idx" ON "voice_sessions"("organization_id", "status", "deleted_at");
CREATE INDEX "voice_sessions_organization_id_provider_created_at_idx" ON "voice_sessions"("organization_id", "provider", "created_at");
CREATE INDEX "voice_sessions_organization_id_conversation_id_idx" ON "voice_sessions"("organization_id", "conversation_id");
CREATE INDEX "voice_sessions_user_id_created_at_idx" ON "voice_sessions"("user_id", "created_at");

ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
