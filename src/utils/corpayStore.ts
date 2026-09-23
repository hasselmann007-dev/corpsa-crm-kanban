export interface LancamentoCorPay {
  id: string;
  lead_id: string;
  analista_nome: string;
  data_hora: string;
  tipo_imovel: 'Planta' | 'Usado' | 'Novo' | 'Terreno & Construção' | 'Comercial' | string;
  programa: 'MCMV' | 'SBPE';
  tipo_servico: 'Avaliação' | 'Reavaliação';
  valor_remuneracao: number;
  resultado: 'Aprovado' | 'Condicionado' | 'Reprovado' | 'Em Análise' | string;
  observacoes: string;
}

/**
 * Retorna o valor oficial de remuneração da CORPSA
 */
export function getValorPadraoCorPay(
  tipoServico: 'Avaliação' | 'Reavaliação',
  programa: 'MCMV' | 'SBPE'
): number {
  if (tipoServico === 'Reavaliação') return 7.00;
  if (tipoServico === 'Avaliação') {
    if (programa === 'MCMV') return 12.00;
    if (programa === 'SBPE') return 13.00;
  }
  return 7.00;
}

/**
 * Extrai a lista de lançamentos CorPay serializada no texto de informacoes_importantes
 */
export function extrairLancamentosCorPay(
  info?: string | null,
  leadId?: string,
  fallbackLead?: {
    adicionado_corpay?: boolean;
    tipo_avaliacao?: string;
    tipo_financiamento?: string;
    analista?: string;
    data_hora_entrada?: string;
  }
): LancamentoCorPay[] {
  if (!info) {
    // Se não há tag, mas adicionado_corpay está ativo, gera 1 lançamento retrocompatível
    if (fallbackLead?.adicionado_corpay && leadId) {
      const tipoServico: 'Avaliação' | 'Reavaliação' = 
        fallbackLead.tipo_avaliacao === 'Reavaliação' ? 'Reavaliação' : 'Avaliação';
      const programa: 'MCMV' | 'SBPE' = 
        fallbackLead.tipo_financiamento === 'SBPE' ? 'SBPE' : 'MCMV';
      const valor = getValorPadraoCorPay(tipoServico, programa);
      return [{
        id: `cp-legacy-${leadId.slice(0, 8)}`,
        lead_id: leadId,
        analista_nome: fallbackLead.analista || 'Danilo Hasselmann',
        data_hora: fallbackLead.data_hora_entrada || new Date().toISOString(),
        tipo_imovel: 'Planta',
        programa,
        tipo_servico: tipoServico,
        valor_remuneracao: valor,
        resultado: 'Aprovado',
        observacoes: 'Lançamento inicial importado'
      }];
    }
    return [];
  }

  const match = info.match(/\[CORPAY_LANCAMENTOS:\s*(\[[\s\S]*?\])\s*\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return parsed as LancamentoCorPay[];
      }
    } catch (_e) {
      console.warn('Falha ao parsear CORPAY_LANCAMENTOS do lead');
    }
  }

  // Fallback retrocompatível se já tinha adicionado_corpay mas sem tag JSON
  if (fallbackLead?.adicionado_corpay && leadId) {
    const tipoServico: 'Avaliação' | 'Reavaliação' = 
      fallbackLead.tipo_avaliacao === 'Reavaliação' ? 'Reavaliação' : 'Avaliação';
    const programa: 'MCMV' | 'SBPE' = 
      fallbackLead.tipo_financiamento === 'SBPE' ? 'SBPE' : 'MCMV';
    const valor = getValorPadraoCorPay(tipoServico, programa);
    return [{
      id: `cp-legacy-${leadId.slice(0, 8)}`,
      lead_id: leadId,
      analista_nome: fallbackLead.analista || 'Danilo Hasselmann',
      data_hora: fallbackLead.data_hora_entrada || new Date().toISOString(),
      tipo_imovel: 'Planta',
      programa,
      tipo_servico: tipoServico,
      valor_remuneracao: valor,
      resultado: 'Aprovado',
      observacoes: 'Lançamento inicial registrado'
    }];
  }

  return [];
}

/**
 * Serializa a lista de lançamentos CorPay dentro de informacoes_importantes
 */
export function serializarLancamentosCorPay(info: string, lancamentos: LancamentoCorPay[]): string {
  let base = info || '';
  const jsonStr = JSON.stringify(lancamentos);
  const tagStr = `[CORPAY_LANCAMENTOS: ${jsonStr}]`;

  if (/\[CORPAY_LANCAMENTOS:\s*\[[\s\S]*?\]\s*\]/.test(base)) {
    return base.replace(/\[CORPAY_LANCAMENTOS:\s*\[[\s\S]*?\]\s*\]/, tagStr);
  }

  return `${base.trim()}\n${tagStr}`.trim();
}

/**
 * Calcula os totais de remuneração estritamente para o analista logado
 * (NUNCA mistura dados com outros analistas)
 */
export function calcularRemuneracaoAnalista(
  leads: any[],
  currentAnalistaNome: string
): { total: number; count: number; lancamentos: LancamentoCorPay[] } {
  if (!currentAnalistaNome) return { total: 0, count: 0, lancamentos: [] };
  const targetClean = currentAnalistaNome.toLowerCase().trim();

  let total = 0;
  const lancamentosAnalista: LancamentoCorPay[] = [];

  for (const lead of leads) {
    const lista = extrairLancamentosCorPay(lead.informacoes_importantes, lead.id, {
      adicionado_corpay: lead.adicionado_corpay,
      tipo_avaliacao: lead.tipo_avaliacao,
      tipo_financiamento: lead.tipo_financiamento,
      analista: lead.analista || currentAnalistaNome,
      data_hora_entrada: lead.data_hora_entrada
    });

    for (const item of lista) {
      const lancClean = (item.analista_nome || '').toLowerCase().trim();
      // O lançamento pertence estritamente ao analista logado
      if (lancClean === targetClean || lancClean.includes(targetClean) || targetClean.includes(lancClean)) {
        total += Number(item.valor_remuneracao || 0);
        lancamentosAnalista.push(item);
      }
    }
  }

  return {
    total,
    count: lancamentosAnalista.length,
    lancamentos: lancamentosAnalista
  };
}
