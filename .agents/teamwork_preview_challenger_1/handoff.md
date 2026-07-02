# Handoff Report — Parser and UI Verification

## 1. Observation

Direct observations made on `src/utils/parser.ts` and `src/App.tsx`:

### Observation A: Email False Positives in Analyst Parser
In `src/utils/parser.ts`, the analyst parsing function is implemented as follows:
```typescript
function parseAnalista(text: string): { handle: string; originalText: string } | null {
  // Matches @ followed by a sequence of characters and spaces forming a name on the same line
  const match = text.match(/@([A-Za-zÀ-ÿ0-9_.-]+(?:[ \t]+[A-ZÀ-ÿ][a-zÀ-ÿ0-9_.-]*)*)/);
  if (match) {
    return {
      handle: `@${match[1].trim()}`,
      originalText: match[0]
    };
  }
  return null;
}
```
When run against the input `Email: joao.silva@gmail.com`, this regex matches `@gmail.com` as the handle and original text because it sees `@` followed by letters/digits.

### Observation B: Fallback Name Parsing of Short Uppercase Words
In `src/utils/parser.ts`, the fallback parser checks line-by-line:
```typescript
    const regex = /\b[\p{Lu}'-]{2,}\b/gu;
    const matches = Array.from(line.matchAll(regex)).map(m => m[0]);
    ...
    const candidate = candidates.find(chain => chain.length >= 2) || candidates.find(chain => chain.length >= 1);
    if (candidate) {
      return candidate.join(' ');
    }
```
When run against input containing:
```
UF: SP
STATUS: OK
JOÃO SILVA
```
where there is no explicit `Nome:` label, the loop processes `UF: SP` on line 1. The word `SP` is uppercase and length 2. It matches the regex and is not in the `keywords` list. The function returns `UF SP` immediately and never reaches `JOÃO SILVA`.

### Observation C: Formatted CPF Matching and Phone Numbers
In `src/utils/parser.ts`, CPF extraction uses:
```typescript
function parseCpf(text: string): string {
  const regex = /(?:\d[\s.-]*){11,14}/g;
  const matches = text.match(regex);
  if (matches) {
    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (digits.length === 11 && isValidCpf(digits)) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      }
    }
  }
  return "";
}
```
When run against a phone number like `11 98273-6402`, the extracted digits are `11982736402`. Since this sequence has 11 digits and mathematically satisfies the CPF checksum (`isValidCpf` returns `true`), it is formatted and returned as the CPF (`119.827.364-02`), overriding actual CPFs that may appear later in the text.

### Observation D: Note Cleaning Collisions
In `src/utils/parser.ts`, notes are cleaned by removing the `grupoOrigem` value:
```typescript
    if (grupoOrigem) {
      cleanedLine = replaceFullWord(cleanedLine, grupoOrigem, "");
    }
```
If no explicit group origin is found, `parseGrupoOrigem` returns the default `"WhatsApp"`. If the notes field contains the word `"WhatsApp"`, it is matched and silently deleted. For example, `Ligar para o cliente no WhatsApp para falar sobre parcerias.` becomes `Ligar para o cliente no  para falar sobre parcerias.`.

### Observation E: UI Stage Transition Enforcement
In `src/App.tsx` (lines 434-439):
```typescript
  // State Transition Constraints Check
  const checkTransitionAllowed = (current: string, target: string): { allowed: boolean; reason?: string } => {
    if (current && target) {
      return { allowed: true };
    }
    return { allowed: true };
  };
```
No transition check is implemented, and it always returns `{ allowed: true }`. Consequently, users can transition cards in any direction (e.g. from Roleta to Conclusao, or out of Conclusao) in the UI without warnings.

### Observation F: Editable Fields in "Conclusao" Stage
In `src/App.tsx`, the edit modal fields (lines 1450-1600) do not contain `disabled` or `readOnly` attributes bound to the lead stage. The modal footer save button is active, and the message on line 1424 states:
`Este lead está na etapa de Conclusão. Você pode visualizar ou atualizar as informações livremente.`
This directly violates the rule that cards in the Conclusao column must be read-only/frozen.


## 2. Logic Chain

1. **Email false positives**: Since the regex `/^[A-Za-zÀ-ÿ0-9_.-]/` matches domain names like `gmail.com` and is preceded by `@` in email addresses, the lack of context verification (e.g., ensuring `@` is at the beginning of a word boundary or not immediately preceded by alphanumeric/email characters) causes email domains to be parsed as analysts.
2. **Short uppercase name matching**: Since the fallback name parser searches line-by-line in order and matches any uppercase word chain of length >= 2, lines like `UF: SP` or `STATUS: OK` are parsed as the customer's name because the keywords list does not contain state abbreviations or common abbreviations like `SP`, `OK`, `RJ`.
3. **CPF vs Phone Numbers**: Since Brazil's mobile phone numbers with area codes are 11 digits (e.g., `11982736402`), and 1% of random 11-digit numbers satisfy the CPF checksum, the parser matches such phone numbers. Because there is no validation to ignore sequences matching typical Brazilian phone number formats, the phone number is incorrectly parsed as the CPF.
4. **Note cleaning collision**: Since the default value for `grupoOrigem` is `"WhatsApp"` when no group header is matched, passing this default value to the notes cleaner causes the word `"WhatsApp"` to be stripped from any text line in the note, leaving grammatical holes.
5. **UI Transition constraints**: Since the function `checkTransitionAllowed` has a placeholder implementation that always returns `{ allowed: true }`, there are no validation blocks in the frontend to enforce the transition matrix.
6. **Freeze constraints**: Since the inputs in the edit modal lack a `disabled={selectedLead.etapa === 'Conclusao'}` check, the user can edit and submit changes for cards already in the Conclusão stage.


