export function estimateTokenCount(text: string) {
  if (!text.trim()) {
    return 0;
  }

  return Math.ceil(text.trim().length / 4);
}

export function truncateToTokenBudget(text: string, maxTokens: number) {
  const estimated = estimateTokenCount(text);

  if (estimated <= maxTokens) {
    return text;
  }

  return text.slice(0, Math.max(0, maxTokens * 4)).trimEnd();
}
