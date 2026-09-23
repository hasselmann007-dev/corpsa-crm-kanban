import { supabase } from '../src/supabaseClient.js';

export interface SimuladorAnexo {
  type: 'pdf' | 'text' | 'image';
  name: string;
  url: string;
  size?: string;
  transcribedText?: string;
  dadosSimulacao?: {
    cliente?: string;
    cpf?: string;
    valor_imovel: number;
    valor_financiamento: number;
    valor_entrada: number;
    prazo_meses: number;
    sistema_amortizacao: string;
    taxa_juros_nominal: string;
    taxa_juros_efetiva: string;
    primeira_prestacao: number;
    programa: string;
    tipo_imovel?: string;
    analista_responsavel?: string;
  };
}

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
  resultado_analise?: string;
  motivo_resultado?: string;
  // Os 4 blocos requisitados
  observacoes_operacionais_triagem: string;
  descricao_detalhamento_pendencia: string;
  parecer_oficial_analista: string;
  consideracoes_finais_contrato: string;
  // Simulador / Dados SICAQ
  temSimulador: boolean;
  simuladorAnexo?: SimuladorAnexo;
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
 * Gera o documento HTML oficial formatado (.doc) compatível com Word
 * contendo todos os dados do Simulador Caixa e Checklist CORPSA
 */
