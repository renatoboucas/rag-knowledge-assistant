import { auditLog } from "@/lib/security/audit-log-service";
import { telemetry } from "@/lib/observability/telemetry";
import {
  defaultVoiceSessionConfig,
  realtimeSessionManager,
} from "@/lib/voice/realtime-session-manager";
import { voiceProviders } from "@/lib/voice/providers";
import { voiceSessionService } from "@/lib/voice/session-service";
import type { VoiceSessionConfig, VoiceSessionUpdate } from "@/lib/voice/types";

export class VoiceOrchestrationService {
  capabilities() {
    return voiceProviders.capabilities();
  }

  async listSessions(organizationId: string) {
    return voiceSessionService.list(organizationId);
  }

  async createSession(input: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    config?: Partial<VoiceSessionConfig>;
    request?: Request;
  }) {
    const config = defaultVoiceSessionConfig(input.config);
    const session = await voiceSessionService.create({
      organizationId: input.organizationId,
      userId: input.userId,
      conversationId: input.conversationId,
      config,
    });

    await auditLog.record({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "voice.session.create",
      resource: "voice_session",
      resourceId: session.id,
      request: input.request,
      metadata: { provider: session.provider, model: session.model, transport: session.transport },
    });

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      category: "voice",
      name: "voice.session.created",
      provider: session.provider,
      model: session.model,
      metadata: { sessionId: session.id },
    });

    return session;
  }

  async createRealtimeToken(input: {
    organizationId: string;
    userId: string;
    sessionId: string;
    config?: Partial<VoiceSessionConfig>;
    request?: Request;
  }) {
    const config = defaultVoiceSessionConfig(input.config);

    await voiceSessionService.update({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      update: { status: "connecting" },
    });

    const token = await realtimeSessionManager.createOpenAiClientSecret({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      userId: input.userId,
      config,
    });

    await auditLog.record({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "voice.realtime_token.create",
      resource: "voice_session",
      resourceId: input.sessionId,
      request: input.request,
      metadata: {
        provider: token.provider,
        model: token.model,
        expiresAt: token.clientSecret.expiresAt,
      },
    });

    return token;
  }

  async updateSession(input: {
    organizationId: string;
    userId: string;
    sessionId: string;
    update: VoiceSessionUpdate;
    request?: Request;
  }) {
    const session = await voiceSessionService.update({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      update: input.update,
    });

    if (!session) {
      return null;
    }

    await telemetry.captureEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      category: "voice",
      name: "voice.session.updated",
      provider: session.provider,
      model: session.model,
      metadata: { sessionId: session.id, status: session.status },
    });

    return session;
  }
}

export const voiceOrchestration = new VoiceOrchestrationService();
