-- RAG knowledge base (account-scoped) — pgvector + OpenAI embeddings.
-- Run this in the Supabase SQL Editor (DDL on the shared DB is applied by the operator).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kortix.knowledge_documents (
  doc_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL,
  title        varchar(512) NOT NULL,
  source       varchar(512),
  mime         varchar(128),
  bytes        bigint,
  status       varchar(32) NOT NULL DEFAULT 'pending',
  error        text,
  chunk_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_docs_account ON kortix.knowledge_documents (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kortix.knowledge_chunks (
  chunk_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid NOT NULL REFERENCES kortix.knowledge_documents (doc_id) ON DELETE CASCADE,
  account_id  uuid NOT NULL,
  idx         integer NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_account ON kortix.knowledge_chunks (account_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kortix.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS kortix.knowledge_agent_access (
  account_id  uuid NOT NULL,
  agent_name  varchar(128) NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, agent_name)
);
