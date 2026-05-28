"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceProviderCapability, VoiceSessionSummary } from "@rag/types";

import { VoiceActivityDetector, downsampleWaveform } from "@/lib/voice/audio-pipeline";

type VoiceStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "listening"
  | "speaking"
  | "interrupted"
  | "ended"
  | "error";

type VoicePayload = {
  sessions?: VoiceSessionSummary[];
  capabilities?: VoiceProviderCapability[];
};

type RealtimeTokenPayload = {
  realtime?: {
    sessionId: string;
    endpoint: string;
    model: string;
    clientSecret: { value: string; expiresAt?: number };
    config: { instructions: string; voice?: string };
  };
  message?: string;
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor {
  return window.AudioContext;
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string>();
  const [sessions, setSessions] = useState<VoiceSessionSummary[]>([]);
  const [capabilities, setCapabilities] = useState<VoiceProviderCapability[]>([]);
  const [activeSession, setActiveSession] = useState<VoiceSessionSummary>();
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 40 }, () => 0));
  const [vad, setVad] = useState({ rms: 0, peak: 0, speaking: false });
  const [permissionState, setPermissionState] = useState<PermissionState | "unknown">("unknown");

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const activeSessionRef = useRef<VoiceSessionSummary | undefined>(undefined);
  const startedAtRef = useRef<number | undefined>(undefined);

  const updateSession = useCallback(async (sessionId: string, body: Record<string, unknown>) => {
    await fetch(`/api/voice/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/voice/sessions", { cache: "no-store" });
    const payload = (await response.json()) as VoicePayload;
    setSessions(payload.sessions ?? []);
    setCapabilities(payload.capabilities ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((result) => {
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      })
      .catch(() => setPermissionState("unknown"));
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  }, []);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    const AudioCtor = getAudioContextConstructor();
    const audioContext = new AudioCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const detector = new VoiceActivityDetector();
    const data = new Float32Array(analyser.fftSize);
    const history: number[] = [];

    analyser.fftSize = 1024;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const tick = () => {
      analyser.getFloatTimeDomainData(data);
      const frame = detector.analyze(data);
      history.push(frame.peak);

      if (history.length > 160) {
        history.splice(0, history.length - 160);
      }

      setVad(frame);
      setWaveform(downsampleWaveform(history, 40));
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, []);

  const cleanup = useCallback(() => {
    stopAudioAnalysis();
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, [stopAudioAnalysis]);

  const start = useCallback(async () => {
    setError(undefined);
    setStatus("requesting-permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      startAudioAnalysis(stream);
      setStatus("connecting");

      const sessionResponse = await fetch("/api/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai_realtime" }),
      });
      const sessionPayload = (await sessionResponse.json()) as {
        session?: VoiceSessionSummary;
        message?: string;
      };

      if (!sessionResponse.ok || !sessionPayload.session) {
        throw new Error(sessionPayload.message ?? "Unable to create voice session.");
      }

      const session = sessionPayload.session;
      setActiveSession(session);
      startedAtRef.current = Date.now();

      const tokenResponse = await fetch("/api/voice/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const tokenPayload = (await tokenResponse.json()) as RealtimeTokenPayload;

      if (!tokenResponse.ok || !tokenPayload.realtime) {
        throw new Error(tokenPayload.message ?? "Unable to create realtime session.");
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          return;
        }

        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = remoteStream;
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        setStatus("listening");
        void updateSession(session.id, { status: "listening" });
      };
      channel.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as {
          type?: string;
          transcript?: string;
          delta?: string;
        };

        if (data.type === "response.audio.delta") {
          setStatus("speaking");
        }

        if (data.type === "input_audio_buffer.speech_started") {
          setStatus("listening");
        }

        if (data.type === "response.done") {
          setStatus("listening");
        }

        if (data.transcript || data.delta) {
          void updateSession(session.id, {
            transcriptItem: {
              role: data.type?.includes("input") ? "user" : "assistant",
              text: data.transcript ?? data.delta,
              endedAt: new Date().toISOString(),
            },
          });
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const sdpResponse = await fetch(
        `${tokenPayload.realtime.endpoint}?model=${tokenPayload.realtime.model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenPayload.realtime.clientSecret.value}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
          body: offer.sdp,
        },
      );

      if (!sdpResponse.ok) {
        throw new Error(await sdpResponse.text());
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
    } catch (startError) {
      cleanup();
      setStatus("error");
      setError(startError instanceof Error ? startError.message : "Voice session failed.");
    }
  }, [cleanup, startAudioAnalysis, updateSession]);

  const interrupt = useCallback(() => {
    channelRef.current?.send(JSON.stringify({ type: "response.cancel" }));
    channelRef.current?.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    setStatus("interrupted");

    if (activeSessionRef.current) {
      void updateSession(activeSessionRef.current.id, { status: "interrupted" });
    }
  }, [updateSession]);

  const stop = useCallback(() => {
    const session = activeSessionRef.current;
    cleanup();
    setStatus("ended");

    if (session) {
      void updateSession(session.id, {
        status: "ended",
        metrics: {
          durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : 0,
        },
      }).then(() => load());
    }
  }, [cleanup, load, updateSession]);

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    sessions,
    capabilities,
    activeSession,
    waveform,
    vad,
    permissionState,
    start,
    stop,
    interrupt,
    reload: load,
  };
}
