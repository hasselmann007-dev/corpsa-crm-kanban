# Original User Request

## Initial Request — 2026-07-31T11:46:23Z

Implement 2-hour SLA tracking and warning indicators for Kanban cards and pending items in CORPSA CRM.

Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban
Integrity mode: development

## Requirements

### R1. Lead Card SLA Tracking & Static Warning Badge
- Track elapsed time since `data_hora_entrada` for each lead.
- If elapsed time exceeds 2 hours (120 minutes) and the lead stage is NOT `'Conclusao'`, display a static red/amber `"SLA Atrasada"` badge on the card and highlight the card border.
- When the card stage is moved to `'Conclusao'`, stop/freeze SLA tracking and remove the delayed warning.

### R2. Floating Pendências (Sticky Notes) SLA Tracking
- Add a `createdAt` ISO timestamp to each pending item saved in LocalStorage.
- If a pending item remains uncompleted after 2 hours from its creation, display a static `"SLA Atrasada"` warning badge next to the pending item.

### R3. Automated & Programmatic Verification
- Build and verify that all code compiles without errors (`npm run build`).
- Verify unit/integration behavior by updating test runners or validation scripts.

## Acceptance Criteria

### Functionality & Verification
- [ ] Lead cards with > 2 hours in system (and stage !== 'Conclusao') display a static `"SLA Atrasada"` badge.
- [ ] Cards in stage 'Conclusao' do not display the delayed SLA badge even if created > 2h ago.
- [ ] Floating pending items created > 2h ago display a static `"SLA Atrasada"` badge if not completed.
- [ ] Project builds without TypeScript errors (`npm run build`).

## Follow-up — 2026-08-12T12:25:08Z

Integrate `notebooklm-mcp-cli` into CORPSA CRM's Apuração de Renda (Income Audit) tab, establishing an automated 1-click Node/CLI bridge that processes attached financial documents in a single centralized NotebookLM notebook while storing complete audit history in CORPSA CRM.

Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban
Integrity mode: development

## Requirements

### R1. `notebooklm-mcp-cli` Setup & Authentication Guide
- Install `notebooklm-mcp-cli` on the system using `uv` / Python environment tools.
- Provide clear instructions for the user to execute `nlm login` if authentication is needed to connect Google NotebookLM cookies.

### R2. 1-Click Node/CLI Integration Bridge
- Create a local execution bridge (`server/nlmBridge.ts` or Node script) that connects the CRM frontend to `notebooklm-mcp-cli` (`nlm`).
- Implement automated commands: connect to central notebook "Apuração de Renda CORPSA", clear previous document sources, upload new attached files (PDFs, images, documents), and run income calculation queries considering user rules.
- Return structured AI calculation results (formal income, informal income, total gross, deductions) directly to the CRM frontend.

### R3. Apuração de Renda UI & 1-Click Action
- Add a prominent "Analisar no NotebookLM (1-Clique)" action button inside src/components/ApuracaoRendaTab.tsx.
- Display real-time progress indicators (Uploading, Analyzing, Calculating) during execution.
- Automatically populate income summary cards and insert the detailed AI response into the active session chat log.

### R4. Persistent CRM Session History
- Preserve all uploaded files, consideration text, chat threads, and calculated income summaries per client audit session in CRM local/Supabase storage.
- Ensure past audits remain searchable and reviewable in the left sidebar history list.

## Acceptance Criteria

### Compilation & Build
- [ ] Code builds without compilation errors (`npm run build`).

### Functionality & Integration
- [ ] `notebooklm-mcp-cli` is installed and reachable via CLI bridge.
- [ ] Clicking "Analisar no NotebookLM (1-Clique)" clears old sources in the central notebook, uploads new attachments, and runs the income audit prompt.
- [ ] Income calculation results automatically update the CRM summary metrics and session chat thread.
- [ ] Session history retains independent records for each past client audit.

