import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  getNlmStatus, 
  analyzeDocuments, 
  queryNotebook, 
  cleanAndAddSources, 
  FileItem 
} from './nlmBridge.js';
import { 
  testOpenRouterMcp, 
  chatWithOpenRouter, 
  getAgentConstitution, 
  saveAgentConstitution, 
  getAgentPromptCrm, 
  saveAgentPromptCrm 
} from '../tools/openrouterTool.js';
import { 
  chatWithGoogleGemini, 
  transcribeMultimodalContent, 
  detectMediaType, 
  normalizeMimeType 
} from '../tools/geminiTool.js';
import { 
  executarCriarCardKanban, 
  getRegrasAnaliseKanban 
} from '../tools/kanbanTool.js';
import { 
  extrairSicaqComGemini36, 
  parseTextoCaixaDeterministico 
} from '../src/utils/sicaqExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup for processing document attachments
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20                  // Up to 20 files per batch
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Helper to extract file items from Multer upload or JSON request body
 */
function extractUploadedFiles(
  reqFiles: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
  bodyFilePaths?: any
): FileItem[] {
  const fileItems: FileItem[] = [];

  if (Array.isArray(reqFiles)) {
    for (const f of reqFiles) {
      fileItems.push({
        path: f.path,
        originalname: f.originalname,
        filename: f.filename,
        mimetype: f.mimetype
      });
    }
  }

  let pathsArray = bodyFilePaths;
  if (typeof pathsArray === 'string') {
    try {
      pathsArray = JSON.parse(pathsArray);
    } catch (_e) {
      pathsArray = [pathsArray];
    }
  }

  if (Array.isArray(pathsArray)) {
    for (const p of pathsArray) {
      if (typeof p === 'string' && p.trim()) {
        fileItems.push({ path: p.trim() });
      } else if (p && typeof p === 'object' && typeof p.path === 'string') {
        fileItems.push({ path: p.path, originalname: p.name || p.originalname });
      }
    }
  }

  return fileItems;
}

/**
 * Helper to cleanup temporary Multer files from disk
 */
function cleanupTempFiles(files: Express.Multer.File[] | undefined) {
  if (!Array.isArray(files)) return;
  for (const f of files) {
    if (f.path && fs.existsSync(f.path)) {
      try {
        fs.unlinkSync(f.path);
      } catch (err) {
        console.warn(`[Cleanup] Falha ao excluir arquivo temporário ${f.path}:`, err);
      }
    }
  }
}

/**
 * Standardized error formatting for NotebookLM operations
 */
function handleNlmError(error: any, res: express.Response, defaultAction: string = 'PROCESS_FAILED') {
  console.error(`[NLM Error] ${defaultAction}:`, error);
  const errorMessage = error?.message || '';

  if (
    errorMessage.includes('AUTH_REQUIRED') ||
    errorMessage.includes('nlm login') ||
    errorMessage.includes("Profile 'default' not found") ||
    errorMessage.includes("profile 'default' not found") ||
    error?.statusCode === 401
  ) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: "Conexão com Google NotebookLM não autenticada. Execute 'nlm login' no terminal para autenticar."
    });
  }

  if (
    errorMessage.includes('CLI_NOT_FOUND') ||
    errorMessage.includes('is not recognized') ||
    errorMessage.includes('command not found') ||
    errorMessage.includes('não é reconhecido')
  ) {
    return res.status(500).json({
      success: false,
      error: 'CLI_NOT_FOUND',
      message: "O utilitário 'notebooklm-mcp-cli' (nlm) não foi encontrado no sistema."
    });
  }

  return res.status(500).json({
    success: false,
    error: defaultAction,
    message: errorMessage || `Falha durante ${defaultAction.toLowerCase()} no NotebookLM.`
  });
}

/**
 * GET /api/nlm/status
 * Check nlm CLI installation and login status
 */
app.get('/api/nlm/status', async (_req, res) => {
  try {
    const status = await getNlmStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      installed: false,
      authenticated: false,
      message: error.message || 'Erro ao verificar status do NotebookLM.'
    });
  }
});

/**
 * POST /api/nlm/analyze
 * Handle multipart/JSON payload with attached files and rules, invoke nlmBridge
 */
