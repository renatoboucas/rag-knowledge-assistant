"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  DatabaseZap,
  LockKeyhole,
  MessageSquareText,
} from "lucide-react";
import { Badge, Button, Card, CardContent } from "@rag/ui";

const capabilities = [
  {
    title: "Grounded answers",
    copy: "Every response is designed around retrieved knowledge and source-aware workflows.",
    icon: MessageSquareText,
  },
  {
    title: "Governed knowledge",
    copy: "Prepare teams for role-aware sources, audit-friendly ingestion, and clean operational ownership.",
    icon: LockKeyhole,
  },
  {
    title: "Fast retrieval",
    copy: "A dashboard foundation for indexing, searching, and monitoring enterprise content collections.",
    icon: DatabaseZap,
  },
];

export function LandingPage() {
  return (
    <main className="bg-background min-h-screen overflow-hidden">
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]" />
        <div className="container flex min-h-[92vh] flex-col justify-between py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
                <BrainCircuit className="size-5" />
              </span>
              RAG Knowledge Assistant
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/chat">
                  Open workspace <ArrowRight />
                </Link>
              </Button>
            </div>
          </nav>

          <div className="grid items-center gap-10 py-16 lg:grid-cols-[1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <Badge variant="secondary" className="mb-5">
                Enterprise AI workspace
              </Badge>
              <h1 className="text-foreground text-4xl font-semibold tracking-normal sm:text-6xl">
                RAG Knowledge Assistant
              </h1>
              <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
                A production-ready foundation for teams building governed retrieval-augmented chat
                over trusted knowledge sources.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard/chat">
                    Start asking <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/dashboard/knowledge-base">Review sources</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="bg-card/85 shadow-enterprise rounded-lg border p-3 backdrop-blur"
            >
              <div className="bg-background rounded-md border p-4">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Retrieval health</p>
                    <p className="text-muted-foreground text-xs">Knowledge graph synchronized</p>
                  </div>
                  <Badge>Live</Badge>
                </div>
                <div className="space-y-3">
                  {["Policy repository", "Product handbook", "Customer insights"].map(
                    (source, index) => (
                      <div
                        key={source}
                        className="bg-card flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{source}</p>
                          <p className="text-muted-foreground text-xs">
                            {128 - index * 23} indexed documents
                          </p>
                        </div>
                        <div className="bg-muted h-2 w-24 rounded-full">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${92 - index * 12}%` }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 pb-8 md:grid-cols-3">
            {capabilities.map((item) => (
              <Card key={item.title} className="bg-card/80 backdrop-blur">
                <CardContent className="p-5">
                  <item.icon className="text-primary mb-4 size-5" />
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{item.copy}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
