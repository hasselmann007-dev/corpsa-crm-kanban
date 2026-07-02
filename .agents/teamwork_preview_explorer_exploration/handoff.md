# Handoff Report: CRM Codebase Exploration

This report details the findings from exploring the CORPSA CRM codebase, covering lead creation logic, database schema, card click interaction, board refresh flow, and testing recommendations.

## 1. Observation

### Lead Creation Logic in `src/App.tsx`
* **Form State:** Managed by `newLead` state variable (lines 117-125):
  ```typescript
  const [newLead, setNewLead] = useState({
    nome_cliente: '',
    cpf_cliente: '',
    valor_imovel: '',
    cidade: '',
    grupo_origem: '',
    informacoes_importantes: '',
    prioridade: 'Baixa'
  });
  ```
* **Validation:** Located in `validateAddForm` (lines 383-404):
  * Verifies non-empty client name (`nome_cliente`).
  * Validates CPF format: removes non-digits (must be 11 digits) and runs regex check `/^\d{3}\.\d{3}\.\d{3}-\d{2}$/` on raw string.
  * Validates property value (`valor_imovel`): must be greater than R$ 0,00.
  * Verifies non-empty city (`cidade`) and origin group (`grupo_origem`).
* **Supabase Insert:** Handled inside `handleAddLeadSubmit` (lines 411-420):
  ```typescript
  const { error } = await supabase.from('leads').insert({
    nome_cliente: newLead.nome_cliente.trim(),
    cpf_cliente: newLead.cpf_cliente,
    valor_imovel: parseCurrency(newLead.valor_imovel),
    cidade: newLead.cidade.trim(),
    grupo_origem: newLead.grupo_origem.trim(),
    informacoes_importantes: newLead.informacoes_importantes.trim() || null,
    etapa: 'Roleta',
    prioridade: newLead.prioridade || 'Baixa'
  });
  ```

---

### Database Schema (from `supabase/migrations/`)
* **Primary Migration File:** `supabase/migrations/20260620224725_create_leads_table.sql`
* **Schema Definition:**
  * `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
  * `data_hora_entrada` TIMESTAMP WITH TIME ZONE DEFAULT `timezone('utc'::text, now()) NOT NULL`
  * `nome_cliente` TEXT NOT NULL CHECK (`char_length(trim(nome_cliente)) > 0`)
  * `cpf_cliente` TEXT NOT NULL CHECK (`cpf_cliente ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$'`)
  * `valor_imovel` NUMERIC(15, 2) NOT NULL CHECK (`valor_imovel >= 0`)
  * `cidade` TEXT NOT NULL CHECK (`char_length(trim(cidade)) > 0`)
  * `grupo_origem` TEXT NOT NULL CHECK (`char_length(trim(grupo_origem)) > 0`)
  * `informacoes_importantes` TEXT NULL
  * `descricao_pendencia` TEXT NULL
  * `resultado_analise` TEXT CHECK (`resultado_analise IN ('Aprovado', 'Condicionado', 'Reprovado', 'Segue Pendente de Documento')`)
  * `motivo_resultado` TEXT NULL
  * `etapa` TEXT NOT NULL DEFAULT `'Roleta'` CHECK (`etapa IN ('Roleta', 'Pendencia', 'Analise', 'Conclusao')`)
  * `tipo_avaliacao` TEXT CHECK (`tipo_avaliacao IN ('Reavaliação', 'Nova Avaliação')`) *(added in migration `20260620234554_add_corpay_fields.sql`)*
  * `tipo_financiamento` TEXT CHECK (`tipo_financiamento IN ('SBPE', 'MCMV')`) *(added in migration `20260620234554_add_corpay_fields.sql`)*
  * `adicionado_corpay` BOOLEAN NOT NULL DEFAULT `false` *(added in migration `20260620234554_add_corpay_fields.sql`)*
  * `categoria` TEXT NULL *(added in migration `20260620235000_add_categoria_field.sql`)*
  * `prioridade` TEXT DEFAULT `'Baixa'` CHECK (`prioridade IN ('Baixa', 'Média', 'Alta')`) *(added in migration `20260622203400_add_prioridade_column.sql`)*
* **Table Constraints:**
  * `chk_descricao_pendencia`: `CHECK (etapa != 'Pendencia' OR (descricao_pendencia IS NOT NULL AND char_length(trim(descricao_pendencia)) > 0))`
  * `chk_resultado_analise`: `CHECK (etapa != 'Analise' OR (resultado_analise IS NOT NULL))`
  * `chk_motivo_resultado`: `CHECK (resultado_analise NOT IN ('Condicionado', 'Reprovado') OR (motivo_resultado IS NOT NULL AND char_length(trim(motivo_resultado)) > 0))`

