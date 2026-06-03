-- Skills favoritadas por conta. Cada usuário (conta) marca skills favoritas
-- pelo nome (estável dentro do workspace opencode da conta). Persistente entre
-- dispositivos e sobrevive ao re-provisionamento do sandbox.
-- Rodar no SQL Editor do Supabase (banco compartilhado).

CREATE TABLE IF NOT EXISTS kortix.skill_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  skill_name  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_favorites_account_name
  ON kortix.skill_favorites (account_id, skill_name);

CREATE INDEX IF NOT EXISTS idx_skill_favorites_account
  ON kortix.skill_favorites (account_id);
