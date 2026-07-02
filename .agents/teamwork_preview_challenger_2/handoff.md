# Handoff Report — Parser and UI Verification Findings

This report details the empirical verification of potential parser vulnerabilities in `src/utils/parser.ts` and UI state-handling issues in `src/App.tsx`.

## 1. Observation

### Observation A: Email False Positives on Analyst Handle
In `src/utils/parser.ts`, the `parseAnalista` function extracts the analyst's handle using a regular expression:
```typescript
// Line 227
const match = text.match(/@([A-Za-zÀ-ÿ0-9_.-]+(?:[ \t]+[A-ZÀ-ÿ][a-zÀ-ÿ0-9_.-]*)*)/);
```
Running the test with `E-mail: cliente@gmail.com` before the analyst handle resulted in the following output from `npx.cmd tsx src/vulnerabilityTests.ts`:
```
Parsed result: {
  nome_cliente: 'JOÃO SILVA',
  cpf_cliente: '123.456.789-09',
  valor_imovel: 350000,
  cidade: 'Não Informada',
  grupo_origem: 'WhatsApp',
  informacoes_importantes: 'Analista: @gmail.com\nNotas: E-mail: cliente@gmail.com @Danilo Hasselmann',
  data_hora_entrada: '2026-06-27T18:56:49.864Z'
}
Contains incorrect analyst '@gmail.com'?: true
```

### Observation B: Short Uppercase Words Parsed as Client Names
In `src/utils/parser.ts`, the line-by-line fallback uses a regular expression `/\b[\p{Lu}'-]{2,}\b/gu` to match uppercase words (Line 92). It filters words using a `keywords` set but does not filter out short common abbreviations or status words unless they are explicitly present in the set.
Running the test containing `OBS: OK` before the name resulted in:
```
Parsed Name: OK
Is name parsed as 'OK'?: true
```

### Observation C: Formatted CPF Matching and Phone Number Hijacking
In `src/utils/parser.ts`, the `parseCpf` function extracts digit sequences of length 11 to 14:
```typescript
// Line 165
const regex = /(?:\d[\s.-]*){11,14}/g;
```
For a phone number that is mathematically a valid CPF (such as `11 98765-4374`), running `npx.cmd tsx src/vulnerabilityTests.ts` showed:
```
3A (spaced) Parsed CPF: 119.876.543-74
Is CPF parsed as phone number '119.876.543-74'?: true
3B (plain digits) Parsed CPF: 119.876.543-74
Is CPF parsed as phone number '119.876.543-74'?: true
```
Furthermore, in `src/App.tsx`, the client-side CPF validator only checks length and basic format:
```typescript
// Line 588
const cpfClean = editForm.cpf_cliente.replace(/\D/g, '');
if (cpfClean.length !== 11) {
  errors.cpf_cliente = 'CPF inválido. Deve possuir 11 dígitos.';
} else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(editForm.cpf_cliente)) {
  errors.cpf_cliente = 'CPF deve estar no formato 000.000.000-00.';
}
```
There is no call to `isValidCpf` in `src/App.tsx`, allowing invalid checksum CPFs (like `111.111.111-11`) to be saved.

### Observation D: Note Cleaning Collisions
In `src/utils/parser.ts`, `parseNotes` uses a word boundary replacement method:
```typescript
// Line 352
if (nome) {
  cleanedLine = replaceFullWord(cleanedLine, nome, "");
}
// Line 374
if (grupoOrigem) {
  cleanedLine = replaceFullWord(cleanedLine, grupoOrigem, "");
}
```
If the client's full name is in the notes, it is stripped. More critically, when `grupo_origem` is not parsed and defaults to `"WhatsApp"`, any occurrences of `"WhatsApp"` (case-insensitive) are removed from the notes:
```
Original Notes: ESTE CASO DO JOÃO SILVA É URGENTE
Parsed informacoes_importantes (full name): Notas: ESTE CASO DO  É URGENTE
Original Notes: ENVIAR MENSAGEM VIA WHATSAPP PARA CLIENTE
Parsed informacoes_importantes (default group): Notas: ENVIAR MENSAGEM VIA  PARA CLIENTE
```

