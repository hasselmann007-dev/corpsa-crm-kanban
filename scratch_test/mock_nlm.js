import fs from 'fs';

const scenario = process.env.MOCK_SCENARIO || 'unauthenticated';
const args = process.argv.slice(2).join(' ');

if (scenario === 'unauthenticated') {
  console.error("Error: Profile 'default' not found. Run 'nlm login' first.");
  process.exit(1);
}

if (scenario === 'not_installed') {
  console.error("'nlm' is not recognized as an internal or external command");
  process.exit(1);
}

if (scenario === 'success_codeblock') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([{ id: 'nb-central-123', title: 'Apuração de Renda CORPSA' }]));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('source add')) {
    console.log(JSON.stringify({ status: 'success', added: true }));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    const answer = '```json\n{\n  "rendaFormal": 5000,\n  "rendaInformal": 1500,\n  "rendaBruta": 6500,\n  "descontosDesconsiderados": 500,\n  "rendaLiquida": 6000,\n  "capacidadePagamento": 1800,\n  "parecer": "Renda aprovada com sucesso"\n}\n```';
    console.log(JSON.stringify({ answer }));
    process.exit(0);
  }
}

if (scenario === 'success_raw_json') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([{ id: 'nb-central-123', title: 'Apuração de Renda CORPSA' }]));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    console.log(JSON.stringify({
      answer: '{"rendaFormal": 4000, "rendaInformal": 0, "rendaBruta": 4000, "descontosDesconsiderados": 0, "rendaLiquida": 4000, "capacidadePagamento": 1200, "parecer": "Sem descontos"}'
    }));
    process.exit(0);
  }
}

if (scenario === 'plain_text') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([{ id: 'nb-central-123', title: 'Apuração de Renda CORPSA' }]));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    console.log("O cliente possui renda informal comprovada por extratos de R$ 3.500,00.");
    process.exit(0);
  }
}

if (scenario === 'malformed_json') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([{ id: 'nb-central-123', title: 'Apuração de Renda CORPSA' }]));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    console.log("```json\n{ rendaFormal: 5000, invalid syntax here }\n```");
    process.exit(0);
  }
}

if (scenario === 'negative_values') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([{ id: 'nb-central-123', title: 'Apuração de Renda CORPSA' }]));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    console.log(JSON.stringify({
      answer: '{"rendaBruta": 5000, "descontosDesconsiderados": 7000, "rendaLiquida": -2000, "parecer": "Descontos excessivos"}'
    }));
    process.exit(0);
  }
}

if (scenario === 'create_notebook') {
  if (args.includes('notebook list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('notebook create')) {
    console.log(JSON.stringify({ id: 'nb-created-999', title: 'Apuração de Renda CORPSA' }));
    process.exit(0);
  }
  if (args.includes('source list')) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }
  if (args.includes('query notebook')) {
    console.log(JSON.stringify({ answer: '{"rendaBruta": 3000, "parecer": "Novo notebook criado"}' }));
    process.exit(0);
  }
}

// Fallback default response
console.log(JSON.stringify([]));
