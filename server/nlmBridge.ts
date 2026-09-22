import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NlmStatusResult {
  installed: boolean;
  authenticated: boolean;
  message: string;
  notebookId?: string;
  notebooksCount?: number;
}

export interface FileItem {
  path: string;
  originalname?: string;
  filename?: string;
  mimetype?: string;
}

export interface AnalysisInput {
  files?: FileItem[];
  regrasConsiderar?: string;
  regrasDesconsiderar?: string;
  notebookId?: string;
}

export interface IncomeAuditResult {
  rendaFormal: number;
  rendaInformal: number;
  rendaBruta: number;
  descontosDesconsiderados: number;
  rendaLiquida: number;
  capacidadePagamento: number;
  parecer: string;
  notebookId?: string;
  sourcesAdded?: number;
  sourcesRemoved?: number;
  rawResponse?: string;
}

export interface ChatQueryInput {
  notebookId?: string;
  message: string;
  prompt?: string;
  regrasConsiderar?: string;
  regrasDesconsiderar?: string;
  currentMetrics?: {
    rendaFormal?: number;
    rendaInformal?: number;
    rendaBruta?: number;
    descontosDesconsiderados?: number;
    rendaLiquida?: number;
    capacidadePagamento?: number;
  };
  files?: FileItem[];
}

export interface ChatQueryResult {
  success: boolean;
  reply: string;
  parecer: string;
  metrics: {
    rendaFormal: number;
    rendaInformal: number;
    rendaBruta: number;
    descontosDesconsiderados: number;
    rendaLiquida: number;
    capacidadePagamento: number;
  };
  notebookId?: string;
  rawResponse?: string;
  rawOutput?: string;
}

export interface AddSourceResult {
  success: boolean;
  sourceId?: string;
  title?: string;
  error?: string;
}

export interface CleanAndAddResult {
  success: boolean;
  notebookId: string;
  sourcesRemoved: number;
  sourcesAdded: number;
  removedIds?: string[];
  addedDetails?: Array<{ title?: string; sourceId?: string; success: boolean }>;
  errors?: string[];
}

export const DEFAULT_NOTEBOOK_ID = 'af25c93d-d48c-4cba-a2f2-5991dcbbbc57';

/**
 * Extrai o UUID do Notebook a partir de um ID ou URL completa do NotebookLM
 * Ex: https://notebook.google.com/notebook/af25c93d-d48c-4cba-a2f2-5991dcbbbc57 -> af25c93d-d48c-4cba-a2f2-5991dcbbbc57
 */
export function extractNotebookId(idOrUrl?: string): string {
  if (!idOrUrl || !idOrUrl.trim()) return '';
  const trimmed = idOrUrl.trim();
  const uuidMatch = trimmed.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (uuidMatch) {
    return uuidMatch[0];
  }
  return trimmed;
}

export function getNlmCmd(): string {
  if (process.env.NLM_CMD && process.env.NLM_CMD.trim()) {
    return process.env.NLM_CMD.trim();
  }
  if (process.env.NLM_PATH && process.env.NLM_PATH.trim()) {
    const p = process.env.NLM_PATH.trim();
    return p.includes(' ') && !p.startsWith('"') ? `"${p}"` : p;
  }
  const customPaths = [
    'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\nlm.exe',
    'C:\\Users\\User\\.local\\bin\\nlm.exe'
  ];
  for (const p of customPaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }
  return 'nlm';
}

export function getEnvNotebookId(): string {
  if (process.env.NOTEBOOKLM_NOTEBOOK_ID && process.env.NOTEBOOKLM_NOTEBOOK_ID.trim()) {
    return extractNotebookId(process.env.NOTEBOOKLM_NOTEBOOK_ID);
  }

  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('NOTEBOOKLM_NOTEBOOK_ID=')) {
          const val = trimmed.substring('NOTEBOOKLM_NOTEBOOK_ID='.length).trim().replace(/^["']|["']$/g, '');
          if (val) return extractNotebookId(val);
        }
      }
    }
  } catch (_e) {
    // Ignore error
  }
  return DEFAULT_NOTEBOOK_ID;
}

