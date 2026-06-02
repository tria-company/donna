-- Per-account durable seed of the sandbox's user-created opencode project
-- (.opencode/{agent,command,skills} + prompts + AGENTS.md), stored as a base64
-- tar.gz blob. Captured (debounced) while a sandbox is active and restored
-- automatically into any freshly provisioned sandbox, so custom agents/skills/
-- commands survive sandbox re-provisioning. Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS kortix.account_workspace_seed (
  account_id   uuid PRIMARY KEY,
  archive_b64  text NOT NULL,
  byte_size    integer NOT NULL DEFAULT 0,
  file_count   integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