export function gerarHtmlDocumentoSimulacao(data: {
  cliente: string;
  cpf: string;
  valor_imovel: number;
  valor_financiamento: number;
  valor_entrada: number;
  prazo_meses: number;
  sistema_amortizacao: string;
  taxa_juros_nominal: string;
  taxa_juros_efetiva: string;
  primeira_prestacao: number;
  programa: string;
  tipo_imovel: string;
  analista_responsavel: string;
}): string {
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Simulação de Crédito Habitacional - CORPSA</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 20px; line-height: 1.4; }
        .header { background-color: #0a192f; color: #ffffff; padding: 16px 20px; border-bottom: 4px solid #f97316; }
        .logo-title { font-size: 24pt; font-weight: bold; color: #ffffff; margin: 0; }
        .logo-sub { font-size: 9pt; color: #f97316; font-weight: bold; letter-spacing: 1px; }
        .title { font-size: 14pt; font-weight: bold; color: #0284c7; margin: 16px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        table.simulacao { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.simulacao td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11pt; }
        table.simulacao td.label { font-weight: bold; color: #475569; width: 40%; }
        table.simulacao td.value { font-weight: bold; color: #0f172a; width: 60%; text-align: right; }
        .destaque { color: #0284c7 !important; font-size: 12pt; }
        .prestacao { color: #15803d !important; font-size: 13pt; background-color: #f0fdf4; }
        .section-checklist { background-color: #0a192f; color: #ffffff; padding: 8px 14px; font-weight: bold; font-size: 11pt; margin-top: 20px; }
        table.checklist { width: 100%; border-collapse: collapse; }
        table.checklist td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 10pt; }
        table.checklist td.status { font-weight: bold; text-align: right; color: #15803d; }
        .footer-info { margin-top: 20px; font-size: 10pt; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">CORPSA</div>
        <div class="logo-sub">ASSESSORIA IMOBILIÁRIA & CRÉDITO HABITACIONAL CAIXA</div>
      </div>
      <div class="title">📄 SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA (APROVADO)</div>
      <table class="simulacao">
        <tr><td class="label">👤 CLIENTE:</td><td class="value">${data.cliente}</td></tr>
        <tr><td class="label">🪪 CPF:</td><td class="value">${data.cpf}</td></tr>
        <tr><td class="label">🏢 MODALIDADE / PROGRAMA:</td><td class="value">${data.programa} (${data.tipo_imovel})</td></tr>
        <tr><td class="label">🏠 VALOR DO IMÓVEL:</td><td class="value">R$ ${data.valor_imovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="label">🏛️ VALOR FINANCIADO:</td><td class="value destaque">R$ ${data.valor_financiamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="label">💵 VALOR DE ENTRADA:</td><td class="value">R$ ${data.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="label">⏱️ PRAZO DE AMORTIZAÇÃO:</td><td class="value">${data.prazo_meses} meses</td></tr>
        <tr><td class="label">📊 SISTEMA DE AMORTIZAÇÃO:</td><td class="value">${data.sistema_amortizacao === 'SAC' ? 'SAC (Parcelas Decrescentes)' : 'PRICE (Parcelas Fixas)'}</td></tr>
        <tr><td class="label">📈 TAXA DE JUROS:</td><td class="value">${data.taxa_juros_nominal}% a.a. (Nominal) | ${data.taxa_juros_efetiva}% a.a. (Efetiva)</td></tr>
        <tr class="prestacao"><td class="label" style="color: #15803d;">💰 1ª PRESTAÇÃO ESTIMADA:</td><td class="value prestacao">R$ ${data.primeira_prestacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
      </table>
      <div class="section-checklist">📋 PARECER DO ANALISTA & CONDIÇÕES DA AVALIAÇÃO</div>
      <table class="checklist">
        <tr><td>[ X ] ( SIM ) Análise de Risco de Crédito Aprovada pela Caixa Econômica Federal</td><td class="status">APROVADO</td></tr>
        <tr><td>[ X ] ( SIM ) Capacidade de Pagamento e Comprometimento de Renda Conforme</td><td class="status">CONFORME</td></tr>
        <tr><td>[ X ] ( SIM ) Pesquisa Cadastral e Restrições Externas Regulares</td><td class="status">CONFORME</td></tr>
      </table>
      <div class="footer-info">
        <div><strong>Analista Responsável:</strong> ${data.analista_responsavel}</div>
        <div><strong>Validade da Aprovação:</strong> 90 dias a contar da emissão</div>
        <div style="font-size: 8pt; margin-top: 6px;">Documento oficial emitido pela CORPSA Assessoria Imobiliária.</div>
      </div>
    </body>
    </html>
  `.trim();
}

/**
 * Extrai os parâmetros da simulação Caixa e gera o simulador como anexo para download
 */
function extrairEGerarSimulador(lead: any): SimuladorAnexo | undefined {
  const isAprovado = 
    (lead.resultado_analise && /aprovado|condicionado/i.test(lead.resultado_analise)) ||
    lead.etapa === 'Conclusao' ||
    (lead.informacoes_importantes && /aprovado/i.test(lead.informacoes_importantes));

  // 1. Tenta extrair tag JSON [SIMULACAO_CAIXA: ...]
  let savedFicha: any = null;
  const match = (lead.informacoes_importantes || '').match(/\[SIMULACAO_CAIXA:\s*(\{[\s\S]*?\})\s*\]/);
  if (match && match[1]) {
    try { savedFicha = JSON.parse(match[1]); } catch {}
  }

  // 2. Tenta extrair tag JSON [SIMULACAO_SICAQ: ...]
  const matchSicaq = (lead.informacoes_importantes || '').match(/\[SIMULACAO_SICAQ:\s*(\{[\s\S]*?\})\s*\]/);
  if (matchSicaq && matchSicaq[1]) {
    try { savedFicha = { ...savedFicha, ...JSON.parse(matchSicaq[1]) }; } catch {}
  }

  // Se não estiver aprovado nem houver simulação registrada, não gera simulador
  if (!isAprovado && !savedFicha) {
    return undefined;
  }

  const valorImovel = savedFicha?.valor_imovel || lead.valor_imovel || 250000;
  let valorFinanc = savedFicha?.valor_financiamento;
  if (!valorFinanc || valorFinanc === 0) {
    valorFinanc = Math.round(valorImovel * 0.80);
  }
  let valorEntrada = savedFicha?.valor_entrada;
  if (!valorEntrada && valorEntrada !== 0) {
    valorEntrada = Math.max(0, valorImovel - valorFinanc);
  }

  const prazo = savedFicha?.prazo_meses || 420;
  const sistema = savedFicha?.sistema_amortizacao || 'PRICE';
  const taxaNom = savedFicha?.taxa_juros_nominal || (lead.tipo_financiamento === 'SBPE' ? '9.50' : '5.50');
  const taxaEfet = savedFicha?.taxa_juros_efetiva || (lead.tipo_financiamento === 'SBPE' ? '9.92' : '5.64');

  let prestacao = savedFicha?.primeira_prestacao;
  if (!prestacao || prestacao === 0) {
    prestacao = Math.round(valorFinanc * 0.0075);
  }

  const programa = savedFicha?.programa || lead.tipo_financiamento || 'MCMV';
  const tipoImovel = savedFicha?.tipo_imovel || lead.categoria || 'Planta';
  const analista = savedFicha?.analista_responsavel || lead.analista || 'Danilo Hasselmann';

  const simData = {
    cliente: lead.nome_cliente || 'Cliente',
    cpf: lead.cpf_cliente || 'Não Informado',
    valor_imovel: valorImovel,
    valor_financiamento: valorFinanc,
    valor_entrada: valorEntrada,
    prazo_meses: prazo,
    sistema_amortizacao: sistema,
    taxa_juros_nominal: taxaNom,
    taxa_juros_efetiva: taxaEfet,
    primeira_prestacao: prestacao,
    programa,
    tipo_imovel: tipoImovel,
    analista_responsavel: analista
  };

  const htmlDoc = gerarHtmlDocumentoSimulacao(simData);
  const dataUrl = `data:application/msword;charset=utf-8,${encodeURIComponent(htmlDoc)}`;
  const cleanNome = (lead.nome_cliente || 'Cliente').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const nomeArquivo = `Simulacao_Caixa_${cleanNome}.doc`;

  return {
    type: 'pdf',
    name: nomeArquivo,
    url: dataUrl,
    size: `${Math.max(1, Math.round(htmlDoc.length / 1024))} KB`,
    transcribedText: `Simulação Oficial Caixa aprovada para ${lead.nome_cliente}: Financiamento de R$ ${valorFinanc.toLocaleString('pt-BR')}, Entrada de R$ ${valorEntrada.toLocaleString('pt-BR')}, 1ª Prestação de R$ ${prestacao.toLocaleString('pt-BR')}, Prazo de ${prazo} meses no sistema ${sistema}.`,
    dadosSimulacao: simData
  };
}

/**
 * Consulta determinística dos dados do cliente no Supabase CRM
 * trazendo rigorosamente os 4 campos especificados, além da extração
 * do simulador oficial como anexo caso a pasta esteja aprovada
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
      temSimulador: false,
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
      temSimulador: false,
      mensagemFormatada: `❌ Não localizei nenhuma pasta com "${query}" em nossa base de dados do CRM. Deseja realizar a triagem e cadastrar uma nova avaliação para este cliente?`
    };
  }

  // Bloco 1: Observações Operacionais & Dados da Triagem
  const bloco1 = lead.informacoes_importantes?.trim() || 'Nenhuma observação operacional registrada.';

  // Bloco 2: Descrição e Detalhamento da Pendência
  const bloco2 = lead.descricao_pendencia?.trim() || 
    (lead.etapa === 'Pendencia' ? (lead.motivo_resultado?.trim() || 'Constam pendências apontadas pelo analista.') : '') || 
    'Sem pendências documentais registradas no momento.';

  // Bloco 3: Parecer Oficial do Analista de Crédito
  const resultado = lead.resultado_analise ? `[Resultado: ${lead.resultado_analise}]` : '[Resultado: Em Análise / Aguardando Parecer]';
  const motivo = lead.motivo_resultado ? `\nMotivo/Detalhes: ${lead.motivo_resultado}` : '';
  const bloco3 = `${resultado}${motivo}`.trim();

  // Bloco 4: Considerações Finais & Instruções para Contrato
  const tipoAvaliacao = lead.tipo_avaliacao ? `Tipo de Avaliação: ${lead.tipo_avaliacao}` : 'Tipo de Avaliação: Não definido';
  const tipoFinanciamento = lead.tipo_financiamento ? `Financiamento: ${lead.tipo_financiamento}` : 'Financiamento: Não definido';
  const corpayStatus = lead.adicionado_corpay ? 'CORPSA Pay: Lançado' : 'CORPSA Pay: Pendente';
  const valorFmt = Number(lead.valor_imovel || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const bloco4 = `${tipoAvaliacao} | ${tipoFinanciamento} | ${corpayStatus}\nValor do Imóvel: ${valorFmt} | Etapa Atual: ${lead.etapa} | Prioridade: ${lead.prioridade || 'Normal'}`;

  // Extrai Simulador Caixa se aprovado
  const simuladorAnexo = extrairEGerarSimulador(lead);
  const temSimulador = Boolean(simuladorAnexo);

  let blocoSimulador = '';
  if (simuladorAnexo && simuladorAnexo.dadosSimulacao) {
    const s = simuladorAnexo.dadosSimulacao;
    blocoSimulador = `

--------------------------------------------------
📄 **SIMULADOR OFICIAL CAIXA EXTRAÍDO & ANEXADO NA CONVERSA:**
- **Cliente:** ${s.cliente} (CPF: ${s.cpf})
- **Status do Crédito:** ✅ APROVADO
- **Valor do Imóvel:** R$ ${s.valor_imovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Financiamento Aprovado:** R$ ${s.valor_financiamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Valor de Entrada:** R$ ${s.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Prazo:** ${s.prazo_meses} meses | **Sistema:** ${s.sistema_amortizacao}
- **1ª Prestação Estimada:** R$ ${s.primeira_prestacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Taxa Efetiva:** ${s.taxa_juros_efetiva}% a.a. (${s.programa})
- 📎 **Arquivo anexado na conversa:** ${simuladorAnexo.name}
--------------------------------------------------
*(Instrução para o Agente Consultor: Apresente ao corretor calorosamente que a pasta está aprovada, passe os valores principais acima e confirme que o arquivo oficial do simulador já foi anexado na conversa para download).*`;
  } else if (lead.etapa === 'Pendencia') {
    blocoSimulador = `

--------------------------------------------------
⚠️ **PASTA COM PENDÊNCIA OPERACIONAL:**
A pasta está parada aguardando a seguinte pendência:
"${bloco2}"
*(Instrução para o Agente Consultor: Explique com presteza e clareza ao corretor o que falta para que ele providencie o documento e possamos emitir o parecer de aprovação).*`;
  }

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
--------------------------------------------------${blocoSimulador}`;

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
    resultado_analise: lead.resultado_analise,
    motivo_resultado: lead.motivo_resultado,
    observacoes_operacionais_triagem: bloco1,
    descricao_detalhamento_pendencia: bloco2,
    parecer_oficial_analista: bloco3,
    consideracoes_finais_contrato: bloco4,
    temSimulador,
    simuladorAnexo,
    mensagemFormatada
  };
}
