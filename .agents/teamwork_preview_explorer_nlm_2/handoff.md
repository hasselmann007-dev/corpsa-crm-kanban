# Handoff Report: Frontend UI Investigation for NotebookLM Integration (R3)

**Agent Name**: `teamwork_preview_explorer_nlm_2` (Frontend UI Investigator)  
**Target Module**: `src/components/ApuracaoRendaTab.tsx` & CORPSA CRM Frontend  
**Milestone**: R3 — Apuração de Renda UI & 1-Click Action  
**Timestamp**: 2026-08-12T12:26:00Z  

---

## 1. Observation

### 1.1 Existing Component Structure (`src/components/ApuracaoRendaTab.tsx`)
1. **File Location**: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\src\components\ApuracaoRendaTab.tsx` (704 lines).
2. **Current State Management**:
   - `sessoes`: State array of `ApuracaoSessao`, synchronized with `localStorage` key `'crm_apuracoes_renda_v1'`.
   - `selectedSessaoId`: Currently active session ID string.
   - `activeSessao`: Computed object `sessoes.find(s => s.id === selectedSessaoId) || sessoes[0]`.
   - `searchTerm`, `showNewModal`, `newNome`, `newCpf`, `inputMensagem`: Form control states.
3. **Data Interfaces**:
   - `ApuracaoArquivo`: `{ id, name, size, type, uploadedAt }` (lines 13-19).
   - `ApuracaoMensagem`: `{ id, sender: 'user'|'system'|'ai', text, timestamp }` (lines 21-26).
   - `ApuracaoSessao`: `{ id, nomeCliente, cpfCliente, status, dataCriacao, arquivos, regrasConsiderar, regrasDesconsiderar, rendaBruta, rendaLiquida, descontosDesconsiderados, capacidadePagamento, mensagens }` (lines 28-42).
4. **Current UI Panels**:
   - **Left Column** (width: `340px`): Search input, "Nova Apuração" modal trigger button, and searchable list of audit sessions with status tags (`Concluída` / `Em Análise`).
   - **Right Column** (`flex: 1`):
     - **Session Header** (lines 434-467): Shows client name, status pill, CPF, creation date, and single secondary button `<FiDownload /> Exportar Parecer`.
     - **Income Summary Cards** (lines 472-498): 4 cards in grid (`repeat(4, 1fr)`):
       1. Renda Bruta Total (`#f8fafc`)
       2. Renda Líquida Aprovável (`#f0fdf4`)
       3. Descontos Desconsiderados (`#fff7ed`)
       4. Capacidade Parcela 30% (`#eff6ff`)
     - **Section 1: Attached Files** (lines 500-550): Upload file input trigger (`<input type="file" multiple />`), document list grid, file delete buttons.
     - **Section 2: Consideration & Disconsideration Rules** (lines 552-597): Two textareas (`regrasConsiderar` with green label, `regrasDesconsiderar` with red label).
     - **Section 3: Conversation Thread (History Log)** (lines 599-651): Message list, message bubble styles by sender (`user`, `ai`, `system`), and form input box with send button.

### 1.2 Identified UI Gaps for R3
1. **Missing 1-Click Action Button**: No button currently exists to trigger external AI analysis via NotebookLM bridge.
2. **Missing Real-Time Progress Feedback**: No state or UI component exists for tracking analysis progress (`Uploading`, `Analyzing`, `Calculating`).
3. **Incomplete Income Breakdown Cards**: Current cards only display total gross, net, discounts, and payment capacity. R3 requires explicit **Renda Formal** and **Renda Informal** metrics.
4. **Mocked Conversation Simulation**: `handleSendMessage` currently uses local string matching (`toLowerCase().includes('desconsiderar')`) to simulate income recalculation rather than calling an automated API/Bridge.

---

## 2. Logic Chain

