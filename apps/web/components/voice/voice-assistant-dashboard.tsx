"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  CircleStop,
  Mic,
  MicOff,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { Button, Card, CardContent, cn } from "@rag/ui";

import { useVoiceAgent } from "@/hooks/use-voice-agent";

const statusCopy = {
  idle: "Ready",
  "requesting-permission": "Requesting microphone",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Assistant speaking",
  interrupted: "Interrupted",
  ended: "Ended",
  error: "Needs attention",
};

function Waveform({ values, active }: { values: number[]; active: boolean }) {
  return (
    <div className="bg-background/60 flex h-24 items-center gap-1 overflow-hidden rounded-lg border px-4">
      {values.map((value, index) => (
        <motion.span
          key={index}
          className={cn("w-full rounded-full", active ? "bg-primary" : "bg-muted-foreground/30")}
          animate={{ height: `${Math.max(8, Math.min(88, value * 180))}%` }}
          transition={{ duration: 0.12 }}
        />
      ))}
    </div>
  );
}

export function VoiceAssistantDashboard() {
  const voice = useVoiceAgent();
  const openAi = voice.capabilities.find((capability) => capability.provider === "openai_realtime");
  const canStart = voice.status === "idle" || voice.status === "ended" || voice.status === "error";
  const active =
    voice.status === "connecting" || voice.status === "listening" || voice.status === "speaking";

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-primary text-sm font-medium">Live voice agent</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                Enterprise voice workspace
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                Start a low-latency WebRTC voice session with interruption handling, server VAD,
                transcript persistence, and tenant-scoped audit events.
              </p>
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                active && "border-primary/40 bg-primary/10 text-primary",
                voice.status === "error" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {active ? <AudioLines className="size-4" /> : <Mic className="size-4" />}
              {statusCopy[voice.status]}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <ShieldCheck className="size-4" />
                Provider
              </div>
              <p className="mt-3 text-lg font-semibold">
                {openAi?.configured ? "OpenAI Realtime" : "Not configured"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Zap className="size-4" />
                Latency path
              </div>
              <p className="mt-3 text-lg font-semibold">WebRTC</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Volume2 className="size-4" />
                VAD
              </div>
              <p className="mt-3 text-lg font-semibold">
                {voice.vad.speaking ? "Speech detected" : "Quiet"}
              </p>
            </div>
          </div>

          <Waveform values={voice.waveform} active={active || voice.vad.speaking} />

          <div className="flex flex-wrap gap-3">
            <Button disabled={!canStart || !openAi?.configured} onClick={() => void voice.start()}>
              <PhoneCall />
              Start voice session
            </Button>
            <Button disabled={!active} variant="outline" onClick={voice.interrupt}>
              <MicOff />
              Interrupt
            </Button>
            <Button
              disabled={!active && voice.status !== "interrupted"}
              variant="outline"
              onClick={voice.stop}
            >
              <CircleStop />
              End session
            </Button>
            <Button variant="ghost" onClick={() => void voice.reload()}>
              <RefreshCw />
              Refresh
            </Button>
          </div>

          {voice.permissionState === "denied" ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
              Microphone permission is blocked. Enable microphone access in the browser site
              settings, then retry.
            </div>
          ) : null}

          {voice.error ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
              {voice.error}
            </div>
          ) : null}

          {!openAi?.configured ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              Add <code>OPENAI_API_KEY</code> in the deployment environment to enable live WebRTC
              voice sessions.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-4" />
              <h3 className="font-semibold">Provider readiness</h3>
            </div>
            <div className="space-y-3">
              {voice.capabilities.map((capability) => (
                <div
                  key={capability.provider}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{capability.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {capability.supportsWebrtc ? "WebRTC" : "Streaming API"} ·{" "}
                      {capability.supportsVad ? "VAD" : "External VAD"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      capability.configured
                        ? "border-emerald-500/30 text-emerald-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {capability.configured ? "Configured" : "Missing key"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="font-semibold">Recent voice sessions</h3>
            <div className="space-y-2">
              {voice.sessions.length ? (
                voice.sessions.map((session) => (
                  <div key={session.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{session.model}</p>
                      <span className="text-muted-foreground text-xs">{session.status}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {session.provider} · {session.transport} ·{" "}
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground rounded-lg border p-4 text-sm">
                  No voice sessions have been created yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
