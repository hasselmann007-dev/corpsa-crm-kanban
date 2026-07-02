## 2026-06-27T15:37:16-03:00
You are a teamwork_preview_worker. Your working directory is c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_parser_impl.
Your task is to implement the text parsing engine and the validation script.

### Requirements:
1. Implement `src/utils/parser.ts`:
   - It should export a function `parseRawText(text: string): ParsedLead` where `ParsedLead` contains:
     * `nome_cliente`: UPPERCASE word chain (e.g. "DANILO HASSELMANN") from the text that doesn't match system/field keywords.
     * `cpf_cliente`: 11 continuous digits formatted as `000.000.000-00`.
     * `valor_imovel`: number parsed from values ending in 'k' (thousand) or 'M' (million), e.g., "250k" -> 250000.00, "1.2M" -> 1200000.00.
     * `cidade`: default to "Não Informada" (to satisfy the database NOT NULL constraint since the city is not explicitly extracted from text).
     * `grupo_origem`: WhatsApp group or channel name matched from the text, or a fallback.
     * `informacoes_importantes`: formatted text combining:
       - Analista Responsável: parsed from words starting with `@` (e.g. "@Danilo Hasselmann" -> "Analista: @Danilo Hasselmann")
       - Serviço: parsed from specific service terms like "AVALIAÇÃO" (e.g., "Serviço: AVALIAÇÃO")
       - Notes: any remaining text from the block (e.g., "Notas: <remaining_text>").
       Format example: "Analista: @Danilo Hasselmann\nServiço: AVALIAÇÃO\nNotas: Cliente com pressa."
     * `data_hora_entrada`: ISO string representation of the parsed date (format `DD/MM`, default year 2026), e.g. "11/06" -> "2026-06-11T03:00:00.000Z" or similar local/UTC representation.
2. Implement `src/parseTest.ts`:
   - Run multiple test scenarios (at least 3-4 distinct raw text blocks representing standard inputs, missing values, lowercase/uppercase variations, and different number formats).
   - Use assertions or console.error with process.exit(1) on failure to verify correct parsing.
   - It must execute successfully via `npx tsx src/parseTest.ts` (install tsx if necessary, or run via node if compiled).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please write a handoff report to `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_parser_impl\handoff.md` and send a message when done. Include the commands used to compile/run tests and their outputs.
