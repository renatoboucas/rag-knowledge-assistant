import { PDFParse } from "pdf-parse";

import type { DocumentParser } from "@/lib/uploads/parsers/document-parser";

export class PdfParser implements DocumentParser {
  async parse(input: { buffer: Buffer; filename: string; mimeType: string }) {
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });

    try {
      const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()]);
      const text = textResult.text.trim();

      return {
        text,
        metadata: {
          parser: "pdf-parse",
          filename: input.filename,
          mimeType: input.mimeType,
          pageCount: textResult.total,
          info: infoResult.info,
          characterCount: text.length,
        },
      };
    } finally {
      await parser.destroy();
    }
  }
}
