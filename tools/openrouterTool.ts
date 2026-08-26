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
  hasEnvKey: boolean;
  models?: Array<{ id: string; name: string; context_length?: number }>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MCP_ENDPOINT = 'https://mcp.openrouter.ai/mcp';
const API_BASE = 'https://openrouter.ai/api/v1';

/**
 * Extracts OPENROUTER_API_KEY from process.env or .env file
 */
export function getOpenRouterApiKey(customKey?: string): string {
  if (customKey && customKey.trim()) return customKey.trim();
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    return process.env.OPENROUTER_API_KEY.trim();
  }

  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
          const val = trimmed.substring('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
          if (val) return val;
        }
      }
    }
  } catch (_e) {
    // Ignore error
  }
  return '';
}

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
 * Saves/updates the agent's constitution in skills/constituicao.md
 */
export function saveAgentConstitution(content: string): boolean {
  try {
    const skillPath = path.resolve(__dirname, '..', 'skills', 'constituicao.md');
    fs.writeFileSync(skillPath, content, 'utf-8');
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Tests connection to the OpenRouter MCP server at https://mcp.openrouter.ai/mcp
 */
export async function testOpenRouterMcp(apiKey?: string): Promise<OpenRouterTestResult> {
  const token = getOpenRouterApiKey(apiKey);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://corpsa-crm.local',
      'X-Title': 'CORPSA CRM AI Agent Sandbox'
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
          name: 'corpsa-crm-agent-sandbox',
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

    let models: Array<{ id: string; name: string }> = [];
    try {
      const modelsRes = await fetch(`${API_BASE}/models`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (modelsRes.ok) {
        const data: any = await modelsRes.json();
        if (Array.isArray(data.data)) {
          models = data.data
            .filter((m: any) => m.id.includes('gemini') || m.id.includes('claude') || m.id.includes('llama') || m.id.includes('gpt-4o') || m.id.includes('deepseek'))
            .slice(0, 40)
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
              context_length: m.context_length
            }));
        }
      }
    } catch (_e) {
      // Fallback
    }

    const isAuthenticated = mcpRes.ok && Boolean(token);

    return {
      connected: true,
      mcpEndpoint: MCP_ENDPOINT,
      mcpStatus: mcpRes.status,
      mcpResponse: mcpJson,
      modelsAvailable: models.length,
      hasEnvKey: Boolean(token),
      authenticated: isAuthenticated,
      models,
      message: isAuthenticated
        ? 'Conexão OpenRouter MCP autenticada com sucesso com sua chave API!'
        : token
        ? 'Chave API detectada. Endpoint MCP respondendo normalmente.'
        : 'Endpoint MCP OpenRouter acessível. Insira sua chave API no arquivo .env ou no painel para chamadas ao vivo.'
    };
  } catch (err: any) {
    return {
      connected: false,
      mcpEndpoint: MCP_ENDPOINT,
      mcpStatus: 0,
      hasEnvKey: Boolean(token),
      authenticated: false,
      message: `Erro ao conectar com OpenRouter MCP: ${err.message}`
    };
  }
}

/**
 * Sends a chat message to OpenRouter Gemini 3.7 in sandbox environment
 */
export async function chatWithOpenRouter(
  messages: ChatMessage[],
  model: string = 'google/gemini-3.7-flash',
  apiKey?: string,
  temperature: number = 0.7,
  customConstitution?: string
): Promise<{ text: string; model: string; usage?: any; latencyMs: number }> {
  const token = getOpenRouterApiKey(apiKey);
  if (!token) {
    throw new Error('Chave de API do OpenRouter não encontrada. Adicione OPENROUTER_API_KEY no arquivo .env ou informe no painel do Sandbox.');
  }

  const constitution = customConstitution !== undefined ? customConstitution : getAgentConstitution();
  const fullMessages: ChatMessage[] = [];

  if (constitution && constitution.trim()) {
    fullMessages.push({
      role: 'system',
      content: `[CONSTITUIÇÃO E DIRETRIZES DO AGENTE (CORPSA CRM)]:\n${constitution.trim()}`
    });
  } else {
    fullMessages.push({
      role: 'system',
      content: 'Você é o Agente de IA do CORPSA CRM em modo Sandbox de teste. Seu objetivo é prestar atendimento imobiliário, triagem de crédito e orientações no CRM com cordialidade e precisão técnica.'
    });
  }

  fullMessages.push(...messages);

  const startTime = Date.now();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'HTTP-Referer': 'https://corpsa-crm.local',
      'X-Title': 'CORPSA CRM AI Agent Sandbox'
    },
    body: JSON.stringify({
      model: model || 'google/gemini-3.7-flash',
      messages: fullMessages,
      temperature
    })
  });

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errText = await res.text();
    let errJson: any;
    try { errJson = JSON.parse(errText); } catch {}
    const msg = errJson?.error?.message || errText || `Erro HTTP ${res.status}`;
    throw new Error(`OpenRouter API error: ${msg}`);
  }

  const data: any = await res.json();
  const choice = data.choices?.[0];
  const replyText = choice?.message?.content || 'Sem resposta retornada pelo modelo.';

  return {
    text: replyText,
    model: data.model || model,
    usage: data.usage,
    latencyMs
  };
}
