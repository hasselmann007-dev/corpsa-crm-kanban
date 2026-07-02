# Project: CORPSA CRM Quick Lead Creation

## Architecture
- **Parser Module (`src/utils/parser.ts`)**: Pure TypeScript logic to parse raw text block inputs. Decoupled from React/Supabase APIs to facilitate isolated testing.
- **Frontend Integration (`src/App.tsx`)**: Replaces the manual form fields in the "Cadastrar Novo Lead" modal with a single quick-create text area. Invokes the parser on submission, inserts the parsed lead to Supabase, and re-renders the board, auto-opening the edit/details modal for the newly added card.
- **Testing Script (`src/parseTest.ts`)**: Programmatic script that runs via Node/tsx to execute test cases for different text inputs, asserting parser accuracy.

## Code Layout
- `src/utils/parser.ts`: Parsing engine logic.
- `src/App.tsx`: Main Kanban board application, UI for quick lead creation, and modal rendering.
- `src/parseTest.ts`: Automated test script validating the parser function.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Decompose & Setup | Initialize metadata, write plan.md, configure tests. | None | DONE |
| 2 | Implement Parser | Create `src/utils/parser.ts` parsing raw text blocks. | M1 | PLANNED |
| 3 | Automated Tests | Create `src/parseTest.ts` to programmatically validate the parser. | M2 | PLANNED |
| 4 | UI Integration | Replace modal fields in `src/App.tsx` with textarea, call parser, insert into Supabase, refresh board, and open modal. | M2, M3 | PLANNED |
| 5 | Verification & Audit | Run all test scripts, check UI compilation, run Challenger stress tests, and perform Forensic Auditor check. | M4 | PLANNED |

## Interface Contracts
### `src/utils/parser.ts` ↔ Calling Code
```typescript
export interface ParsedLead {
  nome_cliente: string;
  cpf_cliente: string; // Formatted as 000.000.000-00
  valor_imovel: number; // Float value (e.g. 250000.00)
  cidade: string; // Will default to a placeholder (e.g. "Não Informado") or empty if not extracted, but database requires non-empty check.
  grupo_origem: string; // WhatsApp/Channel name
  informacoes_importantes: string; // Formatted "Analista: ... \nServiço: ... \nNotas: ..."
  data_hora_entrada?: string; // ISO String (computed from DD/MM and current year 2026)
}

export function parseRawText(text: string): ParsedLead;
```
