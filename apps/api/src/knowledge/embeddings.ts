/**
 * OpenAI embeddings for the RAG knowledge base.
 * Uses config.OPENAI_API_KEY / OPENAI_API_URL (text-embedding-3-small, 1536 dims).
 * Plain fetch — no SDK dependency. NOT tied to the agent LLM (any model still works).
 */
import { config } from '../config';

export const EMBED_MODEL = 'text-embedding-3-small';
export const EMBED_DIMS = 1536;
const BATCH = 64;

export function embeddingsConfigured(): boolean {
  return !!config.OPENAI_API_KEY;
}

async function embedBatch(input: string[]): Promise<number[][]> {
  const res = await fetch(`${config.OPENAI_API_URL.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // Preserve order by `index`.
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set — set it in apps/api/.env');
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await embedBatch(texts.slice(i, i + BATCH))));
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

/** pgvector literal: '[0.1,0.2,...]' */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
