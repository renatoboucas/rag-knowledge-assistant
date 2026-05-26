"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Clock,
  Copy,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  SendHorizontal,
  Square,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Button, Card, CardContent, Textarea, cn } from "@rag/ui";

import { useConversationRealtime } from "@/hooks/use-realtime";

type ChatRole = "user" | "assistant";

type Citation = {
  id: string;
  title: string;
  documentId?: string;
  chunkId?: string;
  sourceUri?: string | null;
  similarity?: number;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  createdAt?: string;
  pending?: boolean;
  error?: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

function createId() {
  return crypto.randomUUID();
}

function assistantMetadata(metadata: unknown): { citations?: Citation[] } {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const citations = (metadata as { citations?: Citation[] }).citations;
  return { citations: Array.isArray(citations) ? citations : undefined };
}

function TypingIndicator() {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        a: ({ className, ...props }) => (
          <a className={cn("text-primary underline underline-offset-4", className)} {...props} />
        ),
        code: ({ className, children, ...props }) => (
          <code className={cn("bg-muted rounded px-1 py-0.5 text-[0.9em]", className)} {...props}>
            {children}
          </code>
        ),
        pre: ({ className, ...props }) => (
          <pre
            className={cn(
              "bg-background my-3 overflow-x-auto rounded-lg border p-4 text-sm",
              className,
            )}
            {...props}
          />
        ),
        ul: ({ className, ...props }) => (
          <ul className={cn("my-2 list-disc pl-5", className)} {...props} />
        ),
        ol: ({ className, ...props }) => (
          <ol className={cn("my-2 list-decimal pl-5", className)} {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn("flex gap-3", isUser && "justify-end")}
    >
      {!isUser ? (
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border">
          <Bot className="size-4" />
        </div>
      ) : null}
      <div className={cn("max-w-[86%] space-y-2 md:max-w-[76%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm leading-6 shadow-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          {message.pending && !message.content ? (
            <TypingIndicator />
          ) : (
            <MarkdownMessage content={message.content} />
          )}
          {message.error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border p-2">
              {message.error}
            </div>
          ) : null}
        </div>
        {message.citations?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.citations.map((citation) => (
              <span
                key={citation.id}
                className="bg-background text-muted-foreground rounded-md border px-2 py-1 text-xs"
              >
                [{citation.id}] {citation.title}
              </span>
            ))}
          </div>
        ) : null}
        {!isUser && message.error ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw />
            Retry
          </Button>
        ) : null}
      </div>
      {isUser ? (
        <div className="bg-card flex size-9 shrink-0 items-center justify-center rounded-lg border">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </motion.div>
  );
}

