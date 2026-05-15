import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

import { env } from "@/lib/env";
import type { AiModelProfile } from "@/lib/ai/types";

export class AiProviderFactory {
  create(model: AiModelProfile, options?: { temperature?: number; maxOutputTokens?: number }) {
    const temperature = options?.temperature ?? 0.2;
    const maxOutputTokens = options?.maxOutputTokens ?? model.maxOutputTokens;

    if (model.provider === "openai") {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for OpenAI chat models.");
      }

      return new ChatOpenAI({
        apiKey: env.OPENAI_API_KEY,
        model: model.model,
        temperature,
        streaming: true,
        maxTokens: maxOutputTokens,
        timeout: env.AI_REQUEST_TIMEOUT_MS,
      }) as BaseChatModel;
    }

    if (model.provider === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required for Anthropic chat models.");
      }

      return new ChatAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        model: model.model,
        temperature,
        streaming: true,
        maxTokens: maxOutputTokens,
      }) as BaseChatModel;
    }

    if (!env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is required for Gemini chat models.");
    }

    return new ChatGoogleGenerativeAI({
      apiKey: env.GOOGLE_API_KEY,
      model: model.model,
      temperature,
      maxOutputTokens,
    }) as BaseChatModel;
  }
}
