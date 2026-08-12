# HANDOFF REPORT — CLI & Backend Bridge Investigation for NotebookLM Integration

**Agent**: teamwork_preview_explorer (CLI & Backend Bridge Investigator)  
**Date**: 2026-08-12  
**Target Project**: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban`  

---

## 1. Observation

### 1.1 System & CLI Environment
- **Operating System**: Windows (PowerShell environment)
- **Python**: Installed (`Python 3.11.9`)
- **`uv` Package Manager**: Installed (`uv 0.11.26`)
- **`notebooklm-mcp-cli` Installation**: Executed `uv tool install notebooklm-mcp-cli`.
  - Installed 2 executables: `nlm.exe` and `notebooklm-mcp.exe`
  - Version: `notebooklm-mcp-cli 0.9.10`
- **CLI Availability**: `nlm --help` runs successfully directly from PATH with exit code 0.
- **Authentication Diagnostics**: Running `nlm notebook list --json` when unauthenticated returns exit code 1 with exact stderr:
  ```text
  Error: Profile 'default' not found. Run 'nlm login' first.
  ```

### 1.2 Existing Project & Server Architecture
- **`package.json`**:
  - React 19 + TypeScript + Vite 8 single-page application (`"type": "module"`).
  - Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `test` (`tsx src/parseTest.ts && tsx src/slaTest.ts`).
  - Dependencies: `@supabase/supabase-js`, `react`, `react-dom`, `react-icons`.
  - Dev Dependencies: `@types/node`, `typescript`, `vite`, `eslint`, `globals`.
- **Backend Infrastructure**: Currently **no Express or Node backend server** exists in the repo. The app runs purely client-side in browser.
- **Vite Config (`vite.config.ts`)**: Minimal configuration with standard React plugin.
- **UI (`src/components/ApuracaoRendaTab.tsx`)**:
  - Manages client income audit sessions stored in `localStorage` under key `crm_apuracoes_renda_v1`.
  - Currently contains mock simulation state for files, consideration rules, calculation summaries (Renda Bruta, Renda Líquida, Descontos Desconsiderados, Capacidade Parcela 30%), and chat thread.

---

## 2. Logic Chain

1. **Client-Side vs System CLI Constraint**:
   - The browser React app (`ApuracaoRendaTab.tsx`) cannot execute host OS terminal commands (`nlm`) directly due to browser sandbox security.
   - Therefore, a lightweight local Node/Express backend bridge (`server/index.ts` & `server/nlmBridge.ts`) or Vite dev server middleware API is required to expose an HTTP endpoint (e.g., `POST /api/nlm/analyze`).

2. **`notebooklm-mcp-cli` Subcommand Capabilities & Verification**:
   - `nlm notebook list --json`: Lists user notebooks. Used to search for the central notebook `"Apuração de Renda CORPSA"`.
   - `nlm notebook create "Apuração de Renda CORPSA" --json`: Creates central notebook if it doesn't exist, returning JSON with `{ id, title }`.
   - `nlm source list <notebook_id> --json`: Returns current source list with `{ id, title }`.
   - `nlm source delete <id1> <id2> ... --confirm --json`: Clears old sources before analyzing new files.
   - `nlm source add <notebook_id> --file "<filepath>" --wait --json`: Uploads local documents (PDF, PNG, JPG, TXT) and waits (`--wait`) for NotebookLM processing to complete.
   - `nlm query notebook <notebook_id> "<prompt>" --json`: Sends structured analysis queries to NotebookLM sources and returns AI output and citations in JSON.

3. **`server/nlmBridge.ts` Execution Pipeline Specification**:
   - **Step 1: Ensure Central Notebook**:
     Check if `"Apuração de Renda CORPSA"` exists via `nlm notebook list --json`. If found, use its ID. Otherwise create it via `nlm notebook create "Apuração de Renda CORPSA" --json`.
   - **Step 2: Clear Stale Sources**:
     Call `nlm source list <notebook_id> --json`. If source list is non-empty, run `nlm source delete <id_list> --confirm --json` so past audit files don't pollute current client calculation.
   - **Step 3: Upload Documents**:
     Save uploaded files temporarily to `server/uploads/temp_<timestamp>_<filename>`. Call `nlm source add <notebook_id> --file "<filepath>" --wait --json` for each file.
   - **Step 4: Formulate Audit Prompt**:
     Construct a financial audit prompt including rules to consider/ignore:
     ```text
     Você é um auditor financeiro sênior da CORPSA CRM especialista em apuração de renda para crédito imobiliário.
     Analise todos os documentos fornecidos nesta sessão.
     REGRAS DE CONSIDERAÇÃO DO CORRETOR:
     [Considerar]: ${regrasConsiderar}
     [Desconsiderar]: ${regrasDesconsiderar}

     REQUISITOS DA RESPOSTA:
     Calcule os valores mensais brutos, líquidos e descontos ignorados conforme as regras.
     Retorne OBRIGATORIAMENTE um bloco JSON valido no seguinte formato:
     ```json
     {
       "rendaBruta": number,
       "rendaLiquida": number,
       "descontosDesconsiderados": number,
       "capacidadePagamento": number,
       "rendaFormal": number,
       "rendaInformal": number,
       "parecer": "Texto detalhado explicando cada holerite/extrato..."
     }
     ```
   - **Step 5: Execute & Parse Response**:
     Call `nlm query notebook <notebook_id> "<prompt>" --json`. Parse JSON block from response text. Return structured JSON payload to CRM frontend.

