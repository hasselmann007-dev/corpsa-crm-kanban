import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface NlmStatusResult {
  installed: boolean;
  authenticated: boolean;
  message: string;
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
  rawResponse?: string;
}

function getNlmCmd(): string {
  const customPath = 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\nlm.exe';
  if (fs.existsSync(customPath)) {
    return `"${customPath}"`;
  }
  return 'nlm';
}

/**
 * Executes CLI command line with configurable timeout and buffer
 */
function runCommand(commandStr: string, timeoutMs: number = 120000): Promise<{ stdout: string; stderr: string; code: number }> {
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
 * Checks whether `nlm` CLI is installed and authenticated via `nlm notebook list --json`
 */
export async function getNlmStatus(): Promise<NlmStatusResult> {
  const result = await runCommand('nlm notebook list --json');
  
  if (
    result.stderr.includes('Profile') && result.stderr.includes('not found') ||
    result.stderr.includes('nlm login') ||
    result.stdout.includes('Profile') && result.stdout.includes('not found')
  ) {
    return {
      installed: true,
      authenticated: false,
      message: "Profile 'default' not found. Run 'nlm login' first."
    };
  }

  if (
    result.stderr.includes("is not recognized") ||
    result.stderr.includes("command not found") ||
    (result.code !== 0 && !result.stdout && !result.stderr)
  ) {
    return {
      installed: false,
      authenticated: false,
      message: "notebooklm-mcp-cli (nlm) não encontrado no sistema."
    };
  }

  try {
    const data = JSON.parse(result.stdout);
    const count = Array.isArray(data) ? data.length : (data.notebooks && Array.isArray(data.notebooks) ? data.notebooks.length : 0);
    return {
      installed: true,
      authenticated: true,
      message: "NotebookLM CLI pronto e autenticado.",
      notebooksCount: count
    };
  } catch (_e) {
    if (result.code === 0) {
      return {
        installed: true,
        authenticated: true,
        message: "NotebookLM CLI pronto."
      };
    }
    return {
      installed: true,
      authenticated: false,
      message: result.stderr || "Falha ao comunicar com o CLI do NotebookLM."
    };
  }
}

/**
 * Robustly extracts structured JSON calculations from AI response text
 */
function extractStructuredJson(rawText: string): Partial<IncomeAuditResult> | null {
  if (!rawText) return null;

  // Attempt 1: Regex match for markdown ```json ... ``` block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (_e) {
      // Continue to next attempt
    }
  }

  // Attempt 2: Find outermost braces { ... }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = rawText.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    } catch (_e) {
      // Continue
    }
  }

  return null;
}

/**
 * Connects to central notebook "Apuração de Renda CORPSA", clears old sources,
 * uploads attached files, formulates financial audit query, and parses results.
 */
