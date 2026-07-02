---
name: kanban-validator
description: Validate Kanban board state transitions and schema constraints for CORPSA CRM.
---

# Kanban Validator Skill

This skill outlines how to verify and validate the state transition machine and constraints for the CORPSA CRM lead flow.

## 1. Allowed Transitions Checklist
Verify that the following state transitions are strictly followed in the UI and DB:
- **From Roleta (Roleta / Avaliar)**:
  - Allowed: `Pendencia` or `Analise`
  - Blocked: `Conclusao` (Show warning: "Transição direta de Roleta para Conclusão não é permitida.")
- **From Pendencia (Demanda Operacional / Pendência)**:
  - Allowed: `Analise`
  - Blocked: `Roleta`, `Conclusao` (Show warning: "Cards em Demanda Operacional devem seguir para Análise de Crédito.")
- **From Analise (Análise de Crédito)**:
  - Allowed: `Conclusao`, `Pendencia`
  - Blocked: `Roleta` (Show warning: "Cards em Análise de Crédito não podem voltar para a Roleta.")
- **From Conclusão**:
  - Blocked: Moving to any other column (Cards in Conclusão are frozen).

## 2. Conditional Fields Verification
Verify that:
- Moving to `Pendencia` requires `descricao_pendencia` (Text) to be set.
- Moving to `Analise` requires `resultado_analise` to be selected. If 'Condicionado' or 'Reprovado', `motivo_resultado` (Text) is required.
- In `Conclusao`, all fields are read-only (frozen).

## 3. Database Check
- Run a query on `leads` table to ensure that no row violates check constraints.
