-- Conectores Composio habilitados por conta (MCP servers injetados no opencode).
-- Guarda nome + URL da MCP de cada app habilitado, pra reinjetar quando um sandbox
-- é provisionado (durabilidade). Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS kortix.composio_mcp_servers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL,
  name          text NOT NULL,          -- nome no opencode mcp map (ex: composio-clickup)
  url           text NOT NULL,          -- mcp_url do Composio
  toolkit_slug  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_composio_mcp_account_name
  ON kortix.composio_mcp_servers (account_id, name);
CREATE INDEX IF NOT EXISTS idx_composio_mcp_account
  ON kortix.composio_mcp_servers (account_id);