### Observation E: State Transition Constraints and Frozen Fields in UI
In `src/App.tsx`, the function checking transitions always allows all moves:
```typescript
// Line 434
const checkTransitionAllowed = (current: string, target: string): { allowed: boolean; reason?: string } => {
  if (current && target) {
    return { allowed: true };
  }
  return { allowed: true };
};
```
Furthermore, when a card is in the `Conclusao` stage, the edit form fields are not disabled or marked `readOnly`, and the submit handler `handleEditSubmit` allows updating all basic fields for cards in `Conclusao`:
```typescript
// Line 651
if (selectedLead.etapa === 'Roleta' || selectedLead.etapa === 'Conclusao') {
  updateData.nome_cliente = editForm.nome_cliente.trim();
  ...
}
```

## 2. Logic Chain

1. **Email false positives**: By matching the `@` character followed by alphanumeric strings, `parseAnalista` matches email domain names (e.g. `@gmail.com`). Since it uses `text.match` (first match), if an email address appears before the analyst's actual handle, it hijacks the extraction, leaving the actual analyst unparsed.
2. **Short uppercase words as names**: By scanning line-by-line in the fallback and taking the first line containing uppercase character chains of length $\geq 2$, the parser matches unrelated words like `"OK"` on a line (e.g. `OBS: OK`) before checking later lines where the actual name is located.
3. **CPF phone hijacking**: The CPF regex matching relies solely on sequences of 11–14 digits separated by spaces, dots, or dashes. Phone numbers satisfying these criteria (e.g. `11 98765-4374` has 11 digits and no parentheses) and happening to pass the mathematical checksum test will hijack the CPF field if they appear first.
4. **UI Validation lack of checksum**: `App.tsx` has no checksum validation helper, resulting in a validation mismatch where the text parser enforces `isValidCpf` but the UI edit card validator allows saving any arbitrary 11 digits matching `000.000.000-00`.
5. **Note cleaning collisions**: The `parseNotes` function strips matches of the `nome` and `grupoOrigem` from the notes string. When the group defaults to `"WhatsApp"`, the word `"WhatsApp"` is stripped from any context in the notes, losing vital communication info.
6. **UI State Transition Flow**: Since `checkTransitionAllowed` returns `{ allowed: true }` unconditionally, the Kanban board permits illegal movements (e.g. from Roleta directly to Conclusao, or returning cards from Conclusao to other columns). The UI also does not restrict editing fields in the `Conclusao` stage.

## 3. Caveats

No database-level transition checks were tested since migrations do not contain triggers or rules blocking transitions. Verification was performed on a local Supabase CLI docker stack.

## 4. Conclusion

There are multiple confirmed bugs and security/data integrity vulnerabilities:
- **Parser Vulnerabilities**: Email addresses containing `@` and phone numbers satisfying the CPF checksum hijack parsed fields, short uppercase words like `"OK"` hijack name extraction, and note-cleaning removes correct client names and the word `"WhatsApp"` from notes.
- **UI Behavior Mismatches**: Edit forms allow invalid CPF checksums, state transitions are unrestricted, and fields in `Conclusao` can be edited and saved instead of being read-only.

These findings are fully verified by automated tests and static analysis.

## 5. Verification Method

To verify these findings:
1. Run the empirical tests written to verify the parser vulnerabilities:
   ```bash
   npx.cmd tsx src/vulnerabilityTests.ts
   ```
2. Verify the TypeScript compiler still succeeds:
   ```bash
   npx.cmd tsc -b
   ```
3. Inspect `src/App.tsx` starting from line 434 (`checkTransitionAllowed`) to confirm that all transitions return `{ allowed: true }` and no rules are enforced.
4. Open the CRM interface, drag a card from `Roleta` directly to `Conclusao`, open the card edit modal, edit the fields, and click Save to verify that transitions and frozen rules are ignored by the frontend.