/**
 * Executa comandos no CLI com timeout e buffer configurados
 */
export function runCommand(commandStr: string, timeoutMs: number = 180000): Promise<{ stdout: string; stderr: string; code: number }> {
  const finalCmd = commandStr.startsWith('nlm ') 
    ? commandStr.replace(/^nlm\s+/, `${getNlmCmd()} `)
    : commandStr;

  return new Promise((resolve) => {
    exec(finalCmd, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof error.code === 'number' ? error.code : (error ? 1 : 0);
      resolve({
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : '',
        code
      });
    });
  });
}

/**
 * Verifica se o `nlm` CLI está instalado e autenticado
 */
export async function getNlmStatus(): Promise<NlmStatusResult> {
  const configuredId = getEnvNotebookId();
  const result = await runCommand('nlm notebook list --json');
  const combined = (result.stdout + ' ' + result.stderr).toLowerCase();
  
  if (
    combined.includes('authentication error') ||
    combined.includes('authentication expired') ||
    combined.includes('run nlm login') ||
    combined.includes("profile 'default' not found") ||
    combined.includes('nlm login')
  ) {
    return {
      installed: true,
      authenticated: false,
      notebookId: configuredId,
      message: "Autenticação necessária ou expirada. Execute 'nlm login' no terminal para conectar ao NotebookLM."
    };
  }

  if (
    combined.includes("is not recognized") ||
    combined.includes("command not found") ||
    combined.includes("não é reconhecido")
  ) {
    return {
      installed: false,
      authenticated: false,
      notebookId: configuredId,
      message: "notebooklm-mcp-cli (nlm) não encontrado no sistema."
    };
  }

  try {
    const data = JSON.parse(result.stdout);
    const count = Array.isArray(data) ? data.length : (data.notebooks && Array.isArray(data.notebooks) ? data.notebooks.length : 0);
    return {
      installed: true,
      authenticated: true,
      notebookId: configuredId,
      message: `NotebookLM CLI pronto e autenticado. Notebook ID ativo: ${configuredId}`,
      notebooksCount: count
    };
  } catch (_e) {
    if (result.code === 0) {
      return {
        installed: true,
        authenticated: true,
        notebookId: configuredId,
        message: `NotebookLM CLI pronto. Notebook ID ativo: ${configuredId}`
      };
    }
    return {
      installed: true,
      authenticated: false,
      notebookId: configuredId,
      message: result.stderr || "Falha ao comunicar com o CLI do NotebookLM."
    };
  }
}

/**
 * Lista as fontes atuais do caderno
 */
export async function listSources(notebookId?: string): Promise<Array<{ id: string; title: string; type?: string }>> {
  const targetId = extractNotebookId(notebookId) || getEnvNotebookId();
  const res = await runCommand(`nlm source list "${targetId}" --json`);
  
  const combined = ((res.stdout || '') + ' ' + (res.stderr || '')).toLowerCase();
  if (
    combined.includes('authentication error') ||
    combined.includes('authentication expired') ||
    combined.includes('nlm login') ||
    combined.includes('authentication') ||
    combined.includes('unauthenticated') ||
    combined.includes('auth required') ||
    combined.includes("profile 'default' not found") ||
    combined.includes('autentica')
  ) {
    const err = new Error("AUTH_REQUIRED: Autenticação expirada no NotebookLM. Execute 'nlm login' no terminal.");
    (err as any).statusCode = 401;
    throw err;
  }

  if (
    combined.includes('is not recognized') ||
    combined.includes('command not found') ||
    combined.includes('não é reconhecido')
  ) {
    const err = new Error("CLI_NOT_FOUND: O utilitário 'notebooklm-mcp-cli' (nlm) não foi encontrado no sistema.");
    (err as any).statusCode = 500;
    throw err;
  }

  if (res.code !== 0) {
    throw new Error(`Falha ao listar fontes no NotebookLM: ${res.stderr || res.stdout || 'Erro desconhecido'}`);
  }

  try {
    const parsed = JSON.parse(res.stdout);
    const rawList = Array.isArray(parsed) ? parsed : (parsed.sources || []);
    return rawList.map((s: any) => ({
      id: s.id || s.source_id || '',
      title: s.title || s.name || 'Documento sem título',
      type: s.source_type || s.source_type_name || 'file'
    })).filter((s: any) => s.id);
  } catch (_e) {
    return [];
  }
}

