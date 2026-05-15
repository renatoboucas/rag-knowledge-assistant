import { z } from "zod";

import type { ToolDefinition } from "@/lib/agents/types";
import { env } from "@/lib/env";

const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(8).optional(),
});

type DuckDuckGoTopic = {
  Text?: string;
  FirstURL?: string;
  Name?: string;
  Topics?: DuckDuckGoTopic[];
};

type DuckDuckGoResponse = {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: DuckDuckGoTopic[];
};

function flattenTopics(topics: DuckDuckGoTopic[] = []): DuckDuckGoTopic[] {
  return topics.flatMap((topic) => (topic.Topics?.length ? flattenTopics(topic.Topics) : [topic]));
}

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the public web for current external context. Use only when the answer requires information outside the private knowledge base.",
  parameters: webSearchSchema,
  async execute(input, context) {
    const url = new URL(env.WEB_SEARCH_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const response = await fetch(url, {
      signal: context.abortSignal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Web search failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as DuckDuckGoResponse;
    const related = flattenTopics(payload.RelatedTopics)
      .filter((topic) => topic.Text && topic.FirstURL)
      .slice(0, input.limit ?? 5)
      .map((topic) => ({
        title: topic.Text?.split(" - ")[0] ?? topic.Name ?? "Result",
        snippet: topic.Text,
        url: topic.FirstURL,
      }));

    return {
      query: input.query,
      answer: payload.AbstractText || null,
      source: payload.AbstractURL || null,
      results: related,
    };
  },
};
