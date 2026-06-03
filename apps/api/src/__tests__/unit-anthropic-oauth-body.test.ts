/**
 * Unit tests for the Claude Pro/Max OAuth body transforms.
 */
import { describe, it, expect } from 'bun:test';
import {
  applyClaudeCodeRequest,
  stripMcpPrefix,
  makeMcpStripTransform,
} from '../anthropic-oauth/body';

describe('applyClaudeCodeRequest', () => {
  it('prefixa tools com mcp_ e reescreve product name no system', () => {
    const input = {
      model: 'claude-sonnet-4-6',
      system: [{ type: 'text', text: 'You are OpenCode running opencode.' }],
      tools: [{ name: 'read' }, { name: 'bash' }],
      messages: [{ role: 'user', content: 'oi' }],
    };
    const out = applyClaudeCodeRequest(input) as any;
    expect(out.tools[0].name).toBe('mcp_read');
    expect(out.tools[1].name).toBe('mcp_bash');
    expect(out.system[0].text).toBe('You are Claude Code running Claude.');
    // não muta o input original
    expect((input.tools[0] as any).name).toBe('read');
  });

  it('prefixa tool_use dentro de mensagens', () => {
    const input = {
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', name: 'read', id: 'x' }] },
        { role: 'user', content: 'texto simples' },
      ],
    };
    const out = applyClaudeCodeRequest(input) as any;
    expect(out.messages[0].content[0].name).toBe('mcp_read');
    expect(out.messages[1].content).toBe('texto simples');
  });

  it('aceita system como string', () => {
    const out = applyClaudeCodeRequest({ model: 'm', system: 'OpenCode aqui', messages: [] }) as any;
    expect(out.system).toBe('Claude Code aqui');
  });
});

describe('stripMcpPrefix', () => {
  it('remove o prefixo mcp_ dos nomes de tool na resposta', () => {
    expect(stripMcpPrefix('{"type":"tool_use","name":"mcp_read"}')).toBe('{"type":"tool_use","name": "read"}');
  });

  it('round-trip: prefixar e depois strip devolve o nome original', () => {
    const body = applyClaudeCodeRequest({ model: 'm', tools: [{ name: 'grep' }], messages: [] });
    const stripped = stripMcpPrefix(JSON.stringify(body));
    expect(JSON.parse(stripped).tools[0].name).toBe('grep');
  });

  it('não toca nomes sem o prefixo', () => {
    expect(stripMcpPrefix('{"name":"read"}')).toBe('{"name":"read"}');
  });
});

describe('makeMcpStripTransform', () => {
  it('strips mcp_ de um stream de chunks', async () => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const src = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('data: {"name":"mcp_read"}\n'));
        controller.enqueue(enc.encode('data: {"name":"mcp_bash"}\n'));
        controller.close();
      },
    });
    const out = src.pipeThrough(makeMcpStripTransform());
    const reader = out.getReader();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
    expect(text).toContain('"name": "read"');
    expect(text).toContain('"name": "bash"');
    expect(text).not.toContain('mcp_');
  });
});