export async function analyzeDocuments(input: AnalysisInput): Promise<IncomeAuditResult> {
  // Step 1: Check authentication status & list existing notebooks
  const listRes = await runCommand('nlm notebook list --json');
  if (
    listRes.stderr.includes("Profile 'default' not found") ||
    listRes.stderr.includes("nlm login") ||
    listRes.stdout.includes("Profile 'default' not found")
  ) {
    const err = new Error("AUTH_REQUIRED: Profile 'default' not found. Run 'nlm login' first.");
    (err as any).statusCode = 401;
    throw err;
  }
  if (listRes.code !== 0 && !listRes.stdout) {
    const err = new Error("CLI_NOT_FOUND: nlm CLI command failed or is not available.");
    (err as any).statusCode = 500;
    throw err;
  }

  let notebookId = '';
  let notebooksList: any[] = [];
  try {
    const parsed = JSON.parse(listRes.stdout);
    notebooksList = Array.isArray(parsed) ? parsed : (parsed.notebooks || []);
  } catch (_e) {
    // Ignore JSON parse failure for notebook list
  }

  const targetTitle = "Apuração de Renda CORPSA";
  const existingNb = notebooksList.find(
    (nb) => nb.title && nb.title.toLowerCase().trim() === targetTitle.toLowerCase().trim()
  );

  if (existingNb && (existingNb.id || existingNb.notebook_id)) {
    notebookId = existingNb.id || existingNb.notebook_id;
  } else {
    // Create central notebook if missing
    const createRes = await runCommand(`nlm notebook create "${targetTitle}" --json`);
    if (createRes.code !== 0 && !createRes.stdout) {
      throw new Error(`Falha ao criar notebook central '${targetTitle}': ${createRes.stderr}`);
    }
    try {
      const createdObj = JSON.parse(createRes.stdout);
      notebookId = createdObj.id || createdObj.notebook_id;
    } catch (_e) {
      const match = createRes.stdout.match(/([a-f0-9-]{12,})/i);
      if (match) notebookId = match[1];
    }
  }

  if (!notebookId) {
    throw new Error("Não foi possível obter o ID do Notebook 'Apuração de Renda CORPSA'.");
  }

  // Step 2: Clear previous document sources
  const sourceListRes = await runCommand(`nlm source list "${notebookId}" --json`);
  let sourcesList: any[] = [];
  try {
    const parsedSources = JSON.parse(sourceListRes.stdout);
    sourcesList = Array.isArray(parsedSources) ? parsedSources : (parsedSources.sources || []);
  } catch (_e) {
    // Ignore JSON parse error
  }

  if (sourcesList.length > 0) {
    const sourceIds = sourcesList.map((s) => s.id || s.source_id).filter(Boolean);
    if (sourceIds.length > 0) {
      await runCommand(`nlm source delete ${sourceIds.join(' ')} --confirm --json`);
    }
  }

  // Step 3: Upload new attached files
  const files = input.files || [];
  let sourcesAdded = 0;
  for (const file of files) {
    if (!file.path || !fs.existsSync(file.path)) continue;
    const sanitizedPath = path.resolve(file.path).replace(/"/g, '\\"');
    const addRes = await runCommand(`nlm source add "${notebookId}" --file "${sanitizedPath}" --wait --json`, 180000);
    if (addRes.code === 0 || addRes.stdout.includes('success') || addRes.stdout.includes('added')) {
      sourcesAdded++;
    }
  }

  // Step 4: Formulate financial audit prompt incorporating regrasConsiderar and regrasDesconsiderar
  const regrasConsiderar = input.regrasConsiderar && input.regrasConsiderar.trim()
    ? input.regrasConsiderar.trim()
    : 'Considerar renda bruta, horas extras habituais e adicionais regulares conforme comprovado nos documentos.';
  
  const regrasDesconsiderar = input.regrasDesconsiderar && input.regrasDesconsiderar.trim()
    ? input.regrasDesconsiderar.trim()
    : 'Desconsiderar adiantamentos eventuais, empréstimos consignados, indenizações pontuais e descontos não recorrentes.';

  const promptText = `Você é um auditor financeiro sênior da CORPSA CRM especialista em apuração de renda para crédito imobiliário.
Analise com rigor todos os documentos anexados nesta sessão (holerites, extratos bancários, IRPF, comprovantes de renda).

REGRAS DE CONSIDERAÇÃO DEFINIDAS PELO CORRETOR:
- ITENS A CONSIDERAR: ${regrasConsiderar}
- ITENS A DESCONSIDERAR: ${regrasDesconsiderar}

REQUISITOS DA RESPOSTA:
Calcule os valores mensais apurados (Renda Formal, Renda Informal, Renda Bruta Total, Descontos Desconsiderados/Ignorados, Renda Líquida Aprovada e Capacidade de Pagamento de 30% da renda aprovada).
Retorne OBRIGATORIAMENTE um bloco JSON VÁLIDO no seguinte formato exatamente:
\`\`\`json
{
  "rendaFormal": 0.00,
  "rendaInformal": 0.00,
  "rendaBruta": 0.00,
  "descontosDesconsiderados": 0.00,
  "rendaLiquida": 0.00,
  "capacidadePagamento": 0.00,
  "parecer": "Texto detalhado do parecer de auditoria..."
}
\`\`\``;

  // Flatten prompt for CLI execution without line break issues
  const sanitizedPrompt = promptText.replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');

  // Step 5: Run income calculation query
  const queryRes = await runCommand(`nlm query notebook "${notebookId}" "${sanitizedPrompt}" --json`, 120000);

  let rawAnswer = queryRes.stdout || queryRes.stderr;
  try {
    const queryObj = JSON.parse(queryRes.stdout);
    if (queryObj.answer) rawAnswer = queryObj.answer;
    else if (queryObj.response) rawAnswer = queryObj.response;
    else if (queryObj.text) rawAnswer = queryObj.text;
  } catch (_e) {
    // Use raw stdout/stderr
  }

  // Step 6: Parse structured calculation results
  const extracted = extractStructuredJson(rawAnswer) || {};

  const rendaFormal = Number(extracted.rendaFormal) || 0;
  const rendaInformal = Number(extracted.rendaInformal) || 0;
  let rendaBruta = Number(extracted.rendaBruta) || (rendaFormal + rendaInformal);
  const descontosDesconsiderados = Number(extracted.descontosDesconsiderados) || 0;
  let rendaLiquida = Number(extracted.rendaLiquida) || (rendaBruta > 0 ? (rendaBruta - descontosDesconsiderados) : 0);
  if (rendaLiquida < 0) rendaLiquida = rendaBruta;

  let capacidadePagamento = Number(extracted.capacidadePagamento) || Math.round(rendaLiquida * 0.3 * 100) / 100;

  const parecer = extracted.parecer || rawAnswer || "Análise concluída pelo NotebookLM com base nos documentos e regras fornecidas.";

  return {
    rendaFormal: Math.round(rendaFormal * 100) / 100,
    rendaInformal: Math.round(rendaInformal * 100) / 100,
    rendaBruta: Math.round(rendaBruta * 100) / 100,
    descontosDesconsiderados: Math.round(descontosDesconsiderados * 100) / 100,
    rendaLiquida: Math.round(rendaLiquida * 100) / 100,
    capacidadePagamento: Math.round(capacidadePagamento * 100) / 100,
    parecer,
    notebookId,
    sourcesAdded,
    rawResponse: rawAnswer
  };
}