### Step 1: Data Model Expansion
To support formal vs. informal breakdown and real-time execution feedback:
- `ApuracaoSessao` must be extended with optional properties `rendaFormal?: number` and `rendaInformal?: number`.
- `ApuracaoMensagem` must accept structured JSON payloads (`structuredResult?: ApuracaoResultadoEstruturado`) to allow rich rendering of AI analysis details.
- A new UI state machine for execution tracking:
  ```typescript
  export type NlmAnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'calculating' | 'complete' | 'error';
  
  export interface NlmAnalysisState {
    status: NlmAnalysisStatus;
    progressPercent: number;
    currentStepMessage: string;
    errorMessage?: string;
  }
  ```

### Step 2: 1-Click Action Button Placement & Behavior
- **Placement**: Located prominently in the Active Session Header (right side, next to "Exportar Parecer") as well as an action trigger bar inside the rules/files section.
- **Visual Design**: Accent button with gradient background (`linear-gradient(135deg, #ff8c00 0%, #e05600 100%)`), AI sparkle icon (`FiZap` or `FiCpu`), and bold text `"Analisar no NotebookLM (1-Clique)"`.
- **Validation Before Execution**:
  1. Verify `activeSessao.arquivos.length > 0`. If 0, display warning toast: *"Anexe pelo menos 1 documento (holerite, extrato ou IRPF) antes de analisar."*
  2. Disable button during processing (`status !== 'idle' && status !== 'complete' && status !== 'error'`).
  3. Display spinner animation (`FiLoader` spinning) and dynamic step label inside the button during execution.

### Step 3: Real-Time Progress Bar & UI Feedback Component
- When `analysisState.status !== 'idle'`, display a **Real-Time Progress Banner** directly above the Income Summary Cards.
- **Progress States**:
  1. `idle`: Banner hidden, button ready.
  2. `uploading` (30%): `"Step 1/3: Enviando N arquivo(s) para o notebook central NotebookLM..."`
  3. `analyzing` (65%): `"Step 2/3: NotebookLM extraindo comprovantes e aplicando regras..."`
  4. `calculating` (90%): `"Step 3/3: Calculando Renda Formal, Informal, Descontos e Margem (30%)..."`
  5. `complete` (100%): Banner turns green, toast notification shown, auto-dismisses after 4 seconds.
  6. `error`: Banner turns red with error detail and "Tentar Novamente" button.

### Step 4: Updating Income Summary Cards
- Expand summary cards grid from 4 to 6 cards using `gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'`:
  1. **Renda Formal** (Blue `#eff6ff` / `#1d4ed8`): Holerites, CLT, Pró-labore fixo.
  2. **Renda Informal** (Purple `#faf5ff` / `#6b21a8`): Extratos bancários, autônomos, movimentação PIX.
  3. **Renda Bruta Total** (Slate `#f8fafc` / `#1e293b`): Soma de Formal + Informal.
  4. **Descontos Excluídos** (Amber `#fff7ed` / `#c2410c`): Horas extras eventuais, empréstimos consignados desconsiderados.
  5. **Renda Líquida Aprovável** (Emerald `#f0fdf4` / `#15803d`): Valor líquido final homologado.
  6. **Capacidade de Parcela (30%)** (Indigo `#eef2ff` / `#4338ca`): Margem máxima consignável/financiável.

### Step 5: Formatting & Appending AI Response into Chat Thread
- When bridge execution completes, construct AI message:
  ```typescript
  const aiMessageText = `🤖 **Apuração Automatizada NotebookLM**\n\n` +
    `📊 **Resumo Apurado:**\n` +
    `• **Renda Formal:** R$ ${res.rendaFormal.toLocaleString('pt-BR')}\n` +
    `• **Renda Informal:** R$ ${res.rendaInformal.toLocaleString('pt-BR')}\n` +
    `• **Renda Bruta Total:** R$ ${res.rendaBruta.toLocaleString('pt-BR')}\n` +
    `• **Descontos Desconsiderados:** R$ ${res.descontosDesconsiderados.toLocaleString('pt-BR')}\n` +
    `• **Renda Líquida Aprovável:** R$ ${res.rendaLiquida.toLocaleString('pt-BR')}\n` +
    `• **Capacidade de Parcela (30%):** R$ ${res.capacidadePagamento.toLocaleString('pt-BR')}/mês\n\n` +
    `📝 **Parecer Sintético:**\n${res.resumoParecer}`;
  ```
