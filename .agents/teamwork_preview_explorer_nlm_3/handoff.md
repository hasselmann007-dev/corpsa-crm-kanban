# Handoff Report: R4 Session Persistence & History Architecture

**Investigator**: teamwork_preview_explorer (Persistence & History Investigator)  
**Date**: 2026-08-12  
**Target Module**: CORPSA CRM — Apuração de Renda (`src/components/ApuracaoRendaTab.tsx`)

---

## 1. Observation

### 1.1 LocalStorage Key Structures in CORPSA CRM
Direct analysis of the codebase reveals that CORPSA CRM relies on `localStorage` for client-side state persistence across multiple components:
- **`crm_apuracoes_renda_v1`** (`src/components/ApuracaoRendaTab.tsx:44`):
  - Stores a JSON stringified array of income audit session objects (`ApuracaoSessao[]`).
  - Read on component initialization (`src/components/ApuracaoRendaTab.tsx:118-129`).
  - Synchronized via React `useEffect` whenever `sessoes` state changes (`src/components/ApuracaoRendaTab.tsx:142-144`).
- **`widget_pendencias_visible`** (`src/App.tsx:147-149, 185-187`): Boolean flag (`'true'` / `'false'`) controlling the floating sticky notes widget visibility.
- **`widget_pendencias_items`** (`src/App.tsx:150-162, 188-190`): JSON stringified array of sticky notes (`StickyNote[]`) containing `id`, `text`, `completed`, and `createdAt` ISO timestamps.
- **`widget_pendencias_pos`** (`src/App.tsx:165-175, 191-193`): JSON stringified object `{ x: number, y: number }` preserving widget screen positioning.
- **`widget_pendencias_minimized`** (`src/App.tsx:176-178, 194-196`): Boolean flag storing minimized state.

### 1.2 Supabase Architecture & Existing Tables
- **Supabase Client**: Configured in `src/supabaseClient.ts:1-6` via `createClient` using `import.meta.env.VITE_SUPABASE_URL` (defaulting to `http://127.0.0.1:64321`) and `VITE_SUPABASE_ANON_KEY`.
- **Existing Schema**:
  - `public.leads` (`supabase/migrations/20260620224725_create_leads_table.sql`): Stores main Kanban leads (`id`, `data_hora_entrada`, `nome_cliente`, `cpf_cliente`, `valor_imovel`, `cidade`, `grupo_origem`, `informacoes_importantes`, `descricao_pendencia`, `resultado_analise`, `motivo_resultado`, `etapa`, `tipo_avaliacao`, `tipo_financiamento`, `categoria`, `adicionado_corpay`, `prioridade`).
  - `public.profiles` (`supabase/migrations/20260621171200_create_profiles_table.sql`): Maps `auth.users` to user details (`id`, `updated_at`, `nome_completo`, `cargo`).
- **Current Limitation**: No SQL table currently exists for `apuracoes_renda` in `supabase/migrations/`. Audit sessions exist exclusively in React local state and LocalStorage (`crm_apuracoes_renda_v1`).

### 1.3 State Stores & Data Flow
- **Package Inspection** (`package.json`): No external global state manager (such as Zustand, Redux, or Recoil) is installed. Dependencies include `@supabase/supabase-js`, `react` v19, `react-dom`, and `react-icons`.
- **State Pattern**: State is managed via idiomatic React hooks (`useState`, `useEffect`, `useCallback`) co-located within tab components (`ApuracaoRendaTab.tsx`) and root (`App.tsx`).

---

## 2. Logic Chain

### 2.1 From Observations to Architecture Requirements
1. **Dual-Layer Persistence Strategy**: To fulfill R4 requirement ("Preserve all uploaded files, consideration text, chat threads, and calculated income summaries per client audit session in CRM local/Supabase storage"), the CRM must support:
   - **Local Layer**: Fast initial render & offline capability using `localStorage` key `crm_apuracoes_renda_v1`.
   - **Cloud Layer**: Relational persistence in Supabase table `public.apuracoes_renda` to share audit history across assessors and persist across sessions/devices.
2. **Data Consistency & Schema Mapping**: The TypeScript interface `ApuracaoSessao` in `ApuracaoRendaTab.tsx` maps 1:1 to database columns and JSONB structures for nested chat messages and attached file metadata.

### 2.2 Proposed Persistent Audit Session Schema Design

#### TypeScript Interface (`src/components/ApuracaoRendaTab.tsx`)
```typescript
export interface ApuracaoArquivo {
  id: string;
  name: string;
  size: string;             // e.g. "1.2 MB"
  type: 'PDF' | 'Imagem' | 'Documento' | string;
  uploadedAt: string;       // Formatted date string or ISO timestamp
  mimeType?: string;        // e.g. "application/pdf"
  path?: string;            // Supabase Storage object path (if applicable)
  rawTextContent?: string;  // Extracted raw text cache for NotebookLM integration
}

export interface ApuracaoMensagem {
  id: string;
  sender: 'user' | 'system' | 'ai';
  text: string;
  timestamp: string;
  metadata?: {
    notebookId?: string;
    sourcesUsed?: string[];
    processingTimeMs?: number;
  };
}

export interface ApuracaoSessao {
  id: string;
  leadId?: string;                // Optional reference to public.leads.id
  userId?: string;                // Reference to auth.users.id
  nomeCliente: string;
  cpfCliente: string;
  status: 'Em Análise' | 'Concluída' | 'Pendente de Doc';
  dataCriacao: string;            // ISO 8601 timestamp
  dataAtualizacao: string;        // ISO 8601 timestamp
  regrasConsiderar: string;       // User rules for income addition
  regrasDesconsiderar: string;    // User rules for income deduction
  rendaBruta: number;             // Calculated gross income
  rendaLiquida: number;           // Calculated approved net income
  descontosDesconsiderados: number;// Sum of disregarded deductions
  capacidadePagamento: number;     // 30% margin payment capacity
  arquivos: ApuracaoArquivo[];
  mensagens: ApuracaoMensagem[];
}
```

