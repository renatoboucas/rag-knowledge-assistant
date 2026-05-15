import mammoth from "mammoth";

import type { DocumentParser } from "@/lib/uploads/parsers/document-parser";

export class DocxParser implements DocumentParser {
  async parse(input: { buffer: Buffer; filename: string; mimeType: string }) {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    const text = result.value.trim();

    return {
      text,
      metadata: {
        parser: "mammoth",
        filename: input.filename,
        mimeType: input.mimeType,
        warningCount: result.messages.length,
        warnings: result.messages.map((message) => message.message).slice(0, 10),
        characterCount: text.length,
      },
    };
  }
}
