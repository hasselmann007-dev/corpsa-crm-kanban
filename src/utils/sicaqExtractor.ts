export interface ExtractedSicaqData {
  cliente?: string;
  cpf?: string;
  valor_imovel: number;
  valor_financiamento: number;
  valor_entrada: number;
  prazo_meses: number;
  sistema_amortizacao: 'SAC' | 'PRICE';
  taxa_juros_nominal: string;
  taxa_juros_efetiva: string;
  primeira_prestacao: number;
  tipo_imovel: 'Planta' | 'Novo' | 'Usado' | 'Terreno e Construção';
  cidade: string;
  renda_familiar?: string;
  desconto_subsidio?: number;
  validade_avaliacao?: string;
  fator_social_aplicado: boolean;
  fgts_36_meses_comprovado: boolean;
}

/**
 * Converte string de moeda brasileira ("R$ 264.000,00" ou "264.000,00") para número float puro
 */
export function parseMoedaBr(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

/**
 * Parser determinístico de texto para extração de relatórios do SICAQ / Portal Caixa
 */
export function parseTextoCaixaDeterministico(text: string): Partial<ExtractedSicaqData> {
  const result: Partial<ExtractedSicaqData> = {};

  // 1. Valor do Imóvel
  const vImovelMatch = text.match(/Valor\s*d?o?\s*im[oó]vel\s*[:=]?\s*R?\$?\s*([\d.,]+)/i);
  if (vImovelMatch) {
    result.valor_imovel = parseMoedaBr(vImovelMatch[1]);
  }

  // 2. Valor de Financiamento
  const vFinancMatch = text.match(/Valor\s*d?e?\s*Financiamento[^\n:]*[:=]?\s*\n?\s*R?\$?\s*([\d.,]+)/i);
  if (vFinancMatch) {
    result.valor_financiamento = parseMoedaBr(vFinancMatch[1]);
  }

  // 3. Valor de Entrada
  const vEntradaMatch = text.match(/Valor\s*d?e?\s*entrada\s*[:=]?\s*R?\$?\s*([\d.,]+)/i);
  if (vEntradaMatch) {
    result.valor_entrada = parseMoedaBr(vEntradaMatch[1]);
  }

  // 4. Prazo em meses
  const prazoMatch = text.match(/Prazo[^\n:]*[:=]?\s*(\d{2,3})\s*meses/i);
  if (prazoMatch) {
    result.prazo_meses = parseInt(prazoMatch[1], 10);
  }

  // 5. Sistema de Amortização (PRICE ou SAC)
  const sistemaMatch = text.match(/Sistema\s*d?e?\s*Amortiza[cç][aã]o\s*[:=]?\s*(PRICE|SAC)/i);
  if (sistemaMatch) {
    result.sistema_amortizacao = sistemaMatch[1].toUpperCase() === 'SAC' ? 'SAC' : 'PRICE';
  } else if (/PRICE/i.test(text)) {
    result.sistema_amortizacao = 'PRICE';
  } else if (/SAC/i.test(text)) {
    result.sistema_amortizacao = 'SAC';
  }

  // 6. Primeira Prestação
  const prestacaoMatch = text.match(/Primeira\s*Presta[cç][aã]o[^\d]*([\d.,]+)/i) ||
    text.match(/Presta[cç][aã]o\s*M[aá]xima[^\d]*([\d.,]+)/i);
  if (prestacaoMatch) {
    result.primeira_prestacao = parseMoedaBr(prestacaoMatch[1]);
  }

  // 7. Juros Nominais e Efetivos
  const jurosMatch = text.match(/(\d+[\d.,]*)\s*%\s*(\d+[\d.,]*)\s*%/);
  if (jurosMatch) {
    result.taxa_juros_nominal = jurosMatch[1].replace(',', '.');
    result.taxa_juros_efetiva = jurosMatch[2].replace(',', '.');
  } else {
    const nomMatch = text.match(/Juros\s*Nominais[^\d]*([\d.,]+)%?/i);
    const efetMatch = text.match(/Juros\s*Efetivos[^\d]*([\d.,]+)%?/i);
    if (nomMatch) result.taxa_juros_nominal = nomMatch[1].replace(',', '.');
    if (efetMatch) result.taxa_juros_efetiva = efetMatch[1].replace(',', '.');
  }

  // 8. Tipo do Imóvel (Planta, Novo, Usado, Terreno e Construção)
  if (/PLANTA|CONSTRUCAO\/AQ\s*TER|VINCULADA|COLETIVAS/i.test(text)) {
    result.tipo_imovel = 'Planta';
  } else if (/TERRENO\s*E\s*CONSTRU[CÇ][AÃ]O|CONSTRUCAO\s*INDIVIDUAL/i.test(text)) {
    result.tipo_imovel = 'Terreno e Construção';
  } else if (/USADO|AQUISICAO\s*IMOVEL\s*USADO/i.test(text)) {
    result.tipo_imovel = 'Usado';
  } else {
    result.tipo_imovel = 'Novo';
  }

  // 9. Cidade
  const cidadeMatch = text.match(/Cidade\s*[:=]?\s*([A-Za-zÀ-ÿ\s]+)(?:-\s*[A-Z]{2})?/i);
  if (cidadeMatch && cidadeMatch[1]) {
    result.cidade = cidadeMatch[1].trim();
  }

  // 10. Desconto / Subsídio FGTS
  const descontoMatch = text.match(/Desconto\s*[:=]?\s*R?\$?\s*([\d.,]+)/i);
  if (descontoMatch) {
    result.desconto_subsidio = parseMoedaBr(descontoMatch[1]);
  }

  // 11. Renda Familiar
  const rendaMatch = text.match(/Renda\s*Familiar\s*[:=]?\s*R?\$?\s*([\d.,]+)/i);
  if (rendaMatch) {
    result.renda_familiar = rendaMatch[1].trim();
  }

  // 12. Validade / Data
  const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dataMatch) {
    result.validade_avaliacao = dataMatch[1];
  }

  return result;
}

