-- Single shared Claude Pro/Max OAuth credential for the WHOLE instance.
-- Captured once by an admin (browser OAuth, no API key); the backend refreshes
-- it centrally (single-flight) and the sandboxes never see the refresh token —
-- they route Claude calls through the backend router which attaches the bearer.
-- One row, id = 'default'. Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS kortix.platform_anthropic_oauth (
  id          text PRIMARY KEY DEFAULT 'default',
  access      text NOT NULL,
  refresh     text NOT NULL,
  expires     bigint NOT NULL,          -- epoch ms when the access token expires (with skew)
  updated_at  timestamptz NOT NULL DEFAULT now()
);