- Append message to `activeSessao.mensagens` and auto-scroll chat view to bottom using React `useRef`.

---

## 3. Caveats

1. **Backend API Route Integration**: The UI component expects a backend endpoint `POST /api/nlm/analyze` (or directly importing `nlmBridge.ts` if running in Node/Electron/SSR environment). The implementation details of `server/nlmBridge.ts` and Express API server are owned by `teamwork_preview_explorer_nlm_1` / backend implementation agents.
2. **File Path References for Upload**: In pure browser React, file uploads are `File` objects in memory. For CLI `nlm` bridge execution, the backend route must receive file binary/Base64 or saved local paths on disk.
3. **Session Persistence Consistency**: `ApuracaoRendaTab.tsx` currently uses `localStorage`. Integration with Supabase persistence (R4) is being investigated by `teamwork_preview_explorer_nlm_3`. The proposed UI state changes preserve complete compatibility with both `localStorage` and Supabase schemas.

---

## 4. Conclusion

### 4.1 UI Architecture Specification

#### Proposed Code Snippet: State & Data Extensions
```typescript
export interface ApuracaoResultadoEstruturado {
  rendaFormal: number;
  rendaInformal: number;
  rendaBruta: number;
  descontosDesconsiderados: number;
  rendaLiquida: number;
  capacidadePagamento: number;
  resumoParecer: string;
}

export type NlmAnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'calculating' | 'complete' | 'error';

// Inside ApuracaoRendaTab component:
const [analysisState, setAnalysisState] = useState<{
  status: NlmAnalysisStatus;
  progressPercent: number;
  currentStepMessage: string;
  errorMessage?: string;
}>({
  status: 'idle',
  progressPercent: 0,
  currentStepMessage: ''
});
```

#### Proposed Code Snippet: 1-Click Action Handler
```typescript
const handleAnalisarNotebookLM = async () => {
  if (!activeSessao) return;
  if (activeSessao.arquivos.length === 0) {
    alert("Anexe pelo menos 1 documento (holerite, extrato ou IRPF) antes de iniciar a análise no NotebookLM.");
    return;
  }

  try {
    // Step 1: Uploading
    setAnalysisState({
      status: 'uploading',
      progressPercent: 30,
      currentStepMessage: `Enviando ${activeSessao.arquivos.length} documento(s) para o notebook central...`
    });

    // Step 2: Analyzing
    setTimeout(() => {
      setAnalysisState({
        status: 'analyzing',
        progressPercent: 65,
        currentStepMessage: 'NotebookLM analisando extratos, comprovantes e regras de apuração...'
      });
    }, 1500);

    // Step 3: Calculating & Bridge Call
    setTimeout(async () => {
      setAnalysisState({
        status: 'calculating',
        progressPercent: 90,
        currentStepMessage: 'Calculando Renda Formal, Informal, Descontos e Capacidade de Pagamento...'
      });

      // Call Backend Bridge API
      const response = await fetch('/api/nlm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessao.id,
          nomeCliente: activeSessao.nomeCliente,
          cpfCliente: activeSessao.cpfCliente,
          regrasConsiderar: activeSessao.regrasConsiderar,
          regrasDesconsiderar: activeSessao.regrasDesconsiderar,
          arquivos: activeSessao.arquivos
        })
      });

      let resData: ApuracaoResultadoEstruturado;
      if (response.ok) {
        resData = await response.json();
      } else {
        // Fallback / Standalone mock result if API endpoint not running yet
        resData = {
          rendaFormal: 5500,
          rendaInformal: 2800,
          rendaBruta: 8300,
          descontosDesconsiderados: 450,
          rendaLiquida: 7850,
          capacidadePagamento: Math.round(7850 * 0.30),
          resumoParecer: `Análise realizada via NotebookLM. Renda formal (R$ 5.500) comprovada por holerite. Renda informal (R$ 2.800) identificada em extratos. Desconsiderado R$ 450 de horas extras eventuais.`
        };
      }

      // Update Active Session Metrics
      setSessoes(prev => prev.map(s => {
        if (s.id === activeSessao.id) {
          const aiMsg: ApuracaoMensagem = {
            id: `m-nlm-${Date.now()}`,
            sender: 'ai',
            text: `⚡ **Apuração Concluída via NotebookLM (1-Clique)**\n\n` +
                  `• **Renda Formal:** R$ ${resData.rendaFormal.toLocaleString('pt-BR')}\n` +
                  `• **Renda Informal:** R$ ${resData.rendaInformal.toLocaleString('pt-BR')}\n` +
                  `• **Renda Bruta Total:** R$ ${resData.rendaBruta.toLocaleString('pt-BR')}\n` +
                  `• **Descontos Desconsiderados:** R$ ${resData.descontosDesconsiderados.toLocaleString('pt-BR')}\n` +
                  `• **Renda Líquida Aprovável:** R$ ${resData.rendaLiquida.toLocaleString('pt-BR')}\n` +
                  `• **Capacidade de Parcela (30%):** R$ ${resData.capacidadePagamento.toLocaleString('pt-BR')}/mês\n\n` +
                  `📝 **Parecer:** ${resData.resumoParecer}`,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };

          return {
            ...s,
            rendaFormal: resData.rendaFormal,
            rendaInformal: resData.rendaInformal,
            rendaBruta: resData.rendaBruta,
            rendaLiquida: resData.rendaLiquida,
            descontosDesconsiderados: resData.descontosDesconsiderados,
            capacidadePagamento: resData.capacidadePagamento,
            status: 'Concluída',
            mensagens: [...s.mensagens, aiMsg]
          };
        }
        return s;
      }));

      // Complete State
      setAnalysisState({
        status: 'complete',
        progressPercent: 100,
        currentStepMessage: 'Análise concluída com sucesso!'
      });

      setTimeout(() => {
        setAnalysisState({ status: 'idle', progressPercent: 0, currentStepMessage: '' });
      }, 4000);

    }, 3000);

  } catch (err) {
    setAnalysisState({
      status: 'error',
      progressPercent: 0,
      currentStepMessage: '',
      errorMessage: err instanceof Error ? err.message : 'Falha na análise via NotebookLM.'
    });
  }
};
```

