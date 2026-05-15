import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/rag_knowledge_assistant?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function vector(dimensions = 1536) {
  return `[${Array.from({ length: dimensions }, (_, index) => {
    const value = ((index % 17) + 1) / 100;
    return value.toFixed(4);
  }).join(",")}]`;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { clerkId: "seed_user_rag_admin" },
    update: {
      email: "admin@example.com",
      firstName: "RAG",
      lastName: "Admin",
    },
    create: {
      clerkId: "seed_user_rag_admin",
      email: "admin@example.com",
      firstName: "RAG",
      lastName: "Admin",
    },
  });

  const organization = await prisma.organization.upsert({
    where: { clerkId: "seed_org_rag_workspace" },
    update: {
      name: "Seed Knowledge Workspace",
      slug: "seed-knowledge-workspace",
    },
    create: {
      clerkId: "seed_org_rag_workspace",
      name: "Seed Knowledge Workspace",
      slug: "seed-knowledge-workspace",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {
      clerkRole: "org:admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      clerkRole: "org:admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const document = await prisma.document.create({
    data: {
      organizationId: organization.id,
      createdById: user.id,
      title: "RAG Architecture Seed Document",
      sourceType: "API",
      sourceUri: "seed://rag-architecture",
      mimeType: "text/plain",
      checksum: "seed-rag-architecture-v1",
      status: "INDEXED",
      tokenCount: 42,
      chunkCount: 1,
      metadata: {
        environment: "seed",
        purpose: "database architecture smoke test",
      },
    },
  });

  const chunk = await prisma.documentChunk.create({
    data: {
      organizationId: organization.id,
      documentId: document.id,
      content:
        "RAG infrastructure stores tenant-scoped documents, chunks, embeddings, conversations, prompts, and retrieval telemetry.",
      contentHash: "seed-rag-architecture-chunk-1",
      chunkIndex: 0,
      tokenCount: 18,
      metadata: {
        section: "architecture",
      },
    },
  });

  await prisma.$executeRaw`
    INSERT INTO embeddings (
      id,
      organization_id,
      chunk_id,
      provider,
      model,
      dimensions,
      vector,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid()::text,
      ${organization.id},
      ${chunk.id},
      'seed',
      'text-embedding-3-small',
      1536,
      ${vector()}::vector,
      '{"purpose":"seed similarity search"}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (chunk_id, provider, model)
    DO UPDATE SET
      vector = EXCLUDED.vector,
      metadata = EXCLUDED.metadata,
      deleted_at = NULL,
      updated_at = now()
  `;

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: organization.id,
      title: "Seed RAG Conversation",
      metadata: { seeded: true },
    },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: organization.id,
        conversationId: conversation.id,
        userId: user.id,
        role: "USER",
        content: "What does this workspace store?",
        tokenCount: 7,
      },
      {
        organizationId: organization.id,
        conversationId: conversation.id,
        role: "ASSISTANT",
        content:
          "It stores tenant-isolated RAG documents, embeddings, conversations, prompts, and retrieval logs.",
        tokenCount: 13,
      },
    ],
  });

  await prisma.prompt.upsert({
    where: {
      organizationId_key_version: {
        organizationId: organization.id,
        key: "default-rag-answer",
        version: 1,
      },
    },
    update: {
      status: "ACTIVE",
      template: "Answer using only the retrieved context. Cite source chunks when available.",
    },
    create: {
      organizationId: organization.id,
      createdById: user.id,
      name: "Default RAG Answer",
      key: "default-rag-answer",
      version: 1,
      status: "ACTIVE",
      template: "Answer using only the retrieved context. Cite source chunks when available.",
    },
  });

  console.log({
    organization: organization.id,
    user: user.id,
    document: document.id,
    chunk: chunk.id,
    conversation: conversation.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
