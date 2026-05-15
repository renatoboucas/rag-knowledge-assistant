import { z } from "zod";

import type { ToolDefinition } from "@/lib/agents/types";

const calculatorSchema = z.object({
  expression: z.string().min(1).max(500),
});

class ExpressionParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse() {
    const value = this.expression();
    this.skipWhitespace();

    if (this.index < this.input.length) {
      throw new Error(`Unexpected token at position ${this.index}.`);
    }

    return value;
  }

  private expression(): number {
    let value = this.term();

    while (true) {
      this.skipWhitespace();

      if (this.consume("+")) {
        value += this.term();
      } else if (this.consume("-")) {
        value -= this.term();
      } else {
        return value;
      }
    }
  }

  private term(): number {
    let value = this.factor();

    while (true) {
      this.skipWhitespace();

      if (this.consume("*")) {
        value *= this.factor();
      } else if (this.consume("/")) {
        value /= this.factor();
      } else {
        return value;
      }
    }
  }

  private factor(): number {
    let value = this.unary();

    while (true) {
      this.skipWhitespace();

      if (!this.consume("^")) {
        return value;
      }

      value **= this.unary();
    }
  }

  private unary(): number {
    this.skipWhitespace();

    if (this.consume("-")) {
      return -this.unary();
    }

    if (this.consume("+")) {
      return this.unary();
    }

    return this.primary();
  }

  private primary(): number {
    this.skipWhitespace();

    if (this.consume("(")) {
      const value = this.expression();

      if (!this.consume(")")) {
        throw new Error("Missing closing parenthesis.");
      }

      return value;
    }

    return this.number();
  }

  private number() {
    this.skipWhitespace();
    const start = this.index;

    while (/[0-9.]/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }

    const raw = this.input.slice(start, this.index);
    const value = Number(raw);

    if (!raw || Number.isNaN(value)) {
      throw new Error(`Expected number at position ${start}.`);
    }

    return value;
  }

  private consume(token: string) {
    this.skipWhitespace();

    if (this.input.startsWith(token, this.index)) {
      this.index += token.length;
      return true;
    }

    return false;
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }
  }
}

export const calculatorTool: ToolDefinition = {
  name: "calculator",
  description: "Evaluate deterministic arithmetic expressions with +, -, *, /, ^, and parentheses.",
  parameters: calculatorSchema,
  async execute(input) {
    const result = new ExpressionParser(input.expression).parse();

    if (!Number.isFinite(result)) {
      throw new Error("Expression produced a non-finite result.");
    }

    return {
      expression: input.expression,
      result,
    };
  },
};
