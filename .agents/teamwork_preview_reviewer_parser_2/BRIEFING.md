# BRIEFING — 2026-06-27T18:42:30Z

## Mission
Review and stress-test the lead parser implementation and test suite.

## 🔒 My Identity
- Archetype: teamwork_preview_reviewer
- Roles: reviewer, critic
- Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_reviewer_parser_2
- Original parent: 6bc76c1b-fca1-49ab-8c9f-153a32b3c043
- Milestone: Review Lead Parser
- Instance: 2 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code

## Current Parent
- Conversation ID: 6bc76c1b-fca1-49ab-8c9f-153a32b3c043
- Updated: not yet

## Review Scope
- **Files to review**: `src/utils/parser.ts`, `src/parseTest.ts`
- **Interface contracts**: `PROJECT.md`, `ORIGINAL_REQUEST.md` (in project root)
- **Review criteria**: Correctness, robustness, edge cases, compilation, linter and test suite execution.

## Review Checklist
- **Items reviewed**:
  - `src/utils/parser.ts` (core parser)
  - `src/parseTest.ts` (validation test runner)
  - `tsconfig.app.json` (node types added)
  - `src/App.tsx` (UI modal code)
- **Verdict**: REQUEST_CHANGES (due to missing UI integration and name/CPF edge case false positives)
- **Unverified claims**: none

## Attack Surface
- **Hypotheses tested**:
  - Name parsing handles custom uppercase chains before actual client names: Fails (e.g. `GRUPO DE TRABALHO` returns `DE TRABALHO`).
  - CPF parsing handles scattered 11-digit strings containing phone numbers: Fails (e.g. phone numbers are parsed and formatted as CPFs).
  - Clean substring replacement in notes handles short uppercase names: Fails if uppercase name is a substring of another uppercase word in the notes.
- **Vulnerabilities found**:
  - UI modal in `src/App.tsx` has not been updated (R2 compliance is missing).
  - Client name parsing false positives on headers/metadata containing uppercase word chains of length >= 2.
  - CPF parsing matches Brazilian phone numbers.
- **Untested angles**: None.

## Key Decisions Made
- Executed compilation with `npm.cmd run build` (successful).
- Ran validation tests with `npx.cmd tsx src/parseTest.ts` (successful).
- Checked linting with `npx.cmd eslint` (successful).

## Artifact Index
- `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_reviewer_parser_2\handoff.md` — Final review and challenge findings report
