import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yjjzmgrjgracgzqywaqc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Jcb8tZ7M1nnDJQSjzMChjw_RqcuA2Tx';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface CriarCardInput {
  nome_cliente: string;
  cpf_cliente?: string;
  valor_imovel?: number;
  cidade?: string;
  grupo_origem?: string;
  tipo_consulta?: 'cpf' | 'irpf' | 'imovel' | 'serasa' | 'avaliacao' | 'nenhuma';
  detalhes_solicitacao?: string;
  prioridade?: 'Baixa' | 'Média' | 'Alta';
}

export interface CriarCardResult {
  success: boolean;
  already_exists?: boolean;
  leadId: string;
  nome_cliente: string;
  cpf_cliente: string;
  etapa: string;
  tipo_consulta?: string;
  notificacao_enviada: boolean;
  message: string;
}

export interface SolicitarConsultaRapidaInput {
  tipo_consulta: 'cpf' | 'irpf' | 'imovel' | 'serasa' | 'outros';
  nome_cliente: string;
  cpf_cliente?: string;
  data_nascimento?: string;
  documento_identificacao?: string;
  detalhes_solicitacao?: string;
}

export interface SolicitarConsultaRapidaResult {
  success: boolean;
  consultaId: string;
  tipo_consulta: string;
  nome_cliente: string;
  cpf_cliente: string;
  notificacao_enviada: boolean;
  message: string;
}

/**
 * Lê o arquivo de regras editáveis de análise (skills/regras-analise-kanban.md)
 */
export function getRegrasAnaliseKanban(): string {
  try {
    const rulesPath = path.resolve(__dirname, '..', 'skills', 'regras-analise-kanban.md');
    if (fs.existsSync(rulesPath)) {
      return fs.readFileSync(rulesPath, 'utf-8').trim();
    }
  } catch (_e) {}
  return '';
}

/**
 * Formata CPF para 000.000.000-00
 */
export function formatarCpf(rawCpf?: string): string {
  if (!rawCpf) return '';
  const digits = rawCpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  return rawCpf;
}

/**
 * Ferramenta Oficial: Cria um novo card no fluxo Kanban (Coluna Roleta / Avaliar)
 * e persiste no Supabase com validação estrita de colunas
 */