/**
 * Exclui fontes em lote por ID
 */
export async function deleteSources(sourceIds: string[]): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const validIds = sourceIds.filter(id => typeof id === 'string' && id.trim().length > 0);
  if (validIds.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const deleteCmd = `nlm source delete ${validIds.map(id => `"${id}"`).join(' ')} --confirm --json`;
  const res = await runCommand(deleteCmd);

  const combined = ((res.stdout || '') + ' ' + (res.stderr || '')).toLowerCase();
  if (
    combined.includes('authentication error') ||
    combined.includes('authentication expired') ||
    combined.includes('nlm login') ||
    combined.includes('authentication') ||
    combined.includes('unauthenticated') ||
    combined.includes('auth required') ||
    combined.includes("profile 'default' not found") ||
    combined.includes('autentica')
  ) {
    const err = new Error("AUTH_REQUIRED: Autenticação expirada no NotebookLM. Execute 'nlm login' no terminal.");
    (err as any).statusCode = 401;
    throw err;
  }

  if (
    combined.includes('is not recognized') ||
    combined.includes('command not found') ||
    combined.includes('não é reconhecido')
  ) {
    const err = new Error("CLI_NOT_FOUND: O utilitário 'notebooklm-mcp-cli' (nlm) não foi encontrado no sistema.");
    (err as any).statusCode = 500;
    throw err;
  }

  if (res.code !== 0) {
    throw new Error(`Falha ao excluir fontes no NotebookLM: ${res.stderr || res.stdout || 'Erro desconhecido'}`);
  }

  return {
    deletedCount: validIds.length,
    deletedIds: validIds
  };
}

/**
 * Limpa todas as fontes existentes no caderno
 */
export async function cleanSources(notebookId?: string): Promise<{ removedCount: number; removedIds: string[] }> {
  const targetId = extractNotebookId(notebookId) || getEnvNotebookId();
  const existing = await listSources(targetId);
  if (existing.length === 0) {
    return { removedCount: 0, removedIds: [] };
  }

  const ids = existing.map(s => s.id);
  const deleteResult = await deleteSources(ids);
  return {
    removedCount: deleteResult.deletedCount,
    removedIds: deleteResult.deletedIds
  };
}

/**
 * Adiciona um arquivo individual como fonte no caderno
 */
