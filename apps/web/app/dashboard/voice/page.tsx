import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const VoiceAssistantDashboard = dynamic(() =>
  import("@/components/voice/voice-assistant-dashboard").then((mod) => mod.VoiceAssistantDashboard),
);

export default function VoicePage() {
  return (
    <div>
      <PageHeader
        title="Voice Agent"
        description="Run low-latency voice conversations with WebRTC, realtime audio processing, interruption handling, and persistent voice session telemetry."
      />
      <VoiceAssistantDashboard />
    </div>
  );
}
