export interface ParsedLead {
  nome_cliente: string;
  cpf_cliente: string;
  valor_imovel: number;
  cidade: string;
  grupo_origem: string;
  informacoes_importantes: string;
  data_hora_entrada: string;
  analista?: string;
  servico?: string;
  notes?: string;
  mo_serasa?: string;
}

/**
 * Extrai código MO / Margem Operacional para consulta Serasa
 */
function parseMoSerasa(text: string): string {
  const moRegex = /\b(?:MO|M\.O\.|Margem|Codigo\s*MO|Código\s*MO)\s*[:=-]?\s*([A-Za-z0-9\-\.\/]+)/i;
  const match = text.match(moRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return '';
}

/**
 * Extracts a name consisting of uppercase words, excluding system/field keywords.
 */
function parseNomeCliente(text: string): string {
  const keywords = new Set([
    'CPF', 'VALOR', 'IMOVEL', 'IMÓVEL', 'AVALIACAO', 'AVALIAÇÃO',
    'ANALISTA', 'SERVICO', 'SERVIÇO', 'NOTAS', 'NOTA', 'CLIENTE',
    'RESPONSAVEL', 'RESPONSÁVEL', 'ROLETA', 'PENDENCIA', 'ANALISE',
    'ANÁLISE', 'CONCLUSAO', 'CONCLUSÃO', 'ASSESSOR', 'PORTAL',
    'WHATSAPP', 'GRUPO', 'ORIGEM', 'DATA', 'HORA', 'ENTRADA',
    'CIDADE', 'NOVA', 'REAVALIACAO', 'REAVALIAÇÃO', 'SBPE', 'MCMV',
    'BAIXA', 'MÉDIA', 'MEDIA', 'ALTA', 'NOME', 'OBS', 'CANAL',
    'OBSERVACAO', 'OBSERVAÇÃO', 'OBSERVACOES', 'OBSERVAÇÕES',
    'AVALIACOES', 'AVALIAÇÕES', 'IMOVEIS', 'IMÓVEIS', 'TRABALHO',
    'TRABALHOS', 'PARCERIA', 'PARCERIAS', 'MO', 'SERASA'
  ]);

  // 1. Try to find name labels (prioritized match, with emoji/multiline support)
  const labelRegex = /(?:^|[^\wÀ-ÿ])(?:Nome(?:[\s_]+do[\s_]+Cliente)?|Cliente)[ \t]*:[ \t]*([^\n\r🪪💰]+)/i;
  const labelMatch = text.match(labelRegex);
  if (labelMatch) {
    const lineAfterLabel = labelMatch[1].trim();
    const regex = /\b[\p{Lu}'-]{2,}\b/gu;
    const matches = Array.from(lineAfterLabel.matchAll(regex)).map(m => m[0]);
    const filtered = matches.filter(word => !keywords.has(word.toUpperCase()));
    if (filtered.length > 0) {
      return filtered.join(' ');
    }
  }

  // 2. Fallback: Search the entire text for name sequences
  const nameSeqRegex = /(?:^|[^a-zA-ZÀ-ÿ_])((\p{Lu}{2,})(?:[ \t]+(?:(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)[ \t]+)?(\p{Lu}{2,}))+)(?=$|[^a-zA-ZÀ-ÿ_])/gu;
  const matches = Array.from(text.matchAll(nameSeqRegex)).map(m => m[1].trim());
  if (matches.length > 0) {
    for (const seq of matches) {
      const words = seq.split(/\s+/);
      const filtered = words.filter(w => !keywords.has(w.toUpperCase()));
      if (filtered.length >= 2) {
        return filtered.join(' ');
      }
    }
  }

  return '';
}

/**
 * Validates CPF with checksum calculation
 */
export function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
}

/**
 * Extracts 11-digit continuous or formatted CPF string
 */
function parseCpfCliente(text: string): string {
  const formattedRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
  const formattedMatch = text.match(formattedRegex);
  if (formattedMatch) return formattedMatch[0];

  const rawRegex = /\b\d{11}\b/g;
  const matches = text.match(rawRegex);
  if (matches) {
    for (const match of matches) {
      if (isValidCpf(match)) {
        return match.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
    }
    return matches[0].replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  return '';
}

/**
 * Extracts numerical property values safely isolating CPFs
 */
function parseValorImovel(text: string, cpfToIgnore: string = ''): { valor: number; raw: string } {
  let cleanedText = text;
  if (cpfToIgnore) {
    cleanedText = cleanedText.replace(cpfToIgnore, '');
  }
  // Strip CPFs so their numbers are never mistaken for property value
  cleanedText = cleanedText.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '');
  cleanedText = cleanedText.replace(/\b\d{11}\b/g, '');

  // 1. First look for explicit label: Valor: R$ 190.000,00 or Imóvel: 200k or Valor: 250k
  const explicitRegex = /(?:Valor(?:[\s_]+do[\s_]+[Ii]móvel)?|[Ii]móvel)\s*[:=-]?\s*(?:R\$\s*)?(\d+(?:[.,]\d+)?\s*[kKmM]|\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,8}(?:,\d{2})?)/i;
  const explicitMatch = cleanedText.match(explicitRegex);
  if (explicitMatch) {
    const valStr = explicitMatch[1].trim();
    if (/[kKmM]$/i.test(valStr)) {
      const unit = valStr.slice(-1).toUpperCase();
      let num = parseFloat(valStr.slice(0, -1).replace(',', '.'));
      if (unit === 'K') num *= 1000;
      if (unit === 'M') num *= 1000000;
      return { valor: num, raw: explicitMatch[0] };
    }
    const cleanNum = valStr.replace(/\./g, '').replace(',', '.');
    return { valor: parseFloat(cleanNum), raw: explicitMatch[0] };
  }

  // 2. Look for k or m patterns (e.g. 300k, 1.25M)
  const kRegex = /\b(\d+(?:[.,]\d+)?)\s*([kKmM])\b/;
  const kMatch = cleanedText.match(kRegex);
  if (kMatch) {
    let num = parseFloat(kMatch[1].replace(',', '.'));
    const unit = kMatch[2].toUpperCase();
    if (unit === 'K') num *= 1000;
    if (unit === 'M') num *= 1000000;
    return { valor: num, raw: kMatch[0] };
  }

  // 3. Look for BRL formatted currency (e.g. R$ 450.750,50)
  const brlRegex = /(?:R\$\s*)(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/;
  const brlMatch = cleanedText.match(brlRegex);
  if (brlMatch) {
    const rawNum = brlMatch[1].replace(/\./g, '').replace(',', '.');
    return { valor: parseFloat(rawNum), raw: brlMatch[0] };
  }

  // 4. Look for plain numbers with 5 to 8 digits
  const plainNumRegex = /\b(\d{5,8})\b/;
  const plainMatch = cleanedText.match(plainNumRegex);
  if (plainMatch) {
    return { valor: parseFloat(plainMatch[1]), raw: plainMatch[0] };
  }

  return { valor: 0, raw: '' };
}

/**
 * Extracts analyst @handle
 */
function parseAnalista(text: string): { handle: string; originalText: string } | null {
  const analystRegex = /@([a-zA-ZÀ-ÿ0-9_.-]+(?:\s+[a-zA-ZÀ-ÿ0-9_.-]+)*)/;
  const match = text.match(analystRegex);
  if (match) {
    return { handle: match[0].trim(), originalText: match[0] };
  }
  return null;
}

/**
 * Extracts service term
 */
function parseServico(text: string): { servico: string; originalText: string } | null {
  const servicoRegex = /\b(REAVALIAÇÃO|REAVALIACAO|AVALIAÇÃO|AVALIACAO|SBPE|MCMV)\b/i;
  const match = text.match(servicoRegex);
  if (match) {
    return { servico: match[0].toUpperCase(), originalText: match[0] };
  }
  return null;
}

/**
 * Extracts group origin
 */
function parseGrupoOrigem(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.includes(' - ') || firstLine.length < 50) {
      return firstLine;
    }
  }
  return 'Geral';
}