export async function addSourceFile(notebookId: string, filePath: string, title?: string): Promise<AddSourceResult> {
  const targetId = extractNotebookId(notebookId) || getEnvNotebookId();
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: `Arquivo não encontrado no disco: ${filePath}` };
  }

  const sanitizedPath = path.resolve(filePath).replace(/"/g, '\\"');
  let cmd = `nlm source add "${targetId}" --file "${sanitizedPath}" --wait --json`;
  if (title && title.trim()) {
    const sanitizedTitle = title.trim().replace(/"/g, '\\"');
    cmd += ` --title "${sanitizedTitle}"`;
  }

  const addRes = await runCommand(cmd, 180000);
  const combined = (addRes.stdout + ' ' + addRes.stderr).toLowerCase();

  if (combined.includes('nlm login') || combined.includes('authentication')) {
    const err = new Error("AUTH_REQUIRED: Autenticação expirada no NotebookLM.");
    (err as any).statusCode = 401;
    throw err;
  }

  if (addRes.code === 0 || addRes.stdout.includes('source_id') || addRes.stdout.includes('success')) {
    try {
      const parsed = JSON.parse(addRes.stdout);
      return {
        success: true,
        sourceId: parsed.source_id || parsed.id,
        title: parsed.title || title
      };
    } catch (_e) {
      return { success: true, title };
    }
  }

  return {
    success: false,
    error: addRes.stderr || addRes.stdout || 'Erro ao adicionar fonte'
  };
}

/**
 * Orquestra a limpeza completa e o upload sequencial dos novos arquivos anexados
 */
export async function cleanAndAddSources(input: { notebookId?: string; files?: FileItem[] }): Promise<CleanAndAddResult> {
  const targetId = extractNotebookId(input.notebookId) || getEnvNotebookId();
  
  // 1. Limpar fontes existentes
  const cleanResult = await cleanSources(targetId);
  
  // 2. Adicionar novos arquivos
  const files = input.files || [];
  let sourcesAdded = 0;
  const addedDetails: Array<{ title?: string; sourceId?: string; success: boolean }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!file.path) continue;
    const addResult = await addSourceFile(targetId, file.path, file.originalname || file.filename);
    if (addResult.success) {
      sourcesAdded++;
      addedDetails.push({ title: file.originalname || file.filename, sourceId: addResult.sourceId, success: true });
    } else {
      errors.push(addResult.error || `Falha no upload de ${file.originalname || file.path}`);
      addedDetails.push({ title: file.originalname || file.filename, success: false });
    }
  }

  return {
    success: errors.length === 0 || sourcesAdded > 0,
    notebookId: targetId,
    sourcesRemoved: cleanResult.removedCount,
    sourcesAdded,
    removedIds: cleanResult.removedIds,
    addedDetails,
    errors: errors.length > 0 ? errors : undefined
  };
}

export const syncSources = cleanAndAddSources;

/**
 * Garante que um valor numérico seja um número válido (não NaN), com fallback
 */
export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  const str = String(val).trim();
  const directNum = Number(str);
  if (!isNaN(directNum) && Number.isFinite(directNum)) {
    return directNum;
  }
  const cleaned = str.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.');
  const parsedCleaned = Number(cleaned);
  if (!isNaN(parsedCleaned) && Number.isFinite(parsedCleaned)) {
    return parsedCleaned;
  }
  return fallback;
}

export function sanitizeStructuredMetrics(raw: any): Partial<IncomeAuditResult> {
  if (!raw || typeof raw !== 'object') return raw;
  const result: any = { ...raw };
  if (result.rendaFormal !== undefined) {
    result.rendaFormal = safeNumber(result.rendaFormal, 0);
  }
  if (result.rendaInformal !== undefined) {
    result.rendaInformal = safeNumber(result.rendaInformal, 0);
  }
  if (result.rendaBruta !== undefined) {
    result.rendaBruta = safeNumber(result.rendaBruta, 0);
  }
  if (result.descontosDesconsiderados !== undefined) {
    result.descontosDesconsiderados = safeNumber(result.descontosDesconsiderados, 0);
  }
  if (result.rendaLiquida !== undefined) {
    result.rendaLiquida = safeNumber(result.rendaLiquida, 0);
  }
  if (result.capacidadePagamento !== undefined) {
    result.capacidadePagamento = safeNumber(result.capacidadePagamento, 0);
  }
  if (result.parecer !== undefined && typeof result.parecer !== 'string') {
    result.parecer = String(result.parecer || '');
  }
  return result;
}

/**
 * Extrai JSON estruturado da resposta da IA desempacotando envelope do CLI
 */
