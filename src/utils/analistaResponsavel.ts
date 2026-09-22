import { getAnalistasPresenca } from './consultaRapidaStore';
import type { Lead } from '../App';

/**
 * Identifica o analista responsável atual de um lead a partir das notas/informações importantes
 */
export function getAnalistaResponsavel(lead: Partial<Lead>, fallbackName = 'Danilo Hasselmann'): string {
  const raw = lead.informacoes_importantes || '';

  // 1. Prioridade: Tag explícita de responsável após troca/atribuição
  const respMatch = raw.match(/\[ANALISTA RESPONS[ÁA]VEL\]:\s*([^\n\r]+)/i);
  if (respMatch && respMatch[1].trim()) {
    return respMatch[1].trim().replace(/^@/, '');
  }

  // 2. Formato gerado pelo parser inicial: "Analista: @Nome" ou "Analista: Nome"
  const analistaMatch = raw.match(/(?:^|\n)Analista:\s*@?([^\n\r]+)/i);
  if (analistaMatch && analistaMatch[1].trim()) {
    return analistaMatch[1].trim();
  }

  return fallbackName;
}

/**
 * Verifica se o analista responsável está online no sistema no momento
 */
export function isAnalistaOnline(analistaNome: string): boolean {
  if (!analistaNome) return false;
  const lista = getAnalistasPresenca();
  const cleanTarget = analistaNome.toLowerCase().trim().replace(/^@/, '');

  const found = lista.find(a => {
    const cleanNome = a.nome.toLowerCase().trim();
    return cleanNome === cleanTarget || cleanNome.includes(cleanTarget) || cleanTarget.includes(cleanNome);
  });

  return found ? found.isOnline : true; // Se não estiver na lista fixa, assume online por padrão
}

export type MotivoTrocaAnalista = 
  | 'Pegar Pendência'
  | 'Pegar Reavaliação'
  | 'Assumir Atendimento Geral'
  | 'Cobrir Ausência do Analista';

/**
 * Gera o novo texto de `informacoes_importantes` com a substituição do responsável
 * e o histórico auditável da troca para persistência no banco Supabase
 */
export function registrarTrocaAnalista(
  lead: Lead,
  novoAnalista: string,
  motivo: MotivoTrocaAnalista | string,
  observacoes?: string
): { novoTextoInfo: string; mensagemChat: string; analistaAnterior: string } {
  const analistaAnterior = getAnalistaResponsavel(lead);
  const agora = new Date();
  const dataHoraFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + 
    ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Mensagem para o chat do cliente
  const mensagemChat = `🔄 Troca de Responsável: ${novoAnalista} assumiu a pasta (${motivo}). Analista anterior: ${analistaAnterior}.${observacoes ? ` Obs: ${observacoes.trim()}` : ''}`;

  // Bloco auditável para informacoes_importantes no Supabase
  const logAudit = `\n[TROCA DE ANALISTA - ${dataHoraFormatada}]: ${novoAnalista} assumiu a pasta (Motivo: ${motivo} | Anterior: ${analistaAnterior})${observacoes ? ` - Detalhes: ${observacoes.trim()}` : ''}`;

  let textoBase = lead.informacoes_importantes || '';

  // Remove tag anterior de responsável se existir
  textoBase = textoBase.replace(/\[ANALISTA RESPONS[ÁA]VEL\]:[^\n\r]*(\r?\n)?/gi, '');

  const novoTextoInfo = `[ANALISTA RESPONSÁVEL]: ${novoAnalista}\n${textoBase.trim()}${logAudit}`;

  return {
    novoTextoInfo,
    mensagemChat,
    analistaAnterior
  };
}
