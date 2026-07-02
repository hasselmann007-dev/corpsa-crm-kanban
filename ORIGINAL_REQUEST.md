# Original User Request

## Initial Request — 2026-06-27T15:34:52-03:00

Build a text processing engine for quick lead creation in CORPSA CRM. It parses pasted raw text blocks (extracting date, CPF, property value, analyst, group origin, name, and notes) and automatically saves the lead directly into the 'Roleta / Avaliar' column.

Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban
Integrity mode: demo

## Requirements

### R1. Text Parsing Engine
Parse raw text inputs using regex and pattern matching to extract the following variables:
- **Data do Serviço:** Format `DD/MM` (e.g., "11/06"), defaulting to year 2026. Sets the lead's creation timestamp.
- **CPF do Cliente:** 11 continuous digits (e.g., "19747342855"), formatted as `000.000.000-00`.
- **Analista Responsável:** Word(s) starting with `@` (e.g., "@Danilo Hasselmann").
- **Grupo de Origem:** Match against known channels/groups or fallback patterns.
- **Valor do Imóvel:** Numerical value followed by "k" or "M" (e.g., "250k" -> 250000.00).
- **Nome do Cliente:** UPPERCASE word chain not matching system keywords.
- **Serviço & Notes:** Identify specific service terms (e.g., "AVALIAÇÃO") and remaining text. 
- **Storage:** Since the database schema is not being modified, the parsed **Analista Responsável**, **Serviço**, and any other remaining notes must be formatted and appended together into the existing `informacoes_importantes` text column (e.g., "Analista: ... \nServiço: ... \nNotas: ...").

### R2. Quick Create Interface (Cadastrar Novo Lead Modal)
Modify the existing "Cadastrar Novo Lead" modal (triggered by clicking "CADASTRAR LEAD" in the sidebar) to completely replace the manual fields with a single "Criação Rápida via Texto" textarea:
- When text is pasted and submitted, run the parsing engine.
- Save the lead directly to the Supabase database with stage `'Roleta'` and default priority `'Baixa'`.
- Refresh the Kanban board and automatically open the details/edit modal of the newly created lead (by simulating clicking the card).

### R3. Automated Parser Validation
Create a programmatic TypeScript/Node test script (e.g., `src/parseTest.ts` or a test runner script) that imports the parsing function, runs it against multiple distinct sample text scenarios, and asserts the correct extraction of variables.

## Acceptance Criteria

### Compilation & Build
- [ ] Code builds without compilation errors (`npm run build`).

### Functionality
- [ ] Text processing accurately parses standard inputs and creates cards in the 'Roleta / Avaliar' column.
- [ ] Parsed Analyst, Service, and Notes are formatted and persisted inside the `informacoes_importantes` field of the created lead.
- [ ] The "Cadastrar Novo Lead" modal is updated to present only the textarea and a submit button.

### Testing & Verification
- [ ] The validation script (`src/parseTest.ts` or equivalent) executes successfully with all assertions passing.
