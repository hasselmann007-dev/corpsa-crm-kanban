import assert from 'assert';
import { parseRawText } from './utils/parser.ts';

function runTests() {
  console.log("Starting Lead Parser Test Suite...");

  // -------------------------------------------------------------
  // Test Case 1: Standard Input (All fields present, mixed layout)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 1: Standard Input");
    const rawText1 = `[11:06, 11/06/2026] Grupo de Avaliações:
Nome do Cliente: DANILO HASSELMANN
CPF: 12345678909
Valor Imóvel: 250k
Serviço: AVALIAÇÃO
Analista: @Danilo Hasselmann
Obs: Cliente com pressa.`;

    const parsed = parseRawText(rawText1);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "DANILO HASSELMANN");
    assert.strictEqual(parsed.cpf_cliente, "123.456.789-09");
    assert.strictEqual(parsed.valor_imovel, 250000);
    assert.strictEqual(parsed.cidade, "Não Informada");
    assert.strictEqual(parsed.grupo_origem, "Grupo de Avaliações");
    assert.strictEqual(
      parsed.informacoes_importantes,
      "Analista: @Danilo Hasselmann\nServiço: AVALIAÇÃO\nNotas: @ Cliente com pressa."
    );

    const date = new Date(parsed.data_hora_entrada);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 5); // June is 5 (0-indexed)
    assert.strictEqual(date.getDate(), 11);
    assert.strictEqual(date.getHours(), 11);
    assert.strictEqual(date.getMinutes(), 6);
    console.log("Test Case 1 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 2: Million format value and missing analyst
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 2: Million format and missing analyst");
    const rawText2 = `[14:30, 15/07] Origem: Parcerias
NOME: FELIPE SANTOS
CPF: 98765432100
VALOR: 1.2M
avaliação
Falta comprovante de residência.`;

    const parsed = parseRawText(rawText2);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "FELIPE SANTOS");
    assert.strictEqual(parsed.cpf_cliente, "987.654.321-00");
    assert.strictEqual(parsed.valor_imovel, 1200000);
    assert.strictEqual(parsed.cidade, "Não Informada");
    assert.strictEqual(parsed.grupo_origem, "Parcerias");
    assert.strictEqual(
      parsed.informacoes_importantes,
      "Serviço: AVALIAÇÃO\nNotas: Falta comprovante de residência."
    );

    const date = new Date(parsed.data_hora_entrada);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 6); // July is 6
    assert.strictEqual(date.getDate(), 15);
    assert.strictEqual(date.getHours(), 14);
    assert.strictEqual(date.getMinutes(), 30);
    console.log("Test Case 2 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 3: Lowercase/Uppercase variation in labels & different format
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 3: Label variations");
    const rawText3 = `Canal: Facebook Leads
cliente: MARIA SOUZA
cpf: 45678901249
valor do imovel: 850k
Nova Avaliação
analista responsavel: @Maria Silva
Notas: urgência média, ligar à tarde.
Data: 20/08/2026`;

    const parsed = parseRawText(rawText3);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "MARIA SOUZA");
    assert.strictEqual(parsed.cpf_cliente, "456.789.012-49");
    assert.strictEqual(parsed.valor_imovel, 850000);
    assert.strictEqual(parsed.cidade, "Não Informada");
    assert.strictEqual(parsed.grupo_origem, "Facebook Leads");
    assert.strictEqual(
      parsed.informacoes_importantes,
      "Analista: @Maria Silva\nServiço: NOVA AVALIAÇÃO\nNotas: urgência média, ligar à tarde."
    );

    const date = new Date(parsed.data_hora_entrada);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 7); // August is 7
    assert.strictEqual(date.getDate(), 20);
    console.log("Test Case 3 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 4: Fallback values (No structured fields)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 4: Fallback values");
    const rawText4 = `Apenas um texto qualquer de conversa sem campos estruturados.`;

    const parsed = parseRawText(rawText4);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "");
    assert.strictEqual(parsed.cpf_cliente, "");
    assert.strictEqual(parsed.valor_imovel, 0);
    assert.strictEqual(parsed.cidade, "Não Informada");
    assert.strictEqual(parsed.grupo_origem, "WhatsApp");
    assert.strictEqual(
      parsed.informacoes_importantes,
      "Notas: Apenas um texto qualquer de conversa sem campos estruturados."
    );

    // Verify date is valid (fallback to current time)
    const date = new Date(parsed.data_hora_entrada);
    assert.ok(!isNaN(date.getTime()));
    console.log("Test Case 4 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 5: Header text before client name does not get wrongly parsed
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 5: Header text before client name");
    const rawText5 = `AVALIAÇÕES DE IMÓVEIS
[14:30] GRUPO DE AVALIAÇÃO
Nome: FELIPE SANTOS
CPF: 98765432100
Valor: 500k`;

    const parsed = parseRawText(rawText5);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "FELIPE SANTOS");
    assert.strictEqual(parsed.cpf_cliente, "987.654.321-00");
    assert.strictEqual(parsed.valor_imovel, 500000);
    console.log("Test Case 5 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 6: Phone numbers are not incorrectly parsed as CPF
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 6: Phone numbers vs CPF");
    const rawText6 = `Contato: 11 98888-7777
Outro: 55 11 99999-9999
Cliente: MARCOS SILVA
CPF: 12345678909
Valor: 350k`;

    const parsed = parseRawText(rawText6);
    console.log("Parsed result:", parsed);

    // The phone numbers should be ignored and the valid CPF parsed
    assert.strictEqual(parsed.nome_cliente, "MARCOS SILVA");
    assert.strictEqual(parsed.cpf_cliente, "123.456.789-09");
    assert.strictEqual(parsed.valor_imovel, 350000);
    console.log("Test Case 6 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 7: Short client names do not mutilate notes
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 7: Short client names notes cleaning");
    const rawText7 = `Nome: ELI
CPF: 12345678909
Valor: 400k
Notas: CLIENTE ELIGIVEL`;

    const parsed = parseRawText(rawText7);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "ELI");
    // Ensure "ELI" was not stripped from "ELIGIVEL" in the notes
    assert.ok(parsed.informacoes_importantes.includes("CLIENTE ELIGIVEL"));
    console.log("Test Case 7 passed!");
  }

  // -------------------------------------------------------------
  // Test Case 8: Natural Language Input (hyphen-separated)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test Case 8: Natural Language Input");
    const rawText8 = `AVALIAÇÃO 26/05  - DIRECIONAL - jardim botanico - 393k Av. - ag 2949 - FID 694060PAOLA DE ANDRADE GOMES DA CUNHA 05855465683(@Danilo Hasselmann ) GERENTE PAULO - SBPE`;

    const parsed = parseRawText(rawText8);
    console.log("Parsed result:", parsed);

    assert.strictEqual(parsed.nome_cliente, "PAOLA DE ANDRADE GOMES DA CUNHA");
    assert.strictEqual(parsed.cpf_cliente, "058.554.656-83");
    assert.strictEqual(parsed.valor_imovel, 393000);
    assert.strictEqual(parsed.cidade, "Jardim Botanico");
    assert.strictEqual(parsed.grupo_origem, "DIRECIONAL");
    
    // Notes verification: analyst and service must be extracted, remaining in notes
    assert.ok(parsed.informacoes_importantes.includes("Analista: @Danilo Hasselmann"));
    assert.ok(parsed.informacoes_importantes.includes("Serviço: AVALIAÇÃO"));
    assert.ok(parsed.informacoes_importantes.includes("Notas:"));
    
    // Cleaned remaining notes should contain key unparsed tags
    assert.ok(parsed.informacoes_importantes.includes("ag 2949"));
    assert.ok(parsed.informacoes_importantes.includes("FID 694060"));
    assert.ok(parsed.informacoes_importantes.includes("GERENTE PAULO"));
    assert.ok(parsed.informacoes_importantes.includes("SBPE"));
    
    console.log("Test Case 8 passed!");
  }

  console.log("\nAll tests completed successfully!");
}

try {
  runTests();
} catch (error) {
  console.error("Test execution failed:", error);
  process.exit(1);
}