export function ChatWorkspace() {
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const realtime = useConversationRealtime(conversationId);

  const canSend = input.trim().length > 0 && !isStreaming;
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user"),
    [messages],
  );

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/chat", { cache: "no-store" });
    const payload = (await response.json()) as { conversations?: ConversationSummary[] };
    setConversations(payload.conversations ?? []);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function loadConversation(id: string) {
    abortRef.current?.abort();
    const response = await fetch(`/api/chat/${id}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      conversation?: {
        id: string;
        messages: Array<{
          id: string;
          role: string;
          content: string;
          metadata?: unknown;
          createdAt: string;
        }>;
      };
    };

    if (!payload.conversation) {
      return;
    }

    setConversationId(payload.conversation.id);
    setMessages(
      payload.conversation.messages
        .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
        .map((message) => ({
          id: message.id,
          role: message.role === "USER" ? "user" : "assistant",
          content: message.content,
          createdAt: message.createdAt,
          citations: assistantMetadata(message.metadata).citations,
        })),
    );
  }

  function newConversation() {
    abortRef.current?.abort();
    setConversationId(undefined);
    setMessages([]);
    setInput("");
  }

  async function streamMessage(content: string, baseMessages = messages) {
    realtime.stopTyping();
    const userMessage: ChatMessage = { id: createId(), role: "user", content };
    const assistantId = createId();
    const outgoing = [...baseMessages, userMessage];
    setMessages([...outgoing, { id: assistantId, role: "assistant", content: "", pending: true }]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: outgoing.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const eventName = event.match(/^event: (.+)$/m)?.[1];
          const data = event.match(/^data: (.+)$/m)?.[1];

          if (!data) {
            continue;
          }

          const payload = JSON.parse(data) as {
            text?: string;
            conversationId?: string;
            citations?: Citation[];
            message?: string;
          };

          if (eventName === "meta") {
            setConversationId(payload.conversationId);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, citations: payload.citations ?? [] }
                  : message,
              ),
            );
          }

          if (eventName === "token" && payload.text) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + payload.text, pending: false }
                  : message,
              ),
            );
          }

          if (eventName === "error") {
            throw new Error(payload.message ?? "Streaming failed.");
          }
        }
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, pending: false } : message,
        ),
      );
      await loadConversations();
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, pending: false, error: "Response stopped." }
              : message,
          ),
        );
      } else {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  pending: false,
                  error: error instanceof Error ? error.message : "Unable to stream response.",
                }
              : message,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function retryLast() {
    if (!lastUserMessage) {
      return;
    }

    const retryBase = messages
      .filter((message) => message.id !== lastUserMessage.id)
      .filter((message) => !message.error);
    void streamMessage(lastUserMessage.content, retryBase);
  }

  return (
    <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[280px_1fr]">
      <Card className="hidden xl:block">
        <CardContent className="flex h-full flex-col p-3">
          <Button className="mb-3 w-full justify-start" variant="outline" onClick={newConversation}>
            <MessageSquarePlus />
            New chat
          </Button>
          <div className="space-y-2 overflow-auto">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={cn(
                  "hover:bg-muted w-full rounded-lg border p-3 text-left transition-colors",
                  conversation.id === conversationId && "border-primary bg-primary/10",
                )}
                onClick={() => void loadConversation(conversation.id)}
              >
                <p className="line-clamp-1 text-sm font-medium">{conversation.title}</p>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {conversation.preview || "No preview yet"}
                </p>
                <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  {new Date(conversation.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[70vh] overflow-hidden">
        <CardContent className="flex min-h-[70vh] flex-col p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">AI Knowledge Assistant</p>
              <p className="text-muted-foreground text-xs">
                Streaming RAG chat with citations
                {realtime.presence.length ? ` · ${realtime.presence.length} online` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-muted-foreground hidden items-center gap-1 rounded-md border px-2 py-1 text-xs md:inline-flex",
                  realtime.isConnected && "border-emerald-500/30 text-emerald-600",
                )}
              >
                {realtime.isConnected ? (
                  <Wifi className="size-3" />
                ) : (
                  <WifiOff className="size-3" />
                )}
                {realtime.status === "disabled" ? "Realtime off" : realtime.status}
              </span>
              <Button className="xl:hidden" size="sm" variant="outline" onClick={newConversation}>
                <MessageSquarePlus />
                New
              </Button>
              {messages.length ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(messages.at(-1)?.content ?? "")}
                >
                  <Copy />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="bg-muted/20 flex-1 space-y-5 overflow-auto p-4 md:p-6">
            <AnimatePresence initial={false}>
              {messages.length ? (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onRetry={retryLast} />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-auto flex max-w-2xl flex-col items-center justify-center py-16 text-center"
                >
                  <div className="bg-card text-primary mb-4 flex size-12 items-center justify-center rounded-xl border shadow-sm">
                    <Bot className="size-6" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-normal">
                    Ask your knowledge base
                  </h2>
                  <p className="text-muted-foreground mt-3 text-sm leading-6">
                    Get streamed answers grounded in retrieved context, with citations and saved
                    conversation history.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={scrollRef} />
          </div>

          <div className="bg-background border-t p-3 md:p-4">
            <div className="flex gap-3">
              <Textarea
                className="min-h-16 resize-none"
                placeholder="Ask a question about your knowledge base..."
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);

                  if (event.target.value.trim()) {
                    realtime.startTyping();
                  } else {
                    realtime.stopTyping();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) {
                      void streamMessage(input);
                    }
                  }
                }}
              />
              {isStreaming ? (
                <Button
                  aria-label="Stop response"
                  size="icon"
                  className="mt-auto"
                  variant="outline"
                  onClick={() => abortRef.current?.abort()}
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  aria-label="Send message"
                  size="icon"
                  className="mt-auto"
                  disabled={!canSend}
                  onClick={() => void streamMessage(input)}
                >
                  <SendHorizontal />
                </Button>
              )}
            </div>
            <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
              <span>
                {realtime.typingUsers.length
                  ? `${realtime.typingUsers[0]?.name ?? "A teammate"} is typing`
                  : "Enter to send · Shift+Enter for a new line"}
              </span>
              {isStreaming ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  Streaming
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
