export interface ConsultaRapida {
  id: string;
  created_at: string;
  tipo_consulta: 'irpf' | 'imovel' | 'cpf' | 'serasa' | 'outros';
  nome_cliente: string;
  cpf_cliente?: string;
  data_nascimento?: string;
  documento_identificacao?: string; // RG, CNH, Matrícula
  detalhes_solicitacao: string;
  status: 'Pendente' | 'Em Análise' | 'Respondido';
  analista_responsavel?: string;
  resultado_checkboxes?: {
    pesquisa_limpa?: boolean;
    possui_restricao?: boolean;
    pendencia_documental?: boolean;
    irpf_pendente?: boolean;
    imovel_localizado?: boolean;
  };
  devolutiva_texto?: string;
  data_devolutiva?: string;
  canal_origem?: string;
}

export interface AnalistaPresenca {
  id: string;
  nome: string;
  cargo: string;
  isOnline: boolean;
  ultima_atividade: string;
}

export interface FichaCaixaData {
  cliente: string;
  cpf: string;
  programa?: 'MCMV' | 'SBPE' | string;
  tipo_imovel?: 'Planta' | 'Novo' | 'Usado' | 'Terreno e Construção' | string;
  modalidade_imovel?: string;
  valor_imovel: number;
  valor_financiamento: number;
  valor_entrada: number;
  prazo_meses: number;
  sistema_amortizacao: 'SAC' | 'PRICE';
  taxa_juros_nominal: string;
  taxa_juros_efetiva: string;
  primeira_prestacao: number;
  cidade?: string;
  
  // Checklist Interno CORPSA
  fator_social_aplicado: boolean;
  fgts_36_meses_comprovado: boolean;
  restricoes_externas_limpas: boolean;
  possui_imovel_pesquisas: boolean; // Substituiu avaliação de engenheiro conforme Anexo 2
  avaliacao_engenheiro_compativel?: boolean;
  irpf_apresentado: boolean;

  // Observações e Pendências Documentais por Item do Checklist (Table Text)
  pendencias_checklist?: {
    fator_social?: string;
    fgts_36_meses?: string;
    restricoes_externas?: string;
    possui_imovel_pesquisas?: string;
    irpf_apresentado?: string;
  };

  validade_avaliacao: string;
  analista_responsavel: string;
  documentos_anexados?: { nome: string; url?: string; tipo?: string }[];
}
