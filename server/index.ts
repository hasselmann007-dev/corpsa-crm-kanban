import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getNlmStatus, analyzeDocuments } from './nlmBridge.js';

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

const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const regrasConsiderar = req.body.regrasConsiderar || req.body.considerationText || '';
    const regrasDesconsiderar = req.body.regrasDesconsiderar || req.body.disregardText || '';

    // Map uploaded files
    const fileItems = uploadedFiles.map((f) => ({
      path: f.path,
      originalname: f.originalname,
      filename: f.filename,
      mimetype: f.mimetype
    }));

    // Support JSON array of filePaths if sent directly in req.body
    if (fileItems.length === 0 && Array.isArray(req.body.filePaths)) {
      for (const p of req.body.filePaths) {
        if (typeof p === 'string') {
          fileItems.push({ path: p });
        }
      }
    }

    const result = await analyzeDocuments({
      files: fileItems,
      regrasConsiderar,
      regrasDesconsiderar
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Erro no processamento do NotebookLM:', error);

    const errorMessage = error.message || '';
    if (
      errorMessage.includes('AUTH_REQUIRED') ||
      errorMessage.includes('nlm login') ||
      errorMessage.includes("Profile 'default' not found") ||
      error.statusCode === 401
    ) {
      res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: "Conexão com Google NotebookLM não autenticada. Execute 'nlm login' no terminal para autenticar."
      });
      return;
    }

    if (errorMessage.includes('CLI_NOT_FOUND')) {
      res.status(500).json({
        success: false,
        error: 'CLI_NOT_FOUND',
        message: "O utilitário 'notebooklm-mcp-cli' (nlm) não foi encontrado no sistema."
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'ANALYSIS_FAILED',
      message: errorMessage || 'Falha ao processar análise no NotebookLM.'
    });
  } finally {
    // Cleanup temporary files uploaded to disk
    for (const f of uploadedFiles) {
      if (f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          // ignore cleanup errors
        }
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CORPSA CRM NotebookLM Bridge rodando na porta ${PORT}`);
});
