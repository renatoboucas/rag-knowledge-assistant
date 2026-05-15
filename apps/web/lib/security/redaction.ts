const secretPatterns = [
  /sk-[a-zA-Z0-9_-]{16,}/g,
  /sk-proj-[a-zA-Z0-9_-]{16,}/g,
  /sbp_[a-zA-Z0-9_-]{16,}/g,
  /[A-Za-z0-9+/]{32,}={0,2}/g,
];

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return secretPatterns.reduce(
      (text, pattern) => text.replace(pattern, "[REDACTED_SECRET]"),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        /key|secret|token|password|credential/i.test(key) ? key : key,
        /key|secret|token|password|credential/i.test(key)
          ? "[REDACTED_SECRET]"
          : redactSecrets(item),
      ]),
    );
  }

  return value;
}
