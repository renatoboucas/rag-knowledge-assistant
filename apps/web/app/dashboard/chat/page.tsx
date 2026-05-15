import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageHeader } from "@/features/dashboard/page-header";

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
