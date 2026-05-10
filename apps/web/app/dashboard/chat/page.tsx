import { SendHorizontal } from "lucide-react";
import { Button, Card, CardContent, Textarea } from "@rag/ui";

import { PageHeader } from "@/features/dashboard/page-header";

export default function ChatPage() {
  return (
    <div>
      <PageHeader
        title="Chat"
        description="Ask questions against connected knowledge sources. Retrieval, citations, and streaming responses can be wired here."
      />
      <Card className="min-h-[64vh]">
        <CardContent className="flex min-h-[64vh] flex-col p-4">
          <div className="bg-muted/30 flex-1 rounded-md border p-4">
            <p className="text-muted-foreground text-sm">
              Chat placeholder ready for message history and streaming assistant output.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <Textarea placeholder="Ask a question about your knowledge base..." />
            <Button aria-label="Send message" size="icon" className="mt-auto">
              <SendHorizontal />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
