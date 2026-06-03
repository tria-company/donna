-- Pastas para organizar sessões, por conta. As sessões vivem no opencode (sem
-- campo "pasta"), então o vínculo sessão→pasta é guardado aqui.
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS kortix.session_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_folders_account ON kortix.session_folders (account_id);

-- Vínculo sessão→pasta (uma sessão em no máximo uma pasta por conta).
CREATE TABLE IF NOT EXISTS kortix.session_folder_items (
  account_id  uuid NOT NULL,
  session_id  text NOT NULL,
  folder_id   uuid NOT NULL REFERENCES kortix.session_folders(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_session_folder_items_folder ON kortix.session_folder_items (folder_id);
