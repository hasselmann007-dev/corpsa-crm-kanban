# Project Plan: Quick Lead Creation Text Processing Engine

## Objectives
1. Build a text parsing engine in `src/utils/parser.ts` to extract CPF, Valor do Imóvel, Analista, Grupo de Origem, Nome do Cliente, and Serviço & Notes from raw text inputs.
2. Build an automated validation test script `src/parseTest.ts` validating scenarios using `tsx`.
3. Replace the manual input form fields in the "Cadastrar Novo Lead" modal in `src/App.tsx` with a single textarea for raw text pasting.
4. Integrate frontend with the parser: submit parsed results directly to Supabase (`etapa = 'Roleta'`, `prioridade = 'Baixa'`), refresh the Kanban board, and automatically trigger the edit/detail modal of the newly created card.

---

## Detailed Step-by-Step Implementation Steps

### Phase 1: Text Parsing Engine Implementation (Milestone 2)
1. **Define Parser Interface:** Create `src/utils/parser.ts`.
2. **Implement Regular Expressions & Parsing Rules:**
   - **Date (`DD/MM`):** Match format `\d{2}/\d{2}`. Construct ISO timestamp using year 2026.
   - **CPF:** Extract 11 consecutive digits and format as `000.000.000-00`.
   - **Analista Responsável:** Word starting with `@` (e.g. `@Danilo`). Strip `@`.
   - **Grupo de Origem:** Match against known channels (like whatsapp names or groups) or default to a fallback.
   - **Valor do Imóvel:** Extract numeric pattern followed by `k` or `M` (e.g. `250k` -> `250000.00`, `1.5M` -> `1500000.00`).
   - **Nome do Cliente:** Find UPPERCASE word chain (e.g. `DANILO HASSELMANN`). Exclude system keywords or common terms if necessary.
   - **Serviço & Notes:** Identify service terms (e.g., "AVALIAÇÃO"). Extract the rest of the text as notes.
   - **Default Cidade:** The database `cidade` column is NOT NULL. Since it's not explicitly parsed, we will default it to `"Não Informada"` (or parse if present, but default satisfies requirements).
   - **Format `informacoes_importantes`:** Combine Analyst, Service, and Notes together as specified.
3. **Verify compilation:** Ensure `src/utils/parser.ts` compiles cleanly.

### Phase 2: Programmatic Validation Script (Milestone 3)
1. **Create Test File:** `src/parseTest.ts`.
2. **Scenarios:** Include multiple mock text blocks representing standard inputs, edge cases (missing fields, different capitalization, numbers format), and assert exact outputs.
3. **Run Test:** Execute `npx tsx src/parseTest.ts` to assert correctness.

### Phase 3: UI Integration (Milestone 4)
1. **Modify App.tsx UI:**
   - Find the "Cadastrar Novo Lead" modal rendering in `src/App.tsx` (around lines 1300-1410).
   - Replace the manual text fields with a single `textarea` labeled "Criação Rápida via Texto".
   - Maintain the submit button.
2. **Modify App.tsx Submission Logic:**
   - Update `handleAddLeadSubmit` to run the parsing function on the textarea input.
   - Insert the parsed lead object into Supabase:
     - Set stage (`etapa`) to `'Roleta'`.
     - Set priority (`prioridade`) to `'Baixa'`.
     - Return the inserted row using `.select().single()`.
   - On successful insertion:
     - Close the modal.
     - Call `fetchLeads()` to reload the board.
     - Automatically open the edit/detail modal of the newly created card by calling `handleCardClick` with the returned lead record.
3. **Verify Build:** Run `npm run build` to ensure no TypeScript or Vite compiler errors exist.

### Phase 4: E2E Verification & Auditing (Milestone 5)
1. **Testing:** Verify the validation tests and frontend behavior.
2. **Challenger Run:** Spawn a Challenger subagent to run stress-testing on the parser.
3. **Forensic Audit:** Spawn a Forensic Auditor subagent to perform an integrity check on the code implementation to verify compliance with constraints.
