import { supabase } from '../supabaseClient';
import { playAlertChime } from './notificationSound';
import type { ConsultaRapida, AnalistaPresenca } from '../types/consultaRapida';

const LOCAL_CONSULTAS_KEY = 'corpsa_consultas_rapidas_v1';
const LOCAL_ANALISTAS_KEY = 'corpsa_analistas_presenca_v1';

let memoryConsultas: ConsultaRapida[] = [];
let memoryAnalistas: AnalistaPresenca[] = [
  { id: 'an-1', nome: 'Danilo Hasselmann', cargo: 'Analista de Crédito', isOnline: true, ultima_atividade: 'Agora' },
  { id: 'an-2', nome: 'Luciana Martins', cargo: 'Analista Sênior', isOnline: true, ultima_atividade: 'Há 5 min' },
  { id: 'an-3', nome: 'Rodrigo Medeiros', cargo: 'Assessor Imobiliário', isOnline: false, ultima_atividade: 'Há 2 horas' },
  { id: 'an-4', nome: 'Beatriz Vasconcelos', cargo: 'Analista de Triagem', isOnline: true, ultima_atividade: 'Agora' }
];

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (_e) {}
  return null;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (_e) {}
}

function safeDispatch(name: string, detail: any): void {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch (_e) {}
}

/**
 * Retorna as consultas rápidas gravadas (LocalStorage + Supabase)
 */
export function getConsultasRapidas(): ConsultaRapida[] {
  try {
    const raw = safeGetStorage(LOCAL_CONSULTAS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_e) {}
  return memoryConsultas;
}

/**
 * Salva uma nova Consulta Rápida (sem criar card no Kanban) e notifica os analistas online
 */
export async function salvarNovaConsultaRapida(
  dados: Omit<ConsultaRapida, 'id' | 'created_at' | 'status'>
): Promise<ConsultaRapida> {
  const novaConsulta: ConsultaRapida = {
    ...dados,
    id: `cr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString(),
    status: 'Pendente',
    resultado_checkboxes: {
      pesquisa_limpa: false,
      possui_restricao: false,
      pendencia_documental: false,
      irpf_pendente: false,
      imovel_localizado: false
    }
  };

  const listaAtual = getConsultasRapidas();
  const novaLista = [novaConsulta, ...listaAtual];
  memoryConsultas = novaLista;
  safeSetStorage(LOCAL_CONSULTAS_KEY, JSON.stringify(novaLista));

  // Toca alerta sonoro imediatamente
  playAlertChime();

  // Grava notificação no Supabase
  try {
    await supabase.from('notificacoes').insert([
      {
        titulo: `⚡ Consulta Rápida: ${novaConsulta.tipo_consulta.toUpperCase()} - ${novaConsulta.nome_cliente}`,
        descricao: `CPF: ${novaConsulta.cpf_cliente || 'N/A'} | Solicitado via ${novaConsulta.canal_origem || 'Sistema'}`,
        tipo: 'urgente',
        lida: false
      }
    ]);
  } catch (_e) {}

  // Dispara evento no navegador para atualização reativa
  safeDispatch('corpsa_nova_consulta_rapida', novaConsulta);

  return novaConsulta;
}

/**
 * Analista responde à Consulta Rápida com os checkboxes preenchidos e texto de devolutiva
 */
export async function responderConsultaRapida(
  id: string,
  resultadoCheckboxes: ConsultaRapida['resultado_checkboxes'],
  devolutivaTexto: string,
  analistaNome: string
): Promise<ConsultaRapida | null> {
  const listaAtual = getConsultasRapidas();
  let updatedItem: ConsultaRapida | null = null;

  const novaLista = listaAtual.map(item => {
    if (item.id === id) {
      updatedItem = {
        ...item,
        status: 'Respondido',
        resultado_checkboxes: resultadoCheckboxes,
        devolutiva_texto: devolutivaTexto,
        data_devolutiva: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        analista_responsavel: analistaNome
      };
      return updatedItem;
    }
    return item;
  });

  memoryConsultas = novaLista;
  safeSetStorage(LOCAL_CONSULTAS_KEY, JSON.stringify(novaLista));
  safeDispatch('corpsa_consulta_rapida_atualizada', updatedItem);

  return updatedItem;
}

/**
 * Retorna a lista de presença dos analistas
 */
export function getAnalistasPresenca(): AnalistaPresenca[] {
  try {
    const raw = safeGetStorage(LOCAL_ANALISTAS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_e) {}
  return memoryAnalistas;
}

/**
 * Atualiza o status de um analista (Online/Offline)
 */
export function setAnalistaStatus(analistaId: string, isOnline: boolean, nome?: string): AnalistaPresenca[] {
  const lista = getAnalistasPresenca();
  let encontrado = false;

  const novaLista = lista.map(a => {
    if (a.id === analistaId || (nome && a.nome.toLowerCase() === nome.toLowerCase())) {
      encontrado = true;
      return {
        ...a,
        isOnline,
        ultima_atividade: isOnline ? 'Agora' : 'Offline'
      };
    }
    return a;
  });

  if (!encontrado && nome) {
    novaLista.push({
      id: analistaId,
      nome,
      cargo: 'Analista de Crédito',
      isOnline,
      ultima_atividade: isOnline ? 'Agora' : 'Offline'
    });
  }

  memoryAnalistas = novaLista;
  safeSetStorage(LOCAL_ANALISTAS_KEY, JSON.stringify(novaLista));
  safeDispatch('corpsa_analistas_status_changed', novaLista);
  return novaLista;
}
