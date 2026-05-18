import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const ChatWorkspace = dynamic(() =>
  import("@/components/chat/chat-workspace").then((mod) => mod.ChatWorkspace),
);

export default function ChatPage() {
  return (
    <div>
      <PageHeader
        title="Chat"
        description="Ask questions against connected knowledge sources. Retrieval, citations, and streaming responses can be wired here."
      />
      <ChatWorkspace />
    </div>
  );
}
