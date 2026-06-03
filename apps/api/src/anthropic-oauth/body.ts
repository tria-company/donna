/**
 * Request/response transforms that make a standard Anthropic Messages request
 * acceptable to the Claude Pro/Max subscription OAuth endpoint, mirroring
 * opencode's anthropic auth plugin (auth.ts patchBody + response strip).
 *
 * On the way OUT: namespace custom tools with `mcp_` and rewrite product name.
 * On the way BACK: strip the `mcp_` prefix so the caller sees its original tool
 * names (opencode's @ai-sdk/anthropic expects the names it sent).
 */
import { ANTHROPIC_TOOL_PREFIX } from './constants';

function patchText(value: string): string {
  return value.replace(/OpenCode/g, 'Claude Code').replace(/opencode/gi, 'Claude');
}

type TextBlock = { type?: string; text?: string };
type ToolUseBlock = { type?: string; name?: string };
type Message = { content?: unknown };

/**
 * Apply Claude Code request transforms to a parsed Anthropic Messages body.
 * Returns a new body object (does not mutate the input).
 */
export function applyClaudeCodeRequest(input: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...input };

  if (Array.isArray(body.system)) {
    body.system = (body.system as TextBlock[]).map((item) =>
      item?.type === 'text' && item.text ? { ...item, text: patchText(item.text) } : item,
    );
  } else if (typeof body.system === 'string') {
    body.system = patchText(body.system);
  }

  if (Array.isArray(body.tools)) {
    body.tools = (body.tools as ToolUseBlock[]).map((item) => ({
      ...item,
      name: item?.name ? `${ANTHROPIC_TOOL_PREFIX}${item.name}` : item?.name,
    }));
  }

  if (Array.isArray(body.messages)) {
    body.messages = (body.messages as Message[]).map((msg) => {
      if (!Array.isArray(msg?.content)) return msg;
      return {
        ...msg,
        content: (msg.content as ToolUseBlock[]).map((block) =>
          block?.type === 'tool_use' && block.name
            ? { ...block, name: `${ANTHROPIC_TOOL_PREFIX}${block.name}` }
            : block,
        ),
      };
    });
  }

  return body;
}

/**
 * Strip the `mcp_` tool-name prefix from a response chunk (SSE text or JSON
 * string), so callers see the tool names they originally sent. Same regex the
 * opencode plugin uses on the streamed response.
 */
export function stripMcpPrefix(text: string): string {
  return text.replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"');
}

/**
 * A TransformStream that strips the `mcp_` tool-name prefix from a streamed
 * (SSE) Anthropic response, chunk by chunk. Mirrors the opencode plugin's
 * per-chunk rewrite.
 */
export function makeMcpStripTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      controller.enqueue(encoder.encode(stripMcpPrefix(text)));
    },
  });
}
