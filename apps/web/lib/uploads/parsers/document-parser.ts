import type { ParsedDocument } from "@/lib/uploads/types/upload";

export interface DocumentParser {
  parse(input: { buffer: Buffer; filename: string; mimeType: string }): Promise<ParsedDocument>;
}