---

### Card Click / View Details Modal
* **Click Trigger:** Managed in rendering loop in `src/App.tsx` (line 1206):
  ```typescript
  onClick={() => handleCardClick(lead)}
  ```
* **State Variables:**
  * `selectedLead` (type `Lead | null`): Controls modal rendering. If non-null, the edit modal renders (line 1498: `{selectedLead && ( ... )}`).
  * `editForm` (type object): Holds editable fields. Initialized during click (lines 567-581):
    ```typescript
    setEditForm({
      nome_cliente: lead.nome_cliente,
      cpf_cliente: lead.cpf_cliente,
      valor_imovel: formatCurrency((lead.valor_imovel * 100).toFixed(0)),
      cidade: lead.cidade,
      grupo_origem: lead.grupo_origem,
      informacoes_importantes: lead.informacoes_importantes || '',
      descricao_pendencia: lead.descricao_pendencia || '',
      resultado_analise: lead.resultado_analise || '',
      motivo_resultado: lead.motivo_resultado || '',
      tipo_avaliacao: lead.tipo_avaliacao || '',
      tipo_financiamento: lead.tipo_financiamento || '',
      categoria: lead.categoria || '',
      prioridade: lead.prioridade || 'Baixa'
    });
    ```
  * `editFormErrors` (type `Record<string, string>`): Manages validation errors during editing.

---

### Board Refresh Logic
* **State Variable:** `leads` (type `Lead[]`, initialized at line 50).
* **Refresh Function:** `fetchLeads` (lines 327-342):
  ```typescript
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('data_hora_entrada', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar leads.', 'error');
    } finally {
      setLoading(false);
    }
  };
  ```
* **Insert/Refresh Sequence:** Inside `handleAddLeadSubmit` (lines 406-439), after successful insert, it executes `fetchLeads()` which updates the `leads` state and automatically triggers a React re-render of the columns.

---

### Programmatic Testing & Environment (`package.json`)
* **Environment Context:**
  * Running React 19 and Vite 8.
  * Project package target type is `"type": "module"`.
  * TypeScript 6 is configured via references `tsconfig.app.json` (for `src/`) and `tsconfig.node.json` (for configuration files).
  * `supabaseClient.ts` uses `import.meta.env`, which fails in standard Node.js without bundlers.

---

## 2. Logic Chain

1. **Lead Creation & Board Refresh Link:** Leads are created by inserting data directly into Supabase via `handleAddLeadSubmit`. This function calls `fetchLeads()` upon completion, which performs a select query and calls `setLeads()`, updating the state and refreshing the board.
2. **Card Open Flow:** Clicking a card triggers `handleCardClick(lead)`, setting the state variable `selectedLead` to the lead object. This state change displays the view/edit modal. To automatically open the newly created lead, the application must programmaticly trigger `handleCardClick` with the newly inserted lead. To do so, the insert logic in `handleAddLeadSubmit` must return the inserted row (using Supabase `.select()` chained to `.insert()`) and set the `selectedLead` to the returned lead object.
3. **Execution of `src/parseTest.ts`:** Since Node.js does not natively execute TypeScript modules without a loader and `import.meta.env` is restricted to Vite, any testing script (e.g. `src/parseTest.ts`) must:
   * Run via a loader that compiles TypeScript on-the-fly and supports ES modules (such as `tsx`).
   * Avoid importing browser-specific globals or `src/supabaseClient.ts` to keep the testing script decoupled from Vite's runtime context.

---

## 3. Caveats

* The RLS policies on the database currently allow public read/write access for development (`Allow all public access for dev`).
* No automated test suite (like Vitest or Jest) is currently installed in `package.json`.

---

## 4. Conclusion

1. **Lead Creation Modification:** The implementation agent should replace the manual fields in the "Cadastrar Novo Lead" modal with a single `textarea`. On submit, the raw text should be parsed by the parser engine, and saved to Supabase under `'Roleta'` stage.
2. **Detail Modal Auto-open:** To automatically open the detail modal after lead creation, modify `handleAddLeadSubmit` to return the created lead using `.select().single()` from Supabase:
   ```typescript
   const { data, error } = await supabase.from('leads').insert({ ... }).select().single();
   if (data) {
     handleCardClick(data);
   }
   ```
3. **Parser Extraction and Isolation:** To test the parsing engine programmatically without build errors, place the parser functions in `src/utils/parser.ts` (pure functions with no database or Vite global variables) and run the test using `tsx`.

---

## 5. Verification Method

* Run Vite compilation to verify build:
  ```powershell
  npm run build
  ```
* Run the parser test suite using `npx tsx`:
  ```powershell
  npx tsx src/parseTest.ts
  ```
