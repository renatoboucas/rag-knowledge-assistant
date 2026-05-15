import path from "node:path";

import { DocxParser } from "@/lib/uploads/parsers/docx-parser";
import type { DocumentParser } from "@/lib/uploads/parsers/document-parser";
import { PdfParser } from "@/lib/uploads/parsers/pdf-parser";
import { TextParser } from "@/lib/uploads/parsers/text-parser";

const parsers: Record<string, DocumentParser> = {
  pdf: new PdfParser(),
  docx: new DocxParser(),
  txt: new TextParser(),
  md: new TextParser(),
} satisfies Record<string, DocumentParser>;

export function getParserForFilename(filename: string) {
  const extension = path.extname(filename).replace(".", "").toLowerCase();
  const parser = parsers[extension];

  if (!parser) {
    throw new Error(`No parser registered for extension: ${extension}`);
  }

  return parser;
}