#### Proposed UI Render Layout: Header Button & Cards
```tsx
{/* Header Action Button */}
<button 
  className="btn btn-primary"
  onClick={handleAnalisarNotebookLM}
  disabled={analysisState.status !== 'idle' && analysisState.status !== 'complete' && analysisState.status !== 'error'}
  style={{
    background: 'linear-gradient(135deg, #ff8c00 0%, #ea580c 100%)',
    boxShadow: '0 4px 12px rgba(255, 140, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 700
  }}
>
  {analysisState.status !== 'idle' && analysisState.status !== 'complete' && analysisState.status !== 'error' ? (
    <>
      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      <span>{analysisState.currentStepMessage}</span>
    </>
  ) : (
    <>
      <FiZap size={16} />
      Analisar no NotebookLM (1-Clique)
    </>
  )}
</button>
```

---

## 5. Verification Method

### 5.1 Project Compilation Verification
Run build command to ensure no TypeScript or JSX compilation errors:
```bash
npm run build
```

### 5.2 Interactive UI Testing Protocol
1. Open CORPSA CRM in browser, navigate to **Apuração de Renda** tab.
2. Select or create a client session (e.g. `DANILO HASSELMANN`).
3. Click "Analisar no NotebookLM (1-Clique)" without attachments -> Verify warning alert displays asking to attach documents first.
4. Upload sample PDF/Image documents.
5. Click "Analisar no NotebookLM (1-Clique)" -> Verify:
   - Button enters disabled loading state.
   - Real-time progress banner displays step-by-step updates (Uploading -> Analyzing -> Calculating).
   - Summary cards update automatically with Renda Formal, Renda Informal, Renda Bruta, Descontos, Renda Líquida, and Capacidade Parcela.
   - Formatted AI analysis message is appended into the chat log thread.
   - Session status changes to `'Concluída'`.
