import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OpenRouterTestResult {
  connected: boolean;
  mcpEndpoint: string;
  mcpStatus: number;
  mcpResponse?: any;
  modelsAvailable?: number;
  authenticated: boolean;
  message: string;
  models?: Array<{ id: string; name: string; context_length?: number }>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MCP_ENDPOINT = 'https://mcp.openrouter.ai/mcp';
const API_BASE = 'https://openrouter.ai/api/v1';

/**
 * Reads the agent's constitution from skills/constituicao.md
 */
export function getAgentConstitution(): string {
  try {
    const skillPath = path.resolve(__dirname, '..', 'skills', 'constituicao.md');
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, 'utf-8').trim();
    }
  } catch (_e) {
    // Ignore error
  }
  return '';
}

/**
 * Tests connection to the OpenRouter MCP server at https://mcp.openrouter.ai/mcp
 */
export async function testOpenRouterMcp(apiKey?: string): Promise<OpenRouterTestResult> {
  const token = apiKey || process.env.OPENROUTER_API_KEY || '';

  try {
    // Step 1: Send JSON-RPC initialize handshake to https://mcp.openrouter.ai/mcp
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://corpsa-crm.local',
      'X-Title': 'CORPSA CRM AI Agent'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const rpcPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'corpsa-crm-agent',
          version: '1.0.0'
        }
      }
    };

    const mcpRes = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcPayload)
    });

    let mcpJson: any = null;
    try {
      mcpJson = await mcpRes.json();
    } catch (_e) {
      mcpJson = { raw: await mcpRes.text() };
    }

    // Step 2: Fetch models list from OpenRouter API to verify model availability
    let models: Array<{ id: string; name: string }> = [];
    try {
      const modelsRes = await fetch(`${API_BASE}/models`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (modelsRes.ok) {
        const data: any = await modelsRes.json();
        if (Array.isArray(data.data)) {
          models = data.data.slice(0, 30).map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            context_length: m.context_length
          }));
        }
      }
    } catch (_e) {
      // Fallback
    }

    const isAuthenticated = mcpRes.status === 200 || (mcpJson && !mcpJson.error && mcpRes.status !== 401);

    if (mcpRes.status === 401) {
      return {
        connected: true,
        mcpEndpoint: MCP_ENDPOINT,
        mcpStatus: mcpRes.status,
        mcpResponse: mcpJson,
        modelsAvailable: models.length,
        authenticated: false,
        models,
        message: 'Endpoint MCP OpenRouter acessível com sucesso! Para autenticar requisições de chat, insira sua API Key do OpenRouter.'
      };
    }

    return {
      connected: mcpRes.ok,
      mcpEndpoint: MCP_ENDPOINT,
      mcpStatus: mcpRes.status,
      mcpResponse: mcpJson,
      modelsAvailable: models.length,
      authenticated: isAuthenticated,
      models,
      message: mcpRes.ok 
        ? 'Conexão com OpenRouter MCP estabelecida e autenticada com sucesso!' 
        : `Servidor OpenRouter respondeu com status ${mcpRes.status}.`
    };
  } catch (err: any) {
    return {
      connected: false,
      mcpEndpoint: MCP_ENDPOINT,
      mcpStatus: 0,
      authenticated: false,
      message: `Erro ao conectar com OpenRouter MCP: ${err.message}`
    };
  }
}

/**
 * Sends a chat message to OpenRouter using selected model and injecting skills/constituicao.md
 */
export async function chatWithOpenRouter(
  messages: ChatMessage[],
  model: string = 'google/gemini-2.0-flash-001',
  apiKey?: string
): Promise<{ text: string; model: string; usage?: any }> {
  const token = apiKey || process.env.OPENROUTER_API_KEY || '';
  if (!token) {
    throw new Error('Chave de API do OpenRouter não fornecida. Insira sua chave no campo de configuração ou no arquivo .env');
  }

  const constitution = getAgentConstitution();
  const fullMessages: ChatMessage[] = [];

  if (constitution) {
    fullMessages.push({
      role: 'system',
      content: `[CONSTITUIÇÃO E DIRETRIZES DO AGENTE]:\n${constitution}`
    });
  }

  fullMessages.push(...messages);

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'HTTP-Referer': 'https://corpsa-crm.local',
      'X-Title': 'CORPSA CRM AI Agent'
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    let errJson: any;
    try { errJson = JSON.parse(errText); } catch {}
    const msg = errJson?.error?.message || errText || `Erro HTTP ${res.status}`;
    throw new Error(`OpenRouter API error: ${msg}`);
  }

  const data: any = await res.json();
  const choice = data.choices?.[0];
  const replyText = choice?.message?.content || 'Sem resposta gerada pelo modelo.';

  return {
    text: replyText,
    model: data.model || model,
    usage: data.usage
  };
}