app.post('/api/nlm/analyze', upload.array('files'), async (req, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];

  try {
    const fileItems = extractUploadedFiles(uploadedFiles, req.body.filePaths || req.body.arquivos);
    const regrasConsiderar = req.body.regrasConsiderar || req.body.considerationText || '';
    const regrasDesconsiderar = req.body.regrasDesconsiderar || req.body.disregardText || '';
    const notebookId = req.body.notebookId || req.body.notebookUrl;

    const result = await analyzeDocuments({
      files: fileItems,
      regrasConsiderar,
      regrasDesconsiderar,
      notebookId
    });

    res.json({
      success: true,
      notebookId: result.notebookId || notebookId || 'af25c93d-d48c-4cba-a2f2-5991dcbbbc57',
      sourcesAdded: result.sourcesAdded ?? fileItems.length,
      sourcesRemoved: result.sourcesRemoved ?? 0,
      result,
      data: result // Backward compatibility
    });
  } catch (error: any) {
    handleNlmError(error, res, 'ANALYSIS_FAILED');
  } finally {
    cleanupTempFiles(uploadedFiles);
  }
});

/**
 * POST /api/nlm/sync-sources
 * Dedicated endpoint to clean old sources and add new files without running prompt calculation
 */
app.post('/api/nlm/sync-sources', upload.array('files'), async (req, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];

  try {
    const fileItems = extractUploadedFiles(uploadedFiles, req.body.filePaths || req.body.arquivos);
    const notebookId = req.body.notebookId || req.body.notebookUrl;

    const syncResult = await cleanAndAddSources({
      files: fileItems,
      notebookId
    });

    res.json({
      success: true,
      ...syncResult
    });
  } catch (error: any) {
    handleNlmError(error, res, 'SYNC_FAILED');
  } finally {
    cleanupTempFiles(uploadedFiles);
  }
});

/**
 * POST /api/nlm/chat
 * Handle interactive chat messages, querying NotebookLM with session context and returning updated metrics
 */
app.post('/api/nlm/chat', upload.array('files'), async (req, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];

  try {
    const message = req.body.message || req.body.prompt;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'O campo message é obrigatório.'
      });
      return;
    }

    const fileItems = extractUploadedFiles(uploadedFiles, req.body.filePaths || req.body.arquivos);
    const regrasConsiderar = req.body.regrasConsiderar || req.body.considerationText || '';
    const regrasDesconsiderar = req.body.regrasDesconsiderar || req.body.disregardText || '';
    const notebookId = req.body.notebookId || req.body.notebookUrl;

    let currentMetrics = req.body.currentMetrics;
    if (typeof currentMetrics === 'string') {
      try {
        currentMetrics = JSON.parse(currentMetrics);
      } catch (_e) {
        currentMetrics = undefined;
      }
    }

    const chatResponse = await queryNotebook({
      notebookId,
      message: message.trim(),
      regrasConsiderar,
      regrasDesconsiderar,
      currentMetrics,
      files: fileItems.length > 0 ? fileItems : undefined
    });

    res.json({
      success: true,
      reply: chatResponse.reply,
      parecer: chatResponse.parecer,
      metrics: chatResponse.metrics,
      notebookId: chatResponse.notebookId,
      rawResponse: chatResponse.rawResponse
    });
  } catch (error: any) {
    handleNlmError(error, res, 'CHAT_FAILED');
  } finally {
    cleanupTempFiles(uploadedFiles);
  }
});

/**
 * Multer error handling middleware
 */
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Arquivo excede o limite máximo permitido de 50MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message
    });
  }
  next(err);
});

/**
 * GET /api/openrouter/test
 * Test connection to OpenRouter MCP endpoint
 */
app.get('/api/openrouter/test', async (req, res) => {
  try {
    const apiKey = (req.query.apiKey as string) || '';
    const result = await testOpenRouterMcp(apiKey);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      connected: false,
      message: error.message || 'Erro ao testar OpenRouter MCP'
    });
  }
});

/**
 * GET /api/agent/constitution
 * Read current skills/constituicao.md
 */
