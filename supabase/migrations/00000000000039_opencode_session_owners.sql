-- Dono (por conta) de cada sessão do opencode, rastreado na CAMADA DO BACKEND
-- (proxy), independente da versão/imagem do sandbox. O proxy carimba o dono ao
-- criar a sessão e filtra a lista de sessões pra que cada usuário só veja as
-- próprias conversas. Sessões sem linha aqui são "legacy" (criadas antes deste
-- filtro) e ficam visíveis só pra admin de plataforma.
-- Rode no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS kortix.opencode_session_owner (
  session_id  text PRIMARY KEY,
  account_id  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opencode_session_owner_account
  ON kortix.opencode_session_owner (account_id);

GRANT ALL ON kortix.opencode_session_owner TO service_role;