export function extractStructuredJson(rawText: string): Partial<IncomeAuditResult> | null {
  if (!rawText) return null;

  let textToParse = rawText;

  // Se o CLI retornou envelope JSON (ex: { "answer": "..." }), desempacota o campo 'answer'
  try {
    const envelope = JSON.parse(rawText);
    if (envelope && typeof envelope === 'object') {
      if (typeof envelope.answer === 'string') {
        textToParse = envelope.answer;
      } else if (envelope.rendaFormal !== undefined || envelope.rendaBruta !== undefined || envelope.rendaLiquida !== undefined) {
        return sanitizeStructuredMetrics(envelope);
      }
    }
  } catch (_e) {
    // Não é envelope JSON puro, prossegue com textToParse
  }

  // Tentativa 1: Bloco markdown ```json ... ```
  const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && typeof parsed === 'object') {
        return sanitizeStructuredMetrics(parsed);
      }
    } catch (_e) {
      // Continua
    }
  }

  // Tentativa 2: Chaves externas { ... }
  const firstBrace = textToParse.indexOf('{');
  const lastBrace = textToParse.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = textToParse.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return sanitizeStructuredMetrics(parsed);
      }
    } catch (_e) {
      // Continua
    }
  }

  return null;
}

/**
 * Constrói o prompt para consulta no chat / apuração
 */
export function buildChatPrompt(
  message: string,
  regrasConsiderar?: string,
  regrasDesconsiderar?: string,
  currentMetrics?: ChatQueryInput['currentMetrics']
): string {
  const considerar = regrasConsiderar && regrasConsiderar.trim()
    ? regrasConsiderar.trim()
    : 'Considerar renda bruta comprovada, salário base CLT, comissões recorrentes, pró-labore e depósitos regulares em extrato.';
  
  const desconsiderar = regrasDesconsiderar && regrasDesconsiderar.trim()
    ? regrasDesconsiderar.trim()
    : 'Desconsiderar horas extras pontuais/eventuais, 1/3 constitucional de férias, adiantamentos e empréstimos eventuais.';

  let metricsContext = '';
  if (currentMetrics && (currentMetrics.rendaBruta || currentMetrics.rendaFormal || currentMetrics.rendaLiquida)) {
    metricsContext = `\nMÉTRICAS ATUALMENTE APURADAS NA SESSÃO:\n` +
      `- Renda Formal: R$ ${currentMetrics.rendaFormal || 0}\n` +
      `- Renda Informal: R$ ${currentMetrics.rendaInformal || 0}\n` +
      `- Renda Bruta: R$ ${currentMetrics.rendaBruta || 0}\n` +
      `- Descontos Desconsiderados: R$ ${currentMetrics.descontosDesconsiderados || 0}\n` +
      `- Renda Líquida: R$ ${currentMetrics.rendaLiquida || 0}\n` +
      `- Capacidade de Pagamento (30%): R$ ${currentMetrics.capacidadePagamento || 0}\n`;
  }

  return `Você é um Auditor Sênior de Crédito Imobiliário da CORPSA CRM, especialista em apuração de renda para financiamento habitacional (SBPE, MCMV e Bancos Privados).

Sua tarefa é analisar os documentos anexados como fontes neste caderno (holerites, extratos bancários, IRPF, recibos de pró-labore) e atender à solicitação do corretor de imóveis.

DIRETRIZES DA APURAÇÃO:
1. ITENS A CONSIDERAR:
${considerar}

2. ITENS A DESCONSIDERAR:
${desconsiderar}
${metricsContext}
SOLICITAÇÃO DO USUÁRIO:
"${message}"

INSTRUÇÕES DE FORMATAÇÃO DA RESPOSTA (OBRIGATÓRIO):
Responda diretamente nesta mensagem do chat, com tom técnico, preciso e estruturado, no seguinte padrão:

### 1. Evolução Mensal da Renda
Apresente uma tabela com o detalhamento mês a mês dos documentos analisados (ex: Mês, Créditos/Salário Bruto, Mesma Titularidade, Estornos/Exclusões, Renda Líquida Aprovada).
- **Média Mensal Global:** Valor médio mensal apurado no período.
- **Índice de Aproveitamento de Crédito:** Percentual da renda aproveitada após exclusões.

### 2. Principais Exclusões Aplicadas
Liste detalhadamente com datas e valores:
- **Mesma Titularidade / Transferências Próprias:** Pix/TED entre contas do próprio cliente desconsiderados.
- **Estornos e Reembolsos:** Valores devolvidos ou reembolsos identificados nos extratos.
- **Outros Descontos Desconsiderados:** Empréstimos consignados, horas extras eventuais, adiantamentos.

### 3. Parecer de Crédito & Capacidade de Pagamento
- **Renda Formal Aprovada:** R$ ...
- **Renda Informal Aprovada:** R$ ...
- **Renda Bruta Total:** R$ ...
- **Renda Líquida Aprovável:** R$ ...
- **Capacidade de Parcela (30% da renda aprovada):** R$ .../mês

*Nota: Toda a análise e parecer devem ser exibidos diretamente neste chat. Não gere artefatos no Studio.*

AO FINAL DA SUA RESPOSTA, inclua OBRIGATORIAMENTE o bloco JSON com os valores numéricos exatos:
\`\`\`json
{
  "rendaFormal": 0.00,
  "rendaInformal": 0.00,
  "rendaBruta": 0.00,
  "descontosDesconsiderados": 0.00,
  "rendaLiquida": 0.00,
  "capacidadePagamento": 0.00,
  "parecer": "Resumo executivo do parecer de crédito."
}
\`\`\``;
}