## 3. Caveats

- Database-level constraints are defined in migrations, but they only check simple field presence/types and stage names; they do not enforce step-by-step transitions or card freezing.
- Tests were executed locally via a stress test script `src/stressTest.ts` to replicate environment conditions. No browser automation (Playwright/Selenium) was performed.


## 4. Conclusion

**Overall risk assessment**: CRITICAL

The lead parsing engine contains multiple high-severity logic vulnerabilities that lead to:
- False positives on emails (extracting `@gmail.com` as analyst).
- High rate of incorrect client names on fallback text (extracting `UF SP` instead of actual names).
- High rate of phone numbers overriding CPFs (1 in 100 chance for any 11-digit phone number).
- Note corruption (silently deleting `"WhatsApp"` from notes).

The UI fails to enforce lead stage transitions and allows modifications of frozen Conclusão leads.

---

## Challenge Report

### [High] Challenge 1: Analyst email address false positive
- **Assumption challenged**: The character `@` always introduces an analyst handle.
- **Attack scenario**: Inputs with email addresses but no analyst handles cause `@domain` to be matched as the analyst.
- **Blast radius**: UI displays incorrect analyst handles (e.g., `@gmail.com`) for parsed leads.
- **Mitigation**: Update the analyst regex to require a word boundary or whitespace before the `@` character: `/(?<=^|\s)@([A-Za-zÀ-ÿ0-9_.-]+...)/`.

### [Critical] Challenge 2: Fallback name parsing collision
- **Assumption challenged**: The first line containing uppercase words is the client's name.
- **Attack scenario**: Raw text containing header info like state (`UF: SP`) or status (`STATUS: OK`) before the name causes the name to be parsed incorrectly as `UF SP` or `STATUS OK`.
- **Blast radius**: Leads are created with gibberish names, and the real name is missed.
- **Mitigation**: Filter out 2-character words, state abbreviations, or verify the line length and pattern before matching it as a name fallback.

### [High] Challenge 3: Phone numbers parsed as CPF
- **Assumption challenged**: Checksum validation is sufficient to identify CPFs.
- **Attack scenario**: Brazilian mobile numbers with 11 digits that happen to have a valid checksum are matched and formatted as CPFs.
- **Blast radius**: The client's phone number is saved as their CPF, and their actual CPF is lost.
- **Mitigation**: Avoid matching 11-digit sequences starting with typical mobile prefixes (like `11 9` or `(11) 9`) if they are labeled or formatted as phone numbers, or prioritize explicit labels like `CPF:`.

### [High] Challenge 4: Note cleaning collision
- **Assumption challenged**: Every match of the `grupoOrigem` string in the text is a header label and should be removed.
- **Attack scenario**: Leads where `grupoOrigem` defaults to `"WhatsApp"` have the word `"WhatsApp"` stripped from their notes.
- **Blast radius**: The notes lose context (e.g., "Ligar no WhatsApp" becomes "Ligar no").
- **Mitigation**: Only clean the group origin if it was explicitly parsed from a label or header, and never clean using the default fallback string.

### [Critical] Challenge 5: UI Transition Bypass
- **Assumption challenged**: Frontend drag-and-drop transitions are constrained.
- **Attack scenario**: Users drag leads directly from Roleta to Conclusao, or move frozen Conclusao leads to other columns.
- **Blast radius**: Transition rules are violated, resulting in inconsistent state machines.
- **Mitigation**: Implement the stage transition checks inside `checkTransitionAllowed` in `src/App.tsx`.


## 5. Verification Method

To reproduce all parser vulnerabilities:
1. Run the custom stress tests using the command:
   ```powershell
   npx.cmd tsx src/stressTest.ts
   ```
2. Verify that:
   - Test 1 outputs `Analista: @gmail.com`.
   - Test 2b outputs `Parsed Nome: UF SP`.
   - Test 3 outputs `Parsed CPF: 119.827.364-02` (extracted from the phone number).
   - Test 4 outputs `Notas: Ligar para o cliente no  para falar sobre parcerias.` (with "WhatsApp" missing).

To verify the UI vulnerabilities:
1. Inspect `src/App.tsx` at line 434 to check `checkTransitionAllowed`.
2. Inspect the edit modal in `src/App.tsx` (lines 1420-1709) to confirm the lack of `disabled` or `readOnly` attributes on inputs and the active "Salvar Alterações" button when `selectedLead.etapa === 'Conclusao'`.
