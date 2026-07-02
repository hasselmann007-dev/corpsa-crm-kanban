## 2026-06-27T18:43:08Z
You are a teamwork_preview_worker. Your working directory is c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_integration.
Your task is to refine the lead parsing engine, add robustness test cases, and integrate the quick lead creation interface into `src/App.tsx`.

Please read the handoff reports from the previous reviewer agents:
- `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_reviewer_parser_1\handoff.md`
- `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_reviewer_parser_2\handoff.md`

### 1. Refine Parser Robustness in `src/utils/parser.ts`
- **Name Parsing**: Prioritize extracting the uppercase word chain immediately following client name labels like "Nome:", "Cliente:", "NOME:", "CLIENTE:", "Nome do Cliente:". If no labels exist, search for uppercase word chains, ensuring they are not part of known headers or system keywords.
- **CPF Verification (Checksum)**: Implement the standard Brazilian CPF checksum validation algorithm. Extract candidate 11-digit sequences (whether formatted or scattered) and validate them. Ignore any candidate sequence that fails validation (this prevents mobile phone numbers from being incorrectly parsed as CPFs).
- **Notes Cleaning**: Modify `parseNotes` to use word boundaries or full-word replacement when stripping extracted fields like client name or analyst. This prevents partial word truncation (e.g. stripping "ELI" from "ELIGIVEL").

### 2. Update `src/parseTest.ts`
- Add new test scenarios verifying:
  - Header text like "AVALIAÇÕES DE IMÓVEIS" or "GRUPO DE AVALIAÇÃO" before the actual client name does not get wrongly parsed as the client's name.
  - A phone number (e.g., "11 98888-7777" or "55 11 99999-9999") is not incorrectly parsed as the CPF.
  - Short client names (e.g., "ELI") do not cause truncation/mutilation of similar prefixes in the notes.

### 3. Implement UI Integration in `src/App.tsx`
- Replace the individual manual input fields in the "Cadastrar Novo Lead" modal with a single "Criação Rápida via Texto" `textarea` field and a submit button.
- On submit, call `parseRawText` from `src/utils/parser.ts`.
- Perform client-side validation (ensure name, CPF, value are parsed successfully and show appropriate form validation errors if they are missing or invalid).
- Save the lead to the Supabase database with stage `etapa: 'Roleta'`, default priority `prioridade: 'Baixa'`, and set all parsed fields including `data_hora_entrada`.
- Retrieve the inserted lead row using `.select().single()`.
- After successful insertion, close the modal, refresh the Kanban board (`fetchLeads()`), and automatically simulate opening the newly created lead details/edit modal by calling `handleCardClick(newlyCreatedLead)`.

### 4. Build and Test Validation
- Ensure the project builds successfully (`npm run build`).
- Verify all validation tests pass (`npx tsx src/parseTest.ts`).
- Ensure no ESLint errors are reported (`npx eslint src/App.tsx src/utils/parser.ts src/parseTest.ts`).
