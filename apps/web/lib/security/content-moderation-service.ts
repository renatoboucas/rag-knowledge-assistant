import { env } from "@/lib/env";

const moderationPatterns = [
  { label: "self_harm", pattern: /\b(suicide|self-harm|kill myself)\b/i },
  { label: "violence", pattern: /\b(build|make|create).{0,40}\b(bomb|explosive|weapon)\b/i },
  {
    label: "credential_theft",
    pattern: /\b(phish|steal password|dump credentials|session token)\b/i,
  },
  { label: "malware", pattern: /\b(ransomware|keylogger|malware|backdoor)\b/i },
];

export type ModerationResult = {
  allowed: boolean;
  categories: string[];
};

export class ContentModerationService {
  moderate(input: string): ModerationResult {
    if (!env.SECURITY_ENABLE_MODERATION) {
      return { allowed: true, categories: [] };
    }

    const categories = moderationPatterns
      .filter((item) => item.pattern.test(input))
      .map((item) => item.label);

    return {
      allowed: categories.length === 0,
      categories,
    };
  }
}

export const contentModeration = new ContentModerationService();