---

## 3. Caveats

1. **Authentication State**:
   - If the user has not logged into NotebookLM via CLI, `nlm` returns `Error: Profile 'default' not found. Run 'nlm login' first.`.
   - The backend bridge must catch non-zero exit codes or stderr containing `"nlm login"` and return `{ error: "AUTH_REQUIRED", message: "Execute 'nlm login' no terminal para conectar sua conta do Google NotebookLM." }`.
2. **File Handling**:
   - Express needs `express.json()` and multipart body parser (or `multer` / `formidable` / base64 body) to process file uploads from React UI to disk before passing file paths to `nlm source add`.
3. **Execution Timeout**:
   - Uploading multiple large PDFs and running AI queries can take 15–45 seconds. The Express endpoint and frontend fetch request must set a timeout of at least 60–120 seconds.
4. **Local Development Setup**:
   - `express` and `@types/express`, `cors`, `@types/cors`, `multer`, `@types/multer` (or built-in node handling) should be added to `package.json`.
   - A dev start script `"dev": "concurrently \"vite\" \"tsx server/index.ts\""` or Vite dev server proxy (`/api` -> `http://localhost:3001`) will ensure 1-click seamless operation.

---

## 4. Conclusion

The CLI environment (`Python`, `uv`, `notebooklm-mcp-cli` / `nlm`) is fully installed and verified on the host Windows machine. A clear, robust architecture for `server/nlmBridge.ts` and Express backend server has been designed. 

### Recommended Architecture & Implementation Plan:

1. **Setup Express Backend Bridge (`server/index.ts` & `server/nlmBridge.ts`)**:
   - Port: `3001` (or dynamic).
   - Endpoints:
     - `GET /api/nlm/status`: Checks if `nlm` is installed and authenticated (`nlm notebook list --json`).
     - `POST /api/nlm/analyze`: Handles document uploads, central notebook lookup/creation, source cleanup, file uploads, query execution, and structured result extraction.
2. **Update `vite.config.ts`**:
   - Add proxy rule: `/api` -> `http://localhost:3001`.
3. **Update `ApuracaoRendaTab.tsx`**:
   - Add **"Analisar no NotebookLM (1-Clique)"** button with animated progress phases (`Uploading`, `Analyzing`, `Calculating`).
   - Trigger `POST /api/nlm/analyze` with session files and consideration rules.
   - Automatically update Renda Bruta, Renda Líquida, Descontos Desconsiderados, Capacidade Parcela (30%), and add AI analysis report to the conversation history thread.

---

## 5. Verification Method

### 5.1 CLI Environment Verification
Run terminal command:
```powershell
python --version
uv --version
nlm --help
```
**Expected**: Output displays Python 3.11+, uv version, and full `nlm` usage manual without errors.

### 5.2 Authentication Verification
Run terminal command:
```powershell
nlm notebook list --json
```
- If authenticated: Returns JSON array of notebooks.
- If not authenticated: Returns `Error: Profile 'default' not found. Run 'nlm login' first.`. Run `nlm login` in terminal to authenticate.

### 5.3 Project Compilation & Build Verification
Run terminal command:
```powershell
npm run build
```
**Expected**: TypeScript compilation succeeds (`tsc -b`) and Vite packages bundle without build errors.
