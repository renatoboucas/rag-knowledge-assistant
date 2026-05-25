import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RetrievalEngine } from "@/lib/rag/services/retrieval-engine";
import type { RetrievalMode } from "@/lib/rag/types/retrieval";
import { evaluationScoring } from "./scoring-service";
import type { EvaluationCaseInput } from "./types";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function buildReferenceAnswer(input: {
  expectedAnswer?: string | null;
  contextText: string;
  citations: string[];
}) {
  if (input.expectedAnswer?.trim()) {
    return input.expectedAnswer;
  }

  const firstContextLine = input.contextText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 40);

  if (!firstContextLine) {
    return "There is not enough retrieved context to answer this benchmark case.";
  }

  const citation = input.citations[0] ? ` [${input.citations[0]}]` : "";
  return `${firstContextLine.slice(0, 700)}${citation}`;
}

export class EvaluationService {
  constructor(private readonly retrievalEngine?: RetrievalEngine) {}

  async listDatasets(organizationId: string) {
    return prisma.evaluationDataset.findMany({
      where: { organizationId, deletedAt: null },
      include: { cases: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createDataset(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    cases: EvaluationCaseInput[];
    metadata?: Record<string, unknown>;
  }) {
    return prisma.evaluationDataset.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        metadata: jsonValue(input.metadata),
        cases: {
          create: input.cases.map((item) => ({
            organizationId: input.organizationId,
            query: item.query,
            expectedAnswer: item.expectedAnswer,
            expectedCitationIds: jsonValue(item.expectedCitationIds ?? []),
            expectedDocuments: jsonValue(item.expectedDocuments ?? []),
            requiredKeywords: jsonValue(item.requiredKeywords ?? []),
            metadata: jsonValue(item.metadata),
          })),
        },
      },
      include: { cases: true },
    });
  }

  async listRuns(organizationId: string) {
    return prisma.evaluationRun.findMany({
      where: { organizationId },
      include: {
        dataset: { select: { id: true, name: true } },
        results: { orderBy: { overallScore: "asc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getRun(organizationId: string, runId: string) {
    return prisma.evaluationRun.findFirstOrThrow({
      where: { id: runId, organizationId },
      include: {
        dataset: true,
        results: { include: { evaluationCase: true }, orderBy: { overallScore: "asc" } },
      },
    });
  }

  async runBenchmark(input: {
    organizationId: string;
    datasetId: string;
    name?: string;
    retrievalMode?: RetrievalMode;
  }) {
    const dataset = await prisma.evaluationDataset.findFirstOrThrow({
      where: { id: input.datasetId, organizationId: input.organizationId, deletedAt: null },
      include: { cases: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    });
    const run = await prisma.evaluationRun.create({
      data: {
        organizationId: input.organizationId,
        datasetId: dataset.id,
        name: input.name ?? `${dataset.name} benchmark`,
        status: "RUNNING",
        retrievalMode: input.retrievalMode ?? "hybrid",
        startedAt: new Date(),
      },
    });

    try {
      const results = [];
      const retrievalEngine = this.retrievalEngine ?? new RetrievalEngine();

      for (const evaluationCase of dataset.cases) {
        const retrieval = await retrievalEngine.retrieve({
          organizationId: input.organizationId,
          query: evaluationCase.query,
          mode: input.retrievalMode ?? "hybrid",
          enableMultiQuery: true,
          enableQueryDecomposition: true,
        });
        const retrievedCitationIds = retrieval.citations.map((citation) => citation.id);
        const retrievedDocumentIds = retrieval.citations.map((citation) => citation.documentId);
        const answer = buildReferenceAnswer({
          expectedAnswer: evaluationCase.expectedAnswer,
          contextText: retrieval.contextText,
          citations: retrievedCitationIds,
        });
        const scores = evaluationScoring.score({
          answer,
          context: retrieval.contextText,
          expectedAnswer: evaluationCase.expectedAnswer,
          expectedCitationIds: stringArray(evaluationCase.expectedCitationIds),
          expectedDocuments: stringArray(evaluationCase.expectedDocuments),
          requiredKeywords: stringArray(evaluationCase.requiredKeywords),
          retrievedCitationIds,
          retrievedDocumentIds,
          retrievalEvaluation: retrieval.evaluation,
        });

        results.push(
          await prisma.evaluationResult.create({
            data: {
              organizationId: input.organizationId,
              runId: run.id,
              caseId: evaluationCase.id,
              query: evaluationCase.query,
              answer,
              retrievedCitationIds: jsonValue(retrievedCitationIds),
              retrievedDocumentIds: jsonValue(retrievedDocumentIds),
              context: retrieval.contextText,
              retrievalScore: scores.retrievalScore,
              hallucinationScore: scores.hallucinationScore,
              responseQualityScore: scores.responseQualityScore,
              overallScore: scores.overallScore,
              risk: scores.risk,
              issues: jsonValue(scores.issues),
              metadata: jsonValue(scores.metadata),
            },
          }),
        );
      }

      const aggregateScores = {
        cases: results.length,
        retrievalScore: average(results.map((result) => result.retrievalScore)),
        hallucinationScore: average(results.map((result) => result.hallucinationScore)),
        responseQualityScore: average(results.map((result) => result.responseQualityScore)),
        overallScore: average(results.map((result) => result.overallScore)),
        highRisk: results.filter((result) => result.risk === "high").length,
        mediumRisk: results.filter((result) => result.risk === "medium").length,
        lowRisk: results.filter((result) => result.risk === "low").length,
      };

      return prisma.evaluationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          aggregateScores: jsonValue(aggregateScores),
        },
        include: { dataset: true, results: true },
      });
    } catch (error) {
      await prisma.evaluationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          metadata: jsonValue({ error: error instanceof Error ? error.message : "Unknown error" }),
        },
      });
      throw error;
    }
  }
}

export const evaluationService = new EvaluationService();
