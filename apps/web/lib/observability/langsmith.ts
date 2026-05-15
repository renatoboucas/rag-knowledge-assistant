import { Client } from "langsmith";

import { env } from "@/lib/env";
import type { TraceInput } from "@/lib/observability/types";

const globalForLangSmith = globalThis as unknown as {
  langsmith?: Client;
};

function getLangSmithClient() {
  if (!env.LANGSMITH_TRACING || !env.LANGSMITH_API_KEY) {
    return null;
  }

  globalForLangSmith.langsmith ??= new Client({
    apiKey: env.LANGSMITH_API_KEY,
  });

  return globalForLangSmith.langsmith;
}

export async function createLangSmithTrace(input: TraceInput) {
  const client = getLangSmithClient();

  if (!client) {
    return;
  }

  await client.createRun({
    id: input.id,
    name: input.name,
    run_type: input.runType,
    inputs: input.inputs,
    outputs: input.outputs,
    error: input.error,
    project_name: env.LANGSMITH_PROJECT,
    extra: {
      metadata: input.metadata ?? {},
    },
  });
}
