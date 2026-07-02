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
    'TRABALHOS', 'PARCERIA', 'PARCERIAS'
  ]);

  const knownHeaders = new Set([
    'AVALIACOES DE IMOVEIS',
    'AVALIAÇÕES DE IMÓVEIS',
    'GRUPO DE AVALIACAO',
    'GRUPO DE AVALIAÇÃO',
    'GRUPO DE AVALIAÇÕES',
    'GRUPO DE AVALIACOES',
    'PARCERIA IMOBILIARIA',
    'PARCERIA IMOBILIÁRIA',
    'GRUPO DE TRABALHO'
  ]);

  // 1. Try to find name labels (prioritized match)
  const labelRegex = /^[ \t]*(?:Nome(?:[\s_]+do[\s_]+Cliente)?|Cliente)[ \t]*:[ \t]*(.+)$/im;
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

  // 2. Fallback: Search the entire text for name sequences (2+ uppercase words separated by spaces/prepositions)
  // We allow the sequence to be preceded/followed by digits or non-letters
  const nameSeqRegex = /(?:^|[^a-zA-ZÀ-ÿ_])((\p{Lu}{2,})(?:[ \t]+(?:(?:de|da|do|dos|das|e|DE|DA|DO|DOS|DAS|E)[ \t]+)?(\p{Lu}{2,}))+)(?=$|[^a-zA-ZÀ-ÿ_])/gu;
  const matches = Array.from(text.matchAll(nameSeqRegex)).map(m => m[1].trim());
  if (matches.length > 0) {
    const candidates = matches.filter(cand => {
      const norm = cand.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (knownHeaders.has(norm)) return false;
      // Ensure it doesn't consist entirely of keywords
      const words = cand.split(/\s+/);
      const nonKeywords = words.filter(w => !keywords.has(w.toUpperCase()));
      return nonKeywords.length > 0;
    });
    
    if (candidates.length > 0) {
      // Sort to pick the longest contiguous chain first
      candidates.sort((a, b) => b.length - a.length);
      return candidates[0];
    }
  }

  return "";
}

/**
 * Checksum validation for Brazilian CPF.
 */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/**
 * Parses and formats CPF (11 digits) as 000.000.000-00, verifying its checksum.
 */
function parseCpf(text: string): string {
  // Extract all candidate sequences of digits (with optional dots, dashes, spaces)
  // that have between 11 and 14 digits in total.
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

/**
 * Parses real estate value ending in 'k' or 'M'.
 */
function parseValorImovel(text: string): { value: number; raw: string } {
  const match = text.match(/(\d+(?:[.,]\d+)?)[ \t]*([kKMm])\b/);
  if (!match) return { value: 0, raw: "" };
  const numStr = match[1].replace(',', '.');
  const unit = match[2].toLowerCase();
  const val = parseFloat(numStr);
  let value = 0;
  if (unit === 'k') {
    value = val * 1000;
  } else if (unit === 'm') {
    value = val * 1000000;
  }
  return { value, raw: match[0] };
}

/**
 * Parses the origin group (e.g., WhatsApp group name).
 */
function parseGrupoOrigem(text: string): string {
  // First, check for explicit "Grupo: ...", "Canal: ...", "Origem: ..."
  const explicitMatch = text.match(/(?:Grupo|Canal|Origem):[ \t]*([^\n\r:]+)/i);
  if (explicitMatch && explicitMatch[1].trim()) {
    return explicitMatch[1].trim();
  }

  // Second, check for WhatsApp header bracket pattern, e.g. "[11:06, 11/06/2026] Grupo Name:"
  const headerMatch = text.match(/\[\d{2}:\d{2},?[ \t]+\d{2}\/\d{2}(?:\/\d{4})?\][ \t]*([^:\n\r]+):/);
  if (headerMatch && headerMatch[1].trim()) {
    return headerMatch[1].trim();
  }

  // Check for similar header pattern without brackets, e.g., "11:06, 11/06/2026 - Grupo Name:"
  const headerMatch2 = text.match(/^\d{2}:\d{2},?[ \t]+\d{2}\/\d{2}(?:\/\d{4})?[ \t]*-[ \t]*([^:\n\r]+):/m);
  if (headerMatch2 && headerMatch2[1].trim()) {
    return headerMatch2[1].trim();
  }

  return "WhatsApp";
}

/**
 * Parses Analyst handle (starting with @).
 */
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

/**
 * Parses Service type.
 */
function parseServico(text: string): { servico: string; originalText: string } | null {
  const terms = [
    'NOVA AVALIAÇÃO', 'NOVA AVALIACAO',
    'REAVALIAÇÃO', 'REAVALIACAO',
    'AVALIAÇÃO', 'AVALIACAO'
  ];
  for (const term of terms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      let standardized = term.toUpperCase();
      if (standardized === 'AVALIACAO') standardized = 'AVALIAÇÃO';
      if (standardized === 'REAVALIACAO') standardized = 'REAVALIAÇÃO';
      if (standardized === 'NOVA AVALIACAO') standardized = 'NOVA AVALIAÇÃO';
      return {
        servico: standardized,
        originalText: match[0]
      };
    }
  }
  return null;
}

