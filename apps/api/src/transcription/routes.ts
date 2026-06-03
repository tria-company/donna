/**
 * Transcrição de áudio (speech-to-text) via OpenAI.
 *
 *   POST /v1/transcription   — multipart (campo `audio_file`) → { text }
 *
 * Usa config.OPENAI_API_KEY / OPENAI_API_URL (mesma chave dos embeddings do RAG).
 * Modelo padrão whisper-1 (configurável via OPENAI_TRANSCRIBE_MODEL). Plain fetch.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabaseAuth } from '../middleware/auth';
import { config } from '../config';

export function createTranscriptionRouter(): Hono {
  const router = new Hono();
  router.use('/*', supabaseAuth);

  router.post('/', async (c) => {
    if (!config.OPENAI_API_KEY) {
      throw new HTTPException(503, { message: 'OPENAI_API_KEY não configurado no servidor.' });
    }
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('audio_file');
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'Envie o áudio no campo "audio_file".' });
    }

    const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
    const upstream = new FormData();
    upstream.append('file', file, file.name || 'audio.webm');
    upstream.append('model', model);
    upstream.append('language', 'pt'); // UI/áudio em PT-BR — melhora a precisão
    upstream.append('response_format', 'json');

    let res: Response;
    try {
      res = await fetch(`${config.OPENAI_API_URL.replace(/\/$/, '')}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
        body: upstream,
      });
    } catch (err) {
      throw new HTTPException(502, { message: `Falha ao chamar a OpenAI: ${err instanceof Error ? err.message : String(err)}` });
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new HTTPException(502, { message: `OpenAI transcription ${res.status}: ${t.slice(0, 200)}` });
    }
    const data = (await res.json()) as { text?: string };
    return c.json({ text: data.text ?? '' });
  });

  return router;
}