/**
 * Executa extração completa de SICAQ/Simulação Caixa via Google Gemini 3.6 Multimodal (PDF/Imagem)
 * com retorno determinístico de JSON e fallback seguro
 */
export async function extrairSicaqComGemini36(
  base64Data: string,
  mimeType: string,
  customApiKey?: string
): Promise<ExtractedSicaqData> {
  const apiKey = customApiKey || 
    (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key_v1') : null) || 
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
    '';

  const promptExtract = `Você é especialista em análise de crédito imobiliário da Caixa Econômica Federal (SICAQ e Portal de Empreendimentos).
Analise com precisão absoluta este documento oficial de Simulação / Aprovação da Caixa e extraia EXATAMENTE os seguintes campos:
{
  "cliente": "Nome do proponente se constar, ou vazio",
  "cpf": "000.000.000-00 se constar, ou vazio",
  "valor_imovel": 264000.00,
  "valor_financiamento": 193440.70,
  "valor_entrada": 69966.30,
  "prazo_meses": 420,
  "sistema_amortizacao": "PRICE" ou "SAC",
  "taxa_juros_nominal": "5.5000",
  "taxa_juros_efetiva": "5.6408",
  "primeira_prestacao": 1098.98,
  "tipo_imovel": "Planta" | "Novo" | "Usado" | "Terreno e Construção",
  "cidade": "Sorocaba",
  "renda_familiar": "3.663,33",
  "desconto_subsidio": 593.00,
  "validade_avaliacao": "02/09/2026",
  "fator_social_aplicado": true,
  "fgts_36_meses_comprovado": true
}

Regras para tipo_imovel:
- Se contiver "PLANTA", "CONSTRUCAO/AQ TER CONST", "UNIDADE VINCULADA PF EMPREENDIMENTO", "IM. PLANTA": o tipo_imovel é "Planta".
- Se contiver "NOVO" ou "AQUISICAO IMOVEL NOVO": "Novo".
- Se contiver "USADO" ou "AQUISICAO IMOVEL USADO": "Usado".
- Se contiver "TERRENO E CONSTRUCAO": "Terreno e Construção".

Retorne APENAS o JSON puro.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptExtract },
          {
            inlineData: {
              mimeType: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  // Tenta modelos em ordem: gemini-3.6-flash, gemini-flash-latest, gemini-2.5-flash
  const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(`HTTP ${response.status}: ${errTxt}`);
      }

      const resJson = await response.json();
      const parts = resJson.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find((p: any) => p.text && !p.thought)?.text || parts[0]?.text || '';

      if (!textPart) {
        throw new Error('Nenhum texto retornado na resposta do Gemini.');
      }

      // Extrai JSON puro
      const jsonMatch = textPart.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : textPart;
      const parsed = JSON.parse(jsonStr);

      const finalData: ExtractedSicaqData = {
        cliente: parsed.cliente || '',
        cpf: parsed.cpf || '',
        valor_imovel: parseMoedaBr(parsed.valor_imovel),
        valor_financiamento: parseMoedaBr(parsed.valor_financiamento),
        valor_entrada: parseMoedaBr(parsed.valor_entrada),
        prazo_meses: parseInt(parsed.prazo_meses || '360', 10) || 360,
        sistema_amortizacao: String(parsed.sistema_amortizacao).toUpperCase().includes('SAC') ? 'SAC' : 'PRICE',
        taxa_juros_nominal: String(parsed.taxa_juros_nominal || '5.50').replace('%', '').trim(),
        taxa_juros_efetiva: String(parsed.taxa_juros_efetiva || '5.64').replace('%', '').trim(),
        primeira_prestacao: parseMoedaBr(parsed.primeira_prestacao),
        tipo_imovel: (parsed.tipo_imovel as any) || 'Planta',
        cidade: parsed.cidade || 'Sorocaba',
        renda_familiar: parsed.renda_familiar || '',
        desconto_subsidio: parseMoedaBr(parsed.desconto_subsidio),
        validade_avaliacao: parsed.validade_avaliacao || '',
        fator_social_aplicado: parsed.fator_social_aplicado ?? true,
        fgts_36_meses_comprovado: parsed.fgts_36_meses_comprovado ?? true
      };

      return finalData;
    } catch (err: any) {
      lastErr = err;
      console.warn(`Tentativa com ${model} falhou:`, err.message);
    }
  }

  throw lastErr || new Error('Não foi possível extrair os dados do SICAQ com o Gemini 3.6.');
}