export function capitalizeWords(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

/**
 * Cleans notes
 */
function parseNotes(
  text: string,
  _nome: string,
  _cpf: string,
  _valorRaw: string,
  analystRaw: string,
  _servicoRaw: string,
  _dateRaw: string,
  _grupo: string,
  _cidade: string
): string {
  let cleaned = text;
  if (analystRaw) cleaned = cleaned.replace(analystRaw, '');
  return cleaned.trim();
}

/**
 * Master parser function
 */
export function parseRawText(text: string): ParsedLead {
  const nome_cliente = parseNomeCliente(text);
  const cpf_cliente = parseCpfCliente(text);
  const valorResult = parseValorImovel(text, cpf_cliente);
  const valor_imovel = valorResult.valor;
  const analistaResult = parseAnalista(text);
  const servicoResult = parseServico(text);
  const mo_serasa = parseMoSerasa(text);

  let cidade = 'Ribeirão Preto';
  let grupo_origem = parseGrupoOrigem(text);

  const notes = parseNotes(
    text,
    nome_cliente,
    cpf_cliente,
    valorResult.raw,
    analistaResult ? analistaResult.originalText : '',
    servicoResult ? servicoResult.originalText : '',
    '',
    grupo_origem,
    cidade
  );

  const infoParts: string[] = [];
  if (analistaResult) infoParts.push(`Analista: ${analistaResult.handle}`);
  if (servicoResult) infoParts.push(`Serviço: ${servicoResult.servico}`);
  if (mo_serasa) infoParts.push(`MO: ${mo_serasa}`);
  if (notes) infoParts.push(`Notas: ${notes}`);

  return {
    nome_cliente,
    cpf_cliente,
    valor_imovel,
    cidade,
    grupo_origem,
    informacoes_importantes: infoParts.join('\n'),
    data_hora_entrada: new Date().toISOString(),
    analista: analistaResult ? analistaResult.handle : '',
    servico: servicoResult ? servicoResult.servico : 'AVALIAÇÃO',
    notes,
    mo_serasa
  };
}
