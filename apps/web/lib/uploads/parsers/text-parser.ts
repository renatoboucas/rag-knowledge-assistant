import type { DocumentParser } from "@/lib/uploads/parsers/document-parser";

export class TextParser implements DocumentParser {
  async parse(input: { buffer: Buffer; filename: string; mimeType: string }) {
    const text = input.buffer
      .toString("utf8")
      .replace(/\u0000/g, "")
      .trim();

    return {
      text,
      metadata: {
        parser: "text",
        filename: input.filename,
        mimeType: input.mimeType,
        characterCount: text.length,
      },
    };
  }
}