/**
 * Consulta o caderno do NotebookLM via CLI `nlm query notebook`
 */
export async function queryNotebook(
  inputOrNotebookId: ChatQueryInput | string,
  promptOrConversation?: string
): Promise<ChatQueryResult> {
  let notebookId: string;
  let message: string;
  let regrasConsiderar: string | undefined;
  let regrasDesconsiderar: string | undefined;
  let currentMetrics: ChatQueryInput['currentMetrics'] | undefined;
  let files: FileItem[] | undefined;

  if (typeof inputOrNotebookId === 'string') {
    notebookId = extractNotebookId(inputOrNotebookId) || getEnvNotebookId();
    message = promptOrConversation || '';
  } else {
    notebookId = extractNotebookId(inputOrNotebookId.notebookId) || getEnvNotebookId();
    message = inputOrNotebookId.message || inputOrNotebookId.prompt || '';
    regrasConsiderar = inputOrNotebookId.regrasConsiderar;
    regrasDesconsiderar = inputOrNotebookId.regrasDesconsiderar;
    currentMetrics = inputOrNotebookId.currentMetrics;
    files = inputOrNotebookId.files;
  }

  // Se foram passados novos arquivos na consulta, sincroniza antes
  if (files && files.length > 0) {
    await cleanAndAddSources({ notebookId, files });
  }

  const fullPrompt = buildChatPrompt(message, regrasConsiderar, regrasDesconsiderar, currentMetrics);
  const sanitizedPrompt = fullPrompt.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

  // Executa com o subcomando correto: `nlm query notebook "<notebookId>" "<prompt>" --json`
  const queryCmd = `nlm query notebook "${notebookId}" "${sanitizedPrompt}" --json`;
  const queryRes = await runCommand(queryCmd, 180000);

  const rawOut = queryRes.stdout || queryRes.stderr;
  const combined = (queryRes.stdout + ' ' + queryRes.stderr).toLowerCase();

  if (
    combined.includes('authentication error') ||
    combined.includes('authentication expired') ||
    combined.includes('nlm login') ||
    combined.includes("profile 'default' not found")
  ) {
    const err = new Error("AUTH_REQUIRED: Conexão com Google NotebookLM não autenticada. Execute 'nlm login' no terminal.");
    (err as any).statusCode = 401;
    throw err;
  }

  if (
    combined.includes("is not recognized") ||
    combined.includes("command not found") ||
    combined.includes("não é reconhecido")
  ) {
    const err = new Error("CLI_NOT_FOUND: O utilitário 'notebooklm-mcp-cli' (nlm) não foi encontrado no sistema.");
    (err as any).statusCode = 500;
    throw err;
  }

  if (
    combined.includes('no sources to query') ||
    combined.includes('add a source first') ||
    combined.includes('sem fontes') ||
    combined.includes('nenhuma fonte')
  ) {
    return {
      success: false,
      reply: "⚠️ **Nenhum documento/fonte foi encontrado no caderno do NotebookLM.**\n\nPor favor, anexe os extratos bancários, holerites ou IRPF (PDFs/imagens) na aba de documentos à esquerda para que o NotebookLM faça a leitura das fontes e realize a apuração de renda.",
      parecer: "Aguardando anexo de documentos para realizar a apuração.",
      metrics: {
        rendaFormal: currentMetrics?.rendaFormal ?? 0,
        rendaInformal: currentMetrics?.rendaInformal ?? 0,
        rendaBruta: currentMetrics?.rendaBruta ?? 0,
        descontosDesconsiderados: currentMetrics?.descontosDesconsiderados ?? 0,
        rendaLiquida: currentMetrics?.rendaLiquida ?? 0,
        capacidadePagamento: currentMetrics?.capacidadePagamento ?? 0
      },
      notebookId
    };
  }

  // Desempacota envelope
  let textAnswer = rawOut;
  try {
    const parsedEnvelope = JSON.parse(rawOut);
    if (parsedEnvelope && typeof parsedEnvelope.answer === 'string') {
      textAnswer = parsedEnvelope.answer;
    } else if (parsedEnvelope && parsedEnvelope.error) {
      const errStr = String(parsedEnvelope.error).toLowerCase();
      if (errStr.includes('no sources') || errStr.includes('add a source')) {
        return {
          success: false,
          reply: "⚠️ **Nenhum documento/fonte foi encontrado no caderno do NotebookLM.**\n\nPor favor, anexe os extratos bancários, holerites ou IRPF (PDFs/imagens) na aba de documentos à esquerda para que o NotebookLM faça a leitura das fontes e realize a apuração de renda.",
          parecer: "Aguardando anexo de documentos para realizar a apuração.",
          metrics: {
            rendaFormal: currentMetrics?.rendaFormal ?? 0,
            rendaInformal: currentMetrics?.rendaInformal ?? 0,
            rendaBruta: currentMetrics?.rendaBruta ?? 0,
            descontosDesconsiderados: currentMetrics?.descontosDesconsiderados ?? 0,
            rendaLiquida: currentMetrics?.rendaLiquida ?? 0,
            capacidadePagamento: currentMetrics?.capacidadePagamento ?? 0
          },
          notebookId
        };
      }
      throw new Error(`NotebookLM query error: ${parsedEnvelope.error}`);
    }
  } catch (parseErr: any) {
    if (parseErr.message && parseErr.message.startsWith('NotebookLM query error:')) {
      throw parseErr;
    }
  }

  const structuredJson = extractStructuredJson(rawOut);

  // Remove o bloco JSON markdown da resposta do chat para exibição limpa
  let cleanReply = textAnswer.replace(/```(?:json)?\s*[\s\S]*?\s*```/gi, '').trim();
  if (!cleanReply) {
    cleanReply = structuredJson?.parecer || 'Apuração processada com sucesso no NotebookLM.';
  }

  let finalMetrics = {
    rendaFormal: safeNumber(currentMetrics?.rendaFormal, 0),
    rendaInformal: safeNumber(currentMetrics?.rendaInformal, 0),
    rendaBruta: safeNumber(currentMetrics?.rendaBruta, 0),
    descontosDesconsiderados: safeNumber(currentMetrics?.descontosDesconsiderados, 0),
    rendaLiquida: safeNumber(currentMetrics?.rendaLiquida, 0),
    capacidadePagamento: safeNumber(currentMetrics?.capacidadePagamento, 0)
  };

  if (structuredJson) {
    const rendaFormal = safeNumber(
      structuredJson.rendaFormal !== undefined ? structuredJson.rendaFormal : finalMetrics.rendaFormal,
      finalMetrics.rendaFormal
    );
    const rendaInformal = safeNumber(
      structuredJson.rendaInformal !== undefined ? structuredJson.rendaInformal : finalMetrics.rendaInformal,
      finalMetrics.rendaInformal
    );
    const descontos = safeNumber(
      structuredJson.descontosDesconsiderados !== undefined ? structuredJson.descontosDesconsiderados : finalMetrics.descontosDesconsiderados,
      finalMetrics.descontosDesconsiderados
    );

    const calculatedBruta = rendaFormal + rendaInformal;
    const rendaBruta = safeNumber(
      structuredJson.rendaBruta !== undefined ? structuredJson.rendaBruta : (calculatedBruta !== 0 ? calculatedBruta : finalMetrics.rendaBruta),
      finalMetrics.rendaBruta
    );

    const calculatedLiquida = Math.max(0, rendaBruta - Math.round(rendaBruta * 0.12) + descontos);
    const rendaLiquida = safeNumber(
      structuredJson.rendaLiquida !== undefined ? structuredJson.rendaLiquida : (calculatedLiquida !== 0 ? calculatedLiquida : finalMetrics.rendaLiquida),
      finalMetrics.rendaLiquida
    );

    const calculatedCapacidade = Math.round(rendaLiquida * 0.30);
    const capacidadePagamento = safeNumber(
      structuredJson.capacidadePagamento !== undefined ? structuredJson.capacidadePagamento : (calculatedCapacidade !== 0 ? calculatedCapacidade : finalMetrics.capacidadePagamento),
      finalMetrics.capacidadePagamento
    );

    finalMetrics = {
      rendaFormal,
      rendaInformal,
      rendaBruta,
      descontosDesconsiderados: descontos,
      rendaLiquida,
      capacidadePagamento
    };
  }

  const parecerText = structuredJson?.parecer || cleanReply;

  return {
    success: true,
    reply: cleanReply,
    parecer: parecerText,
    metrics: finalMetrics,
    notebookId,
    rawResponse: rawOut,
    rawOutput: rawOut
  };
}

