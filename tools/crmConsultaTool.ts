import { supabase } from '../src/supabaseClient.js';

export interface ClienteCrmDossie {
  encontrado: boolean;
  id?: string;
  nome_cliente?: string;
  cpf_cliente?: string;
  etapa?: string;
  valor_imovel?: number;
  cidade?: string;
  grupo_origem?: string;
  data_hora_entrada?: string;
  // Os 4 blocos requisitados
  observacoes_operacionais_triagem: string;
  descricao_detalhamento_pendencia: string;
  parecer_oficial_analista: string;
  consideracoes_finais_contrato: string;
  mensagemFormatada: string;
}

/**
 * Normaliza CPF para formato com pontuação e apenas dígitos
 */
export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function formatarCpf(rawDigits: string): string {
  const clean = limparCpf(rawDigits);
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  return rawDigits;
}

/**
 * Consulta determinística dos dados do cliente no Supabase CRM
 * trazendo rigorosamente os 4 campos especificados
 */
export async function consultarDadosClienteCrm(identificador: string): Promise<ClienteCrmDossie> {
  const query = (identificador || '').trim();
  if (!query) {
    return {
      encontrado: false,
      observacoes_operacionais_triagem: 'Nenhum identificador fornecido.',
      descricao_detalhamento_pendencia: 'N/A',
      parecer_oficial_analista: 'N/A',
      consideracoes_finais_contrato: 'N/A',
      mensagemFormatada: 'Identificador (CPF ou Nome) não informado para consulta no CRM.'
    };
  }

  const digits = limparCpf(query);
  let lead: any = null;

  try {
    // 1. Tenta buscar por CPF se tiver 11 dígitos
    if (digits.length === 11) {
      const formattedCpf = formatarCpf(digits);
      const { data } = await supabase
        .from('leads')
        .select('*')
        .or(`cpf_cliente.eq.${formattedCpf},cpf_cliente.eq.${digits}`)
        .limit(1)
        .maybeSingle();

      if (data) lead = data;
    }

    // 2. Se não achou por CPF, tenta buscar por Nome (ilike)
    if (!lead) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .ilike('nome_cliente', `%${query}%`)
        .order('data_hora_entrada', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) lead = data;
    }
  } catch (err: any) {
    console.error('Erro ao consultar CRM:', err?.message || err);
  }

  if (!lead) {
    return {
      encontrado: false,
      observacoes_operacionais_triagem: 'Cliente não localizado na base do CRM.',
      descricao_detalhamento_pendencia: 'Nenhum registro.',
      parecer_oficial_analista: 'Nenhum registro.',
      consideracoes_finais_contrato: 'Nenhum registro.',
      mensagemFormatada: `❌ Cliente "${query}" não foi encontrado na base de dados do CRM.`
    };
  }

  // Bloco 1: Observações Operacionais & Dados da Triagem
  const bloco1 = lead.informacoes_importantes?.trim() || 'Nenhuma observação operacional registrada.';

  // Bloco 2: Descrição e Detalhamento da Pendência
  const bloco2 = lead.descricao_pendencia?.trim() || 'Sem pendências documentais registradas.';

  // Bloco 3: Parecer Oficial do Analista de Crédito
  const resultado = lead.resultado_analise ? `[Resultado: ${lead.resultado_analise}]` : '[Resultado: Não emitido]';
  const motivo = lead.motivo_resultado ? `\nMotivo/Detalhes: ${lead.motivo_resultado}` : '';
  const bloco3 = `${resultado}${motivo}`.trim();

  // Bloco 4: Considerações Finais & Instruções para Contrato
  const tipoAvaliacao = lead.tipo_avaliacao ? `Tipo de Avaliação: ${lead.tipo_avaliacao}` : 'Tipo de Avaliação: Não definido';
  const tipoFinanciamento = lead.tipo_financiamento ? `Financiamento: ${lead.tipo_financiamento}` : 'Financiamento: Não definido';
  const corpayStatus = lead.adicionado_corpay ? 'CORPSA Pay: Lançado' : 'CORPSA Pay: Pendente';
  const valorFmt = Number(lead.valor_imovel || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const bloco4 = `${tipoAvaliacao} | ${tipoFinanciamento} | ${corpayStatus}\nValor do Imóvel: ${valorFmt} | Etapa Atual: ${lead.etapa} | Prioridade: ${lead.prioridade || 'Normal'}`;

  const mensagemFormatada = `📋 **DOSSIÊ DO CLIENTE NO CRM**
- **Nome:** ${lead.nome_cliente}
- **CPF:** ${lead.cpf_cliente}
- **Etapa Atual:** ${lead.etapa}
- **Cidade / Origem:** ${lead.cidade || 'N/I'} / ${lead.grupo_origem || 'Geral'}

--------------------------------------------------
📌 **1. Observações Operacionais & Dados da Triagem:**
${bloco1}

⚠️ **2. Descrição e Detalhamento da Pendência:**
${bloco2}

⚖️ **3. Parecer Oficial do Analista de Crédito:**
${bloco3}

📑 **4. Considerações Finais & Instruções para Contrato:**
${bloco4}
--------------------------------------------------`;

  return {
    encontrado: true,
    id: lead.id,
    nome_cliente: lead.nome_cliente,
    cpf_cliente: lead.cpf_cliente,
    etapa: lead.etapa,
    valor_imovel: lead.valor_imovel,
    cidade: lead.cidade,
    grupo_origem: lead.grupo_origem,
    data_hora_entrada: lead.data_hora_entrada,
    observacoes_operacionais_triagem: bloco1,
    descricao_detalhamento_pendencia: bloco2,
    parecer_oficial_analista: bloco3,
    consideracoes_finais_contrato: bloco4,
    mensagemFormatada
  };
}
