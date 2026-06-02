-- Per-document × per-agent access for the knowledge base. A document is visible
-- to an agent's knowledge_search only if a row exists here. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS kortix.knowledge_document_access (
  account_id  uuid NOT NULL,
  doc_id      uuid NOT NULL REFERENCES kortix.knowledge_documents (doc_id) ON DELETE CASCADE,
  agent_name  varchar(128) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, doc_id, agent_name)
);
CREATE INDEX IF NOT EXISTS idx_kb_doc_access_agent ON kortix.knowledge_document_access (account_id, agent_name);
