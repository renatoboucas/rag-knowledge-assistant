import { calculatorTool } from "@/lib/agents/tools/calculator-tool";
import { fileAnalysisTool } from "@/lib/agents/tools/file-analysis-tool";
import { createKnowledgeRetrievalTool } from "@/lib/agents/tools/knowledge-retrieval-tool";
import { ToolRegistry } from "@/lib/agents/tools/tool-registry";
import { webSearchTool } from "@/lib/agents/tools/web-search-tool";

export function createDefaultToolRegistry() {
  return new ToolRegistry()
    .register(calculatorTool)
    .register(createKnowledgeRetrievalTool())
    .register(webSearchTool)
    .register(fileAnalysisTool);
}
