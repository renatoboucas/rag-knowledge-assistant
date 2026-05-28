import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const TranscriptionDashboard = dynamic(() =>
  import("@/components/transcriptions/transcription-dashboard").then(
    (mod) => mod.TranscriptionDashboard,
  ),
);

export default function TranscriptionsPage() {
  return (
    <div>
      <PageHeader
        title="Transcriptions"
        description="Capture live audio, persist timestamped speaker-aware transcripts, correct segments, search recordings, and export transcript artifacts."
      />
      <TranscriptionDashboard />
    </div>
  );
}