export const queryChat = queryNotebook;

/**
 * Conecta ao notebook do Google NotebookLM (utilizando o ID configurado ou o fornecido pelo usuário),
 * limpa fontes antigas, faz upload dos novos arquivos anexados e executa o prompt de apuração de 1-clique.
 */
export async function analyzeDocuments(input: AnalysisInput): Promise<IncomeAuditResult> {
  const notebookId = extractNotebookId(input.notebookId) || getEnvNotebookId();

  // 1. Limpar fontes antigas e adicionar novos arquivos
  const syncResult = await cleanAndAddSources({
    notebookId,
    files: input.files
  });

  // 2. Executar consulta de apuração
  const promptMessage = "Realize a apuração completa de renda do cliente com base em todos os documentos anexados neste caderno.";
  const chatResult = await queryNotebook({
    notebookId,
    message: promptMessage,
    regrasConsiderar: input.regrasConsiderar,
    regrasDesconsiderar: input.regrasDesconsiderar
  });

  return {
    rendaFormal: chatResult.metrics.rendaFormal,
    rendaInformal: chatResult.metrics.rendaInformal,
    rendaBruta: chatResult.metrics.rendaBruta,
    descontosDesconsiderados: chatResult.metrics.descontosDesconsiderados,
    rendaLiquida: chatResult.metrics.rendaLiquida,
    capacidadePagamento: chatResult.metrics.capacidadePagamento,
    parecer: chatResult.parecer || chatResult.reply,
    notebookId,
    sourcesAdded: syncResult.sourcesAdded,
    sourcesRemoved: syncResult.sourcesRemoved,
    rawResponse: chatResult.rawResponse
  };
}
