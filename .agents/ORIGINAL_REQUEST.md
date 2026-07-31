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
