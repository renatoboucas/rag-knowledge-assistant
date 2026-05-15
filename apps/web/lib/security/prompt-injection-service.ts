import { env } from "@/lib/env";

const promptInjectionPatterns = [
  /ignore (all|any|previous|above) (instructions|rules|system)/i,
  /disregard (all|any|previous|above) (instructions|rules|system)/i,
  /reveal (the )?(system|developer|hidden) (prompt|message|instructions)/i,
  /you are now (in|a|an)/i,
  /act as (developer|system|admin|root)/i,
  /print (the )?(system|developer|hidden) (prompt|message|instructions)/i,
  /do not follow (the )?(policy|instructions|rules)/i,
];

export type PromptSafetyResult = {
  safe: boolean;
  risk: "low" | "medium" | "high";
  reasons: string[];
};

export class PromptInjectionService {
  evaluate(input: string): PromptSafetyResult {
    if (!env.SECURITY_BLOCK_PROMPT_INJECTION) {
      return { safe: true, risk: "low", reasons: [] };
    }

    const reasons = promptInjectionPatterns
      .filter((pattern) => pattern.test(input))
      .map((pattern) => pattern.source);

    return {
      safe: reasons.length === 0,
      risk: reasons.length > 1 ? "high" : reasons.length ? "medium" : "low",
      reasons,
    };
  }
}

export const promptInjection = new PromptInjectionService();
