/**
 * Text extraction + chunking for knowledge-base ingestion.
 * Supports: txt/md/csv/json (decode), PDF (unpdf). DOCX can be added via mammoth.
 */

const MAX_CHUNKS = 400; // guard against runaway uploads (logged when hit)

export async function extractFileText(
  buf: Uint8Array,
  mime: string,
  filename: string,
): Promise<string> {
  const lower = (filename || '').toLowerCase();
  const isPdf = mime.includes('pdf') || lower.endsWith('.pdf');
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n\n') : String(text || '');
  }
  // Plain text formats.
  return new TextDecoder('utf-8').decode(buf);
}

export interface Chunk {
  idx: number;
  content: string;
}

export function chunkText(
  text: string,
  opts: { size?: number; overlap?: number } = {},
): { chunks: Chunk[]; truncated: boolean } {
  const size = opts.size ?? 3500; // ~900 tokens
  const overlap = opts.overlap ?? 400;
  const clean = (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return { chunks: [], truncated: false };

  const chunks: Chunk[] = [];
  let i = 0;
  let idx = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    const content = clean.slice(i, end).trim();
    if (content) chunks.push({ idx: idx++, content });
    if (end >= clean.length) break;
    i = end - overlap;
    if (chunks.length >= MAX_CHUNKS) {
      return { chunks, truncated: true };
    }
  }
  return { chunks, truncated: false };
}