app.get('/api/agent/constitution', (_req, res) => {
  try {
    const constitution = getAgentConstitution();
    res.json({ success: true, constitution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/constitution
 * Update skills/constituicao.md from sandbox
 */
app.post('/api/agent/constitution', (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Conteúdo deve ser uma string' });
      return;
    }
    const success = saveAgentConstitution(content);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/prompt-agentcrm
 * Read current prompt-agentcrm.md
 */
app.get('/api/agent/prompt-agentcrm', (_req, res) => {
  try {
    const prompt = getAgentPromptCrm();
    res.json({ success: true, prompt });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/prompt-agentcrm
 * Update prompt-agentcrm.md
 */
app.post('/api/agent/prompt-agentcrm', (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Conteúdo deve ser uma string' });
      return;
    }
    const success = saveAgentPromptCrm(content);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat
 * Handle chat interaction with AI Agent via OpenRouter in Sandbox
 */
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { messages, model, apiKey, temperature, customConstitution } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Array de mensagens é obrigatório' });
      return;
    }
    const result = await chatWithOpenRouter(
      messages, 
      model || 'google/gemini-3.7-flash', 
      apiKey, 
      typeof temperature === 'number' ? temperature : 0.7,
      customConstitution
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar mensagem com OpenRouter'
    });
  }
});

/**
 * POST /api/agent/gemini-chat
 * Handle chat interaction directly via Google Gemini REST API
 */
app.post('/api/agent/gemini-chat', async (req, res) => {
  try {
    const { messages, apiKey, customPrompt, customConstitution } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Array de mensagens é obrigatório' });
      return;
    }
    const result = await chatWithGoogleGemini(messages, apiKey, customPrompt, customConstitution);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar mensagem com Google Gemini'
    });
  }
});

/**
 * POST /api/kanban/criar-card
 * Endpoint direto para criar card no fluxo Kanban a partir do Agente IA ou automações
 */
app.post('/api/kanban/criar-card', async (req, res) => {
  try {
    const { nome_cliente, cpf_cliente, valor_imovel, cidade, grupo_origem, tipo_consulta, detalhes_solicitacao, prioridade } = req.body;
    
    if (!nome_cliente) {
      res.status(400).json({ success: false, error: 'Nome do cliente é obrigatório.' });
      return;
    }

    const result = await executarCriarCardKanban({
      nome_cliente,
      cpf_cliente,
      valor_imovel,
      cidade,
      grupo_origem,
      tipo_consulta,
      detalhes_solicitacao,
      prioridade
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar card no Kanban.'
    });
  }
});

/**
 * POST /api/sicaq/extrair-pdf
 * Endpoint oficial para extração multimodal de PDF ou imagem do SICAQ / Simulador Caixa via Gemini 3.6
 */
app.post('/api/sicaq/extrair-pdf', async (req, res) => {
  try {
    const { base64, mimeType, textContent } = req.body;
    
    // Se o cliente já enviou texto extraído ou OCR
    if (textContent && typeof textContent === 'string' && textContent.length > 50) {
      const parsed = parseTextoCaixaDeterministico(textContent);
      if (parsed.valor_imovel && parsed.valor_imovel > 0) {
        res.json({ success: true, data: parsed, source: 'deterministico' });
        return;
      }
    }

    if (!base64) {
      res.status(400).json({ success: false, error: 'Base64 do arquivo não informado.' });
      return;
    }

    const key = process.env.GEMINI_API_KEY || '';
    const extracted = await extrairSicaqComGemini36(base64, mimeType || 'application/pdf', key);
    res.json({ success: true, data: extracted, source: 'gemini-3.6-flash' });
  } catch (error: any) {
    console.error('Erro na extração SICAQ:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao extrair dados do simulador com Gemini 3.6'
    });
  }
});

/**
 * GET /api/kanban/regras-analise
 * Retorna o conteúdo de skills/regras-analise-kanban.md
 */
app.get('/api/kanban/regras-analise', (_req, res) => {
  try {
    const regras = getRegrasAnaliseKanban();
    res.json({ success: true, regras });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/kanban/regras-analise
 * Salva modificações em skills/regras-analise-kanban.md
 */
app.post('/api/kanban/regras-analise', (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Conteúdo deve ser uma string' });
      return;
    }
    const rulesPath = path.resolve(__dirname, '..', 'skills', 'regras-analise-kanban.md');
    fs.writeFileSync(rulesPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agente/transcribe
 * Standalone endpoint to transcribe audio, extract text from images (OCR), or extract PDF text
 */
app.post('/api/agente/transcribe', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;

  try {
    let buffer: Buffer | undefined = uploadedFile?.path && fs.existsSync(uploadedFile.path) 
      ? fs.readFileSync(uploadedFile.path) 
      : undefined;
    let base64 = req.body.base64 || '';
    let mimeType = req.body.mimeType || uploadedFile?.mimetype || 'application/octet-stream';
    let filename = req.body.filename || uploadedFile?.originalname || 'arquivo';

    if (!buffer && !base64) {
      res.status(400).json({ success: false, error: 'Nenhum arquivo ou base64 fornecido para transcrição.' });
      return;
    }

    const result = await transcribeMultimodalContent({
      buffer,
      base64,
      mimeType,
      filename,
      customKey: req.body.apiKey
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('[Transcribe Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao transcrever conteúdo multimodal.'
    });
  } finally {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch {}
    }
  }
});

/**
 * POST /api/agente/chat-multimodal
 * Pipeline completo em duas etapas:
 * 1. Detecção e Transcrição/Extração (Áudio -> Fala, Imagem -> OCR, PDF -> Texto)
 * 2. Execução da automação do Agente CRM com o texto resultante
 */
app.post('/api/agente/chat-multimodal', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;

  try {
    let rawMessages = req.body.messages;
    if (typeof rawMessages === 'string') {
      try { rawMessages = JSON.parse(rawMessages); } catch { rawMessages = []; }
    }
    if (!Array.isArray(rawMessages)) {
      rawMessages = [];
    }

    const customPrompt = req.body.customPrompt;
    const customConstitution = req.body.customConstitution;
    const apiKey = req.body.apiKey;
    const extraText = (req.body.message || req.body.text || '').trim();

    let hasMedia = Boolean(uploadedFile || req.body.base64);
    let mediaType: 'audio' | 'image' | 'pdf' | 'text' = 'text';
    let transcribedText = '';
    let latencyMs = 0;

    // ETAPA 1: Transcrição / Extração Multimodal se houver arquivo
    if (hasMedia) {
      const buffer = uploadedFile?.path && fs.existsSync(uploadedFile.path)
        ? fs.readFileSync(uploadedFile.path)
        : undefined;
      const base64 = req.body.base64 || '';
      const mimeType = req.body.mimeType || uploadedFile?.mimetype || 'application/octet-stream';
      const filename = req.body.filename || uploadedFile?.originalname || 'arquivo';

      const transcription = await transcribeMultimodalContent({
        buffer,
        base64,
        mimeType,
        filename,
        customKey: apiKey
      });

      mediaType = transcription.mediaType;
      transcribedText = transcription.transcribedText;
      latencyMs += transcription.latencyMs;
    }

    // Monta o texto de entrada do usuário para o Agente CRM
    let userPromptContent = '';
    if (mediaType === 'audio') {
      userPromptContent = `[Áudio falado pelo corretor/cliente transcrito]: "${transcribedText}"`;
      if (extraText) userPromptContent += `\n[Comentário adicional]: ${extraText}`;
    } else if (mediaType === 'image') {
      userPromptContent = `[Documento/Imagem enviada pelo corretor - Conteúdo extraído]:\n${transcribedText}`;
      if (extraText) userPromptContent += `\n[Comentário adicional]: ${extraText}`;
    } else if (mediaType === 'pdf') {
      userPromptContent = `[Documento PDF enviado pelo corretor - Conteúdo extraído]:\n${transcribedText}`;
      if (extraText) userPromptContent += `\n[Comentário adicional]: ${extraText}`;
    } else {
      userPromptContent = extraText || (rawMessages.length > 0 ? rawMessages[rawMessages.length - 1].content : '');
    }

    if (!userPromptContent.trim()) {
      res.status(400).json({ success: false, error: 'Nenhuma mensagem ou arquivo legível foi fornecido.' });
      return;
    }

    // Prepara o histórico da conversa para o Agente CRM
    const messagesForAgent: any[] = [...rawMessages];
    
    // Se a última mensagem já não for a mesma, inclui o turno do usuário
    const lastMsg = messagesForAgent[messagesForAgent.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userPromptContent) {
      messagesForAgent.push({
        role: 'user',
        content: userPromptContent
      });
    }

    // ETAPA 2: Execução da automação do Agente CRM
    const agentResult = await chatWithGoogleGemini(
      messagesForAgent,
      apiKey,
      customPrompt,
      customConstitution
    );

    res.json({
      success: true,
      mediaType,
      transcribedText: hasMedia ? transcribedText : undefined,
      userPromptContent,
      reply: agentResult.text,
      text: agentResult.text,
      model: agentResult.model,
      latencyMs: latencyMs + agentResult.latencyMs,
      toolUsed: agentResult.toolUsed
    });
  } catch (error: any) {
    console.error('[Chat Multimodal Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar mensagem multimodal com Agente IA.'
    });
  } finally {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CORPSA CRM Integration Server rodando na porta ${PORT}`);
});