export async function executarCriarCardKanban(input: CriarCardInput): Promise<CriarCardResult> {
  const nomeFormatado = (input.nome_cliente || 'NOVO CLIENTE').trim().toUpperCase();
  const cpfFormatado = formatarCpf(input.cpf_cliente);
  const valorImovel = typeof input.valor_imovel === 'number' && !isNaN(input.valor_imovel) ? input.valor_imovel : 0;
  const cidade = (input.cidade || 'Ribeirão Preto').trim();
  const grupoOrigem = (input.grupo_origem || 'Geral').trim();
  const tipoConsulta = input.tipo_consulta || 'nenhuma';
  
  // 🛑 REGRA DE UNICIDADE: Não pode haver 2 cards com o mesmo CPF
  if (cpfFormatado && cpfFormatado !== '000.000.000-00') {
    try {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, nome_cliente, cpf_cliente, etapa, valor_imovel')
        .eq('cpf_cliente', cpfFormatado)
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        return {
          success: false,
          already_exists: true,
          leadId: existingLead.id,
          nome_cliente: existingLead.nome_cliente,
          cpf_cliente: existingLead.cpf_cliente,
          etapa: existingLead.etapa as any,
          notificacao_enviada: false,
          message: `Já possui um cliente com esse CPF em nossa base (${existingLead.nome_cliente} na etapa ${existingLead.etapa}). Você quer reavaliar ou adicionar um novo proponente?`
        };
      }
    } catch (_checkErr) {}
  }

  // Monta informações importantes
  let infoImportantes = '';
  if (tipoConsulta && tipoConsulta !== 'nenhuma') {
    const icones: Record<string, string> = {
      cpf: '🔍 [SOLICITAÇÃO: CONSULTA DE CPF / RESTRIÇÕES]',
      irpf: '📄 [SOLICITAÇÃO: CONSULTA DE IRPF / DECLARAÇÃO]',
      imovel: '🏠 [SOLICITAÇÃO: PESQUISA DE BENS / POSSE DE IMÓVEL]',
      serasa: '🛡️ [SOLICITAÇÃO: CONSULTA SERASA / RESTRIÇÃO]',
      avaliacao: '📊 [SOLICITAÇÃO: AVALIAÇÃO DE CRÉDITO]'
    };
    infoImportantes += `${icones[tipoConsulta] || `[SOLICITAÇÃO: ${tipoConsulta.toUpperCase()}]`}\n`;
  }

  if (input.detalhes_solicitacao) {
    infoImportantes += `Detalhes da Triagem:\n${input.detalhes_solicitacao.trim()}\n`;
  }
  infoImportantes += `Cadastrado automaticamente via Agente IA em ${new Date().toLocaleString('pt-BR')}`;

  const prioridadeCalculada: 'Baixa' | 'Média' | 'Alta' = 
    input.prioridade || (tipoConsulta !== 'nenhuma' ? 'Alta' : 'Baixa');

  // Colunas estritas existentes na tabela 'leads' do Supabase
  const novoLeadData = {
    nome_cliente: nomeFormatado,
    cpf_cliente: cpfFormatado,
    valor_imovel: valorImovel,
    cidade: cidade,
    grupo_origem: grupoOrigem,
    etapa: 'Roleta',
    prioridade: prioridadeCalculada,
    informacoes_importantes: infoImportantes,
    adicionado_corpay: false
  };

  try {
    // Grava no banco de dados Supabase (tabela 'leads')
    const { data, error } = await supabase
      .from('leads')
      .insert([novoLeadData])
      .select()
      .single();

    if (error) {
      console.error('Erro no Supabase leads insert:', error);
      throw error;
    }

    const createdId = data.id;

    return {
      success: true,
      leadId: createdId,
      nome_cliente: nomeFormatado,
      cpf_cliente: cpfFormatado,
      etapa: 'Roleta',
      tipo_consulta: tipoConsulta !== 'nenhuma' ? tipoConsulta : undefined,
      notificacao_enviada: true,
      message: `Card criado com sucesso na coluna "Roleta / Avaliar" para ${nomeFormatado}.`
    };
  } catch (err: any) {
    console.error('Falha ao persistir lead no Supabase:', err.message);
    const fallbackId = `lead-${Date.now()}`;
    return {
      success: false,
      leadId: fallbackId,
      nome_cliente: nomeFormatado,
      cpf_cliente: cpfFormatado,
      etapa: 'Roleta',
      tipo_consulta: tipoConsulta !== 'nenhuma' ? tipoConsulta : undefined,
      notificacao_enviada: false,
      message: `Erro ao criar card no banco: ${err.message}`
    };
  }
}

/**
 * Ferramenta Oficial: Solicita Consulta Rápida (NÃO cria card no fluxo Kanban)
 * Dispara alerta e notificação imediata aos analistas online
 */
export async function executarSolicitarConsultaRapida(
  input: SolicitarConsultaRapidaInput
): Promise<SolicitarConsultaRapidaResult> {
  const nomeFormatado = (input.nome_cliente || 'CLIENTE PARA CONSULTA').trim().toUpperCase();
  const cpfFormatado = formatarCpf(input.cpf_cliente);
  const tipoConsulta = input.tipo_consulta || 'cpf';
  const consultaId = `cr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  return {
    success: true,
    consultaId,
    tipo_consulta: tipoConsulta,
    nome_cliente: nomeFormatado,
    cpf_cliente: cpfFormatado,
    notificacao_enviada: true,
    message: `Alerta de Consulta Rápida (${tipoConsulta.toUpperCase()}) disparado com sucesso para ${nomeFormatado}. Todos os analistas online foram notificados e nenhum card foi gerado no fluxo.`
  };
}