#### Supabase Database Migration (`supabase/migrations/20260812000000_create_apuracoes_renda_table.sql`)
```sql
-- Create apuracoes_renda table
CREATE TABLE IF NOT EXISTS public.apuracoes_renda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome_cliente TEXT NOT NULL CHECK (char_length(trim(nome_cliente)) > 0),
    cpf_cliente TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em Análise' CHECK (status IN ('Em Análise', 'Concluída', 'Pendente de Doc')),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    regras_considerar TEXT DEFAULT '',
    regras_desconsiderar TEXT DEFAULT '',
    renda_bruta NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    renda_liquida NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    descontos_desconsiderados NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    capacidade_pagamento NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    arquivos JSONB DEFAULT '[]'::jsonb NOT NULL,
    mensagens JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE public.apuracoes_renda ENABLE ROW LEVEL SECURITY;

-- Development policy for public/authenticated access
CREATE POLICY "Allow all access to apuracoes_renda" ON public.apuracoes_renda
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Grant privileges
GRANT ALL PRIVILEGES ON TABLE public.apuracoes_renda TO postgres, anon, authenticated, service_role;
```

---

### 2.3 Execution Plan for History Sidebar (`ApuracaoRendaTab.tsx`)

1. **Hydration & Synchronization Lifecycle**:
   - **Initial Load**:
     1. Synchronously populate state from `localStorage.getItem('crm_apuracoes_renda_v1')`. If empty, fallback to `INITIAL_MOCK_SESSIONS`.
     2. Asynchronously query Supabase `apuracoes_renda` ordered by `data_atualizacao DESC`.
     3. Merge remote sessions into state (overwriting local items with matching `id` if remote `data_atualizacao` is newer).
   - **Persistence Strategy on Mutation**:
     - Whenever a session is created, modified (file added/removed, rules updated, chat message sent, NLM income calculated), update React `sessoes` state.
     - `useEffect` immediately serializes updated `sessoes` to LocalStorage.
     - Asynchronously upsert updated session to Supabase table `apuracoes_renda`.

2. **Session Selection & Deep Inspection**:
   - `selectedSessaoId` tracks active session ID.
   - Changing selection updates all right-hand panels instantly (Income Cards, File Manager, Considerations Textareas, Chat Thread).
   - If selected ID is deleted or missing, default to `filteredSessoes[0]`.

3. **Search & Real-time Filter Mechanism**:
   - Search input bound to `searchTerm` state.
   - Filter criteria:
     ```typescript
     const filteredSessoes = sessoes.filter(s => 
       s.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
       s.cpfCliente.includes(searchTerm) ||
       s.status.toLowerCase().includes(searchTerm.toLowerCase())
     );
     ```
   - Renders matching items with client name, status badge (`Concluída` green, `Em Análise` amber), CPF, doc count, and approved income preview.

---

## 3. Caveats

1. **LocalStorage Quota Limits (~5MB)**:
   - Storing raw binary file content (Base64) inside LocalStorage will quickly exceed the ~5MB browser limit.
   - *Mitigation*: Store file **metadata** (`name`, `size`, `type`, `uploadedAt`) and optional text extracts in LocalStorage. Store full binary files in browser `IndexedDB` or Supabase Storage bucket `apuracao-docs`.
2. **Supabase Connectivity Fallback**:
   - If Supabase environment variables are absent or the backend is offline, the system gracefully falls back 100% to LocalStorage persistence without throwing unhandled exceptions.
3. **Multi-User Merging**:
   - Concurrent edits to the same audit session across multiple browser tabs are synchronized by updating `data_atualizacao` and replacing full session objects.

---

## 4. Conclusion

- **Architecture Strategy**: CORPSA CRM requires a hybrid persistence architecture (LocalStorage for instant hydration/offline support + Supabase `public.apuracoes_renda` table for cloud persistence).
- **Schema Readiness**: The proposed `ApuracaoSessao` schema and SQL migration capture all 5 required domains (files metadata, considerations text, full chat thread, calculated summary metrics, and client audit timestamps).
- **UI Integration Plan**: The left sidebar in `ApuracaoRendaTab.tsx` provides seamless search, filtering, session switching, and creation capabilities supporting complete audit history workflows.

---

## 5. Verification Method

To independently verify this design and codebase compliance:

1. **Type & Compile Check**:
   Run TypeScript compiler check across the workspace:
   ```bash
   npm run build
   ```
2. **LocalStorage Verification**:
   Inspect browser DevTools -> Application -> Local Storage -> `crm_apuracoes_renda_v1` to verify JSON structure matches `ApuracaoSessao[]`.
3. **Database Migration Verification**:
   Validate SQL syntax by creating `supabase/migrations/20260812000000_create_apuracoes_renda_table.sql` and executing against Supabase CLI or pg_dump validation.
