import { parseRawText } from './utils/parser.ts';

console.log("=== EMPIRICAL CHALLENGER STRESS TESTS ===");

// 1. Email false positive test
console.log("\n--- Test 1: Email false positive ---");
const emailText = `Nome: JOÃO SILVA
CPF: 12345678909
Email: joao.silva@gmail.com
Valor: 300k`;
const parsedEmail = parseRawText(emailText);
console.log("Input email line: Email: joao.silva@gmail.com");
console.log("Parsed Analista in info:", parsedEmail.informacoes_importantes);
console.log("Parsed result:", JSON.stringify(parsedEmail, null, 2));

// 2. Short uppercase words as names test
console.log("\n--- Test 2: Short uppercase words ---");
const shortUpperText = `UF: SP
STATUS: OK
Nome: JOÃO SILVA
CPF: 12345678909
Valor: 300k`;
const parsedShortUpper = parseRawText(shortUpperText);
console.log("Input top line: UF: SP (with Nome: label present)");
console.log("Parsed Nome:", parsedShortUpper.nome_cliente);

console.log("\n--- Test 2b: Fallback name parsing without labels ---");
const fallbackText = `UF: SP
STATUS: OK
JOÃO SILVA
CPF: 12345678909
Valor: 300k`;
const parsedFallback = parseRawText(fallbackText);
console.log("Input top line: UF: SP (without Nome: label)");
console.log("Parsed Nome:", parsedFallback.nome_cliente);
console.log("Parsed result:", JSON.stringify(parsedFallback, null, 2));


// 3. Formatted CPF matching and phone number verification
console.log("\n--- Test 3: Phone number vs CPF ---");
// We need to find an 11-digit phone number that happens to have a valid CPF checksum.
// Let's write a quick loop to find one or test a known one.
// Let's test if a phone number is parsed as CPF if it has a valid CPF checksum.
// Let's calculate a valid CPF that looks like a phone number:
// E.g., area code 11, starting with 9, so 119XXXXXXXX.
// Let's generate a valid CPF starting with 119:
// Digits: 1, 1, 9, 8, 2, 7, 3, 6, 4
// Let's calculate the check digits:
// Sum1 = 1*10 + 1*9 + 9*8 + 8*7 + 2*6 + 7*5 + 3*4 + 6*3 + 4*2 = 10 + 9 + 72 + 56 + 12 + 35 + 12 + 18 + 8 = 232.
// 232 % 11 = 1. Rev1 = 11 - 1 = 10 -> 0.
// So 10th digit is 0.
// Digits now: 1, 1, 9, 8, 2, 7, 3, 6, 4, 0
// Sum2 = 1*11 + 1*10 + 9*9 + 8*8 + 2*7 + 7*6 + 3*5 + 6*4 + 4*3 + 0*2 = 11 + 10 + 81 + 64 + 14 + 42 + 15 + 24 + 12 + 0 = 273.
// 273 % 11 = 9. Rev2 = 11 - 9 = 2.
// So 11th digit is 2.
// So the 11-digit sequence '11982736402' is a valid CPF!
// But to a human, it looks exactly like a phone number: (11) 98273-6402 or 11982736402.
const phoneCpfText = `Telefone: 11 98273-6402
Nome: JOÃO SILVA
CPF: 12345678909
Valor: 300k`;
const parsedPhoneCpf = parseRawText(phoneCpfText);
console.log("Input phone number: 11 98273-6402 (which has valid CPF checksum)");
console.log("Parsed CPF:", parsedPhoneCpf.cpf_cliente);
console.log("Parsed result:", JSON.stringify(parsedPhoneCpf, null, 2));

// 4. Note cleaning collisions
console.log("\n--- Test 4: Note cleaning collisions ---");
const notesCollisionText = `Nome: JOÃO SILVA
CPF: 12345678909
Valor: 300k
Obs: Ligar para o cliente no WhatsApp para falar sobre parcerias.`;
const parsedCollision = parseRawText(notesCollisionText);
console.log("Input note: Ligar para o cliente no WhatsApp para falar sobre parcerias.");
console.log("Parsed Notes in info:", parsedCollision.informacoes_importantes);
console.log("Parsed result:", JSON.stringify(parsedCollision, null, 2));