/**
 * Parses Date and Time, defaulting to year 2026.
 */
function parseDataHoraEntrada(text: string): { isoString: string; raw: string } {
  // Look for a date in DD/MM/YYYY or DD/MM format
  const dateRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/;
  const dateMatch = text.match(dateRegex);

  if (!dateMatch) {
    return { isoString: new Date().toISOString(), raw: "" };
  }

  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : 2026;
  const rawDate = dateMatch[0];

  // Look for time in HH:MM format
  const timeRegex = /\b(\d{1,2})[:h](\d{2})\b/;
  const timeMatch = text.match(timeRegex);

  let hours = 0;
  let minutes = 0;

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  }

  const dateObj = new Date(year, month - 1, day, hours, minutes);
  return { isoString: dateObj.toISOString(), raw: rawDate };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFullWord(text: string, search: string, replacement: string): string {
  if (!search) return text;
  const escaped = escapeRegExp(search);
  const regex = new RegExp(`(?<=^|[^A-Za-zÀ-ÿ0-9_])${escaped}(?=$|[^A-Za-zÀ-ÿ0-9_])`, 'gi');
  return text.replace(regex, replacement);
}

/**
 * Cleans the input text by removing all matched structured fields and labels,
 * leaving only the remaining text for Notes.
 */
function parseNotes(
  text: string,
  nome: string,
  cpf: string,
  valorStr: string,
  analistaOriginalText: string,
  servicoOriginalText: string,
  dateOriginalText: string,
  grupoOrigem: string,
  cidadeRawText: string
): string {
  const lines = text.split(/\r?\n/);
  const notesLines: string[] = [];

  const labelsToRemove = [
    /^\s*nome(?:[\s_]+do)?(?:[\s_]+cliente)?[ \t]*:[ \t]*/i,
    /^\s*cliente[ \t]*:[ \t]*/i,
    /^\s*cpf(?:[\s_]+cliente)?[ \t]*:[ \t]*/i,
    /^\s*valor(?:[\s_]+do)?(?:[\s_]+im[oó]vel)?[ \t]*:[ \t]*/i,
    /^\s*analista(?:[\s_]+respons[aá]vel)?[ \t]*:[ \t]*/i,
    /^\s*servi[cç]o[ \t]*:[ \t]*/i,
    /^\s*data(?:[\s_]+hora)?(?:[\s_]+entrada)?[ \t]*:[ \t]*/i,
    /^\s*grupo(?:[\s_]+origem)?[ \t]*:[ \t]*/i,
    /^\s*canal[ \t]*:[ \t]*/i,
    /^\s*origem[ \t]*:[ \t]*/i,
    /^\s*obs(?:ervac[oõ]es|ervac[aã]o)?[ \t]*:[ \t]*/i,
    /^\s*notas?[ \t]*:[ \t]*/i,
  ];

  for (const line of lines) {
    let cleanedLine = line.trim();
    if (!cleanedLine) continue;

    // Remove WhatsApp header patterns
    if (/^\[\d{2}:\d{2},?[ \t]+\d{2}\/\d{2}(?:\/\d{4})?\].*$/i.test(cleanedLine)) {
      continue;
    }
    if (/^\d{2}:\d{2},?[ \t]+\d{2}\/\d{2}(?:\/\d{4})?[ \t]*-[ \t]*.*$/i.test(cleanedLine)) {
      continue;
    }

    // Remove matched values if they exist using word boundary replacement
    if (nome) {
      cleanedLine = replaceFullWord(cleanedLine, nome, "");
    }
    if (cpf) {
      cleanedLine = replaceFullWord(cleanedLine, cpf, "");
      const cpfRaw = cpf.replace(/\D/g, "");
      if (cpfRaw) {
        cleanedLine = replaceFullWord(cleanedLine, cpfRaw, "");
      }
    }
    if (valorStr) {
      cleanedLine = replaceFullWord(cleanedLine, valorStr, "");
    }
    if (analistaOriginalText) {
      cleanedLine = replaceFullWord(cleanedLine, analistaOriginalText, "");
    }
    if (servicoOriginalText) {
      cleanedLine = replaceFullWord(cleanedLine, servicoOriginalText, "");
    }
    if (dateOriginalText) {
      cleanedLine = replaceFullWord(cleanedLine, dateOriginalText, "");
    }
    if (grupoOrigem) {
      cleanedLine = replaceFullWord(cleanedLine, grupoOrigem, "");
    }
    if (cidadeRawText) {
      cleanedLine = replaceFullWord(cleanedLine, cidadeRawText, "");
    }

    // Remove labels/prefixes
    for (const labelRegex of labelsToRemove) {
      cleanedLine = cleanedLine.replace(labelRegex, "");
    }

    // Clean remaining punctuation and layout markers
    cleanedLine = cleanedLine.replace(/^[:\s\-*•>#]+/, "").replace(/[:\s\-*•<#]+$/, "").trim();

    if (cleanedLine && !/^[:\s\-*•|]+$/.test(cleanedLine)) {
      notesLines.push(cleanedLine);
    }
  }

  return notesLines.join(" ");
}

function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .map(word => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Main parser function to convert raw lead text to ParsedLead object.
 */
export function parseRawText(text: string): ParsedLead {
  const nome_cliente = parseNomeCliente(text);
  const cpf_cliente = parseCpf(text);
  
  const valorResult = parseValorImovel(text);
  const valor_imovel = valorResult.value;
  
  const analistaResult = parseAnalista(text);
  const servicoResult = parseServico(text);
  const dateResult = parseDataHoraEntrada(text);

  let cidade = "Não Informada";
  let grupo_origem = "";
  let cidadeRawText = "";
  
  // Segment-based parsing for Cidade and Grupo
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || "";
  if (firstLine.includes("-")) {
    const segments = firstLine.split("-").map(s => s.trim());
    const candidates: string[] = [];
    
    for (const seg of segments) {
      if (!seg) continue;
      
      // Classify and filter out known segment types:
      // 1. Service / Date
      const hasService = /AVALIA[CÇ]A[OÕ]/i.test(seg);
      const hasDate = /\b\d{1,2}\/\d{1,2}\b/.test(seg);
      if (hasService || hasDate) continue;
      
      // 2. Value
      const hasValue = /\b\d+(?:[.,]\d+)?\s*[kKMm]\b/.test(seg);
      if (hasValue) continue;
      
      // 3. CPF (valid checksum check)
      const cleanDigits = seg.replace(/\D/g, "");
      const hasCpf = cleanDigits.length === 11 && isValidCpf(cleanDigits);
      if (hasCpf) continue;
      
      // 4. Analyst Handle
      const hasAnalyst = seg.includes("@");
      if (hasAnalyst) continue;
      
      // 5. Client Name
      const cleanNome = nome_cliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const cleanSeg = seg.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (cleanNome && cleanSeg.includes(cleanNome)) continue;
      
      // 6. Financing
      const isFinancing = /^(SBPE|MCMV)$/i.test(seg);
      if (isFinancing) continue;
      
      // 7. Agency / FID
      const isAgency = /\bag\s*\d+\b/i.test(seg) || /\bFID\s*\d+/i.test(seg);
      if (isAgency) continue;
      
      candidates.push(seg);
    }
    
    if (candidates.length > 0) {
      grupo_origem = candidates[0];
      if (candidates.length > 1) {
        cidadeRawText = candidates[1];
        cidade = capitalizeWords(cidadeRawText);
      }
    }
  }
  
  if (!grupo_origem) {
    grupo_origem = parseGrupoOrigem(text);
  }

  const notes = parseNotes(
    text,
    nome_cliente,
    cpf_cliente,
    valorResult.raw,
    analistaResult ? analistaResult.originalText : "",
    servicoResult ? servicoResult.originalText : "",
    dateResult.raw,
    grupo_origem,
    cidadeRawText
  );



  // Format informacoes_importantes
  const infoParts: string[] = [];
  if (analistaResult) {
    infoParts.push(`Analista: ${analistaResult.handle}`);
  }
  if (servicoResult) {
    infoParts.push(`Serviço: ${servicoResult.servico}`);
  }
  if (notes) {
    infoParts.push(`Notas: ${notes}`);
  }
  const informacoes_importantes = infoParts.join("\n");

  return {
    nome_cliente,
    cpf_cliente,
    valor_imovel,
    cidade,
    grupo_origem,
    informacoes_importantes,
    data_hora_entrada: dateResult.isoString,
    analista: analistaResult ? analistaResult.handle : "",
    servico: servicoResult ? servicoResult.servico : "AVALIAÇÃO",
    notes: notes,
  };
}
