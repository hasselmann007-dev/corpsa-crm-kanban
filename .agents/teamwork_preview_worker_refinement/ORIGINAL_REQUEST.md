## 2026-06-27T19:00:01Z
You are a teamwork_preview_worker. Your working directory is c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_refinement.
Your task is to refine the parser engine, enforce Kanban state transitions and frozen modal inputs, and resolve all linter errors.

Please study the handoff reports from:
- Challenger 1: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_challenger_1\handoff.md`
- Challenger 2: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_challenger_2\handoff.md`
- Forensic Auditor: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_auditor\handoff.md`

### 1. Refine Parser in `src/utils/parser.ts`:
- **Analyst Email Domain Match**: Update the regex in `parseAnalista` to require a word boundary or whitespace before the `@` symbol (e.g. `/(?<=^|[\s])@([A-Za-zÀ-ÿ0-9_.-]+...)/`), preventing email domains (like `@gmail.com`) from being matched.
- **Fallback Name Matching**: In the fallback loop in `parseNomeCliente`, skip processing lines that contain standard metadata labels (e.g., lines containing `:` such as `UF:`, `STATUS:`, `DDD:`). In addition, ensure candidate name chains do not consist of only short abbreviation/status words (like SP, OK, RJ).
- **CPF vs Phone Numbers**: In `parseCpf`, ignore candidate 11-digit sequences that match Brazilian mobile formats (e.g. starting with standard area codes and a 9, such as `^[1-9]{2}9[0-9]{8}$`) or are preceded by phone labels (e.g. "Contato:", "Tel:", "Cel:").
- **Note Cleaning WhatsApp Default**: In `parseNotes`, only strip the `grupoOrigem` value from the notes if the group was *explicitly* matched in the text (i.e. `grupoOrigem` is not the default `"WhatsApp"` string).
- **Note Cleaning Substring Collision**: In `parseNotes`, clean `analistaOriginalText` *before* cleaning `nome_cliente` to prevent the name from matching inside the analyst text first, which leaves a dangling `@` symbol.

### 2. Enforce Kanban Board Constraints in `src/App.tsx`:
- You MUST load and implement the rules from `c:\Users\User\Desktop\Ai agent\.agents\skills\kanban-validator\SKILL.md`.
- Update `checkTransitionAllowed` to strictly check and return `{ allowed: boolean; reason?: string }`:
  - `Roleta` -> `Conclusao`: Blocked. Reason: "Transição direta de Roleta para Conclusão não é permitida."
  - `Pendencia` -> `Roleta` or `Conclusao`: Blocked. Reason: "Cards em Demanda Operacional devem seguir para Análise de Crédito."
  - `Analise` -> `Roleta`: Blocked. Reason: "Cards em Análise de Crédito não podem voltar para a Roleta."
  - `Conclusao` -> any other stage: Blocked. Reason: "Lead concluído não pode ser alterado de coluna."
- In `handleDrop` and any other column transition triggers, if `checkTransitionAllowed` returns `allowed: false`, show a toast warning with the reason (using `showToast(reason, 'warning')`) and block the state update.
- When `selectedLead` stage is `'Conclusao'`, make all input fields, textareas, and dropdowns in the edit details modal read-only or disabled, and hide or disable the save/submit button so they cannot be edited.

### 3. ESLint & Build Validation:
- The project must compile successfully (`npm run build`).
- The project must have zero linting errors (`npm run lint` must pass).
- Check the files `src/vulnerabilityTests.ts`, `src/stressTest.ts`, and `src/dbCheck.ts`. If they are not required, you can delete them, or edit them to satisfy the linter (remove unused imports/variables, etc.).
- Update `src/parseTest.ts` to verify the new robust features (validating that email domains are ignored, that mobile phone numbers are not parsed as CPFs, and that default WhatsApp group name is not stripped from notes). All tests must pass successfully.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_refinement\handoff.md` and send a message when done. Include build, test, and lint outputs.
