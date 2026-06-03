/**
 * Claude Pro/Max OAuth constants.
 *
 * Mirrors the values opencode's anthropic auth plugin uses
 * (core/kortix-master/opencode/plugin/kortix-system/auth.ts) so the backend can
 * hold ONE shared subscription credential for the whole instance and emulate the
 * Claude Code client that Anthropic's subscription OAuth expects.
 */

export const ANTHROPIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
export const ANTHROPIC_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
export const ANTHROPIC_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

export const ANTHROPIC_AUTH_USER_AGENT = 'claude-code/2.1.76';
export const ANTHROPIC_TOKEN_USER_AGENT = 'axios/1.13.6';

// Refresh a bit before the real expiry so in-flight requests don't race a 401.
export const ANTHROPIC_EXPIRES_SKEW_MS = 5 * 60 * 1000;
export const ANTHROPIC_OAUTH_TOKEN_LIFETIME_SECONDS = 31536000;

// Custom tools are namespaced with this prefix so the subscription OAuth treats
// them as MCP tools (the un-prefixing happens on the response).
export const ANTHROPIC_TOOL_PREFIX = 'mcp_';

export const ANTHROPIC_MAX_SCOPE = 'user:inference';

export const ANTHROPIC_REQUIRED_BETAS = [
  'oauth-2025-04-20',
  'interleaved-thinking-2025-05-14',
  'fine-grained-tool-streaming-2025-05-14',
];

/** Merge the required Claude Code betas with any the caller already sent. */
export function anthropicBetas(input = ''): string {
  return [
    ...new Set([
      ...ANTHROPIC_REQUIRED_BETAS,
      ...input.split(',').map((s) => s.trim()).filter(Boolean),
    ]),
  ].join(',');
}
