import { supabase } from '../supabaseClient';

export interface AgenteMensagemRecord {
  id: string;
  conversa_id: string;
  sender: 'user' | 'agent' | 'assistant';
  text: string;
  model_used?: string;
  created_at: string;
}

export interface AgenteConversaRecord {
  id: string;
  cliente_id: string;
  titulo?: string;
  created_at: string;
  updated_at: string;
}

const LOCAL_STORAGE_CLIENT_KEY = 'crm_agente_ia_cliente_id_v1';
const LOCAL_STORAGE_CONVERSA_KEY = 'crm_agente_ia_conversa_id_v1';
const LOCAL_STORAGE_MEMORY_BACKUP = 'crm_agente_ia_memory_backup_v1';

/**
 * Obtém ou gera um ID único para o cliente/sessão do CRM
 */
export function getOrCreateClienteId(): string {
  let clienteId = localStorage.getItem(LOCAL_STORAGE_CLIENT_KEY);
  if (!clienteId) {
    clienteId = `cliente_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(LOCAL_STORAGE_CLIENT_KEY, clienteId);
  }
  return clienteId;
}

/**
 * Obtém ou cria uma sessão de conversa na tabela 'agente_conversas' no Supabase
 */
export async function getOrCreateConversaSupabase(clienteId?: string): Promise<string> {
  const cid = clienteId || getOrCreateClienteId();
  const savedConversaId = localStorage.getItem(LOCAL_STORAGE_CONVERSA_KEY);

  // Se já temos um conversa_id salvo no navegador, verifica se existe no Supabase
  if (savedConversaId) {
    try {
      const { data, error } = await supabase
        .from('agente_conversas')
        .select('id')
        .eq('id', savedConversaId)
        .maybeSingle();

      if (data?.id && !error) {
        return data.id;
      }
    } catch (_e) {
      // Ignora erro
    }
  }

  // Tenta buscar a conversa mais recente desse cliente no Supabase
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('agente_conversas')
      .select('id')
      .eq('cliente_id', cid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id && !fetchErr) {
      localStorage.setItem(LOCAL_STORAGE_CONVERSA_KEY, existing.id);
      return existing.id;
    }

    // Se não existir, cria uma nova conversa na tabela 'agente_conversas'
    const { data: newConv, error: createErr } = await supabase
      .from('agente_conversas')
      .insert({
        cliente_id: cid,
        titulo: `Atendimento CRM (${new Date().toLocaleDateString('pt-BR')})`
      })
      .select('id')
      .single();

    if (newConv?.id && !createErr) {
      localStorage.setItem(LOCAL_STORAGE_CONVERSA_KEY, newConv.id);
      return newConv.id;
    }
  } catch (_e) {
    // Caso as tabelas ainda não existam no Supabase
  }

  // Fallback local caso a tabela no Supabase ainda esteja em criação
  const fallbackId = savedConversaId || `conv_${Date.now()}`;
  localStorage.setItem(LOCAL_STORAGE_CONVERSA_KEY, fallbackId);
  return fallbackId;
}

/**
 * LÊ AS ÚLTIMAS 20 MENSAGENS DAQUELE CLIENTE ANTES DE CADA RESPOSTA (Tabela 'agente_mensagens')
 */
export async function carregarUltimasMensagensSupabase(conversaId: string, limit: number = 20): Promise<{ sender: 'user' | 'agent' | 'assistant'; text: string; model_used?: string; timestamp: string }[]> {
  try {
    const { data, error } = await supabase
      .from('agente_mensagens')
      .select('id, sender, text, model_used, created_at')
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data && data.length > 0 && !error) {
      // Inverte a ordem para ficar cronológico (mais antiga -> mais recente das últimas 20)
      const chronologic = [...data].reverse();
      return chronologic.map(m => ({
        sender: m.sender as 'user' | 'agent' | 'assistant',
        text: m.text,
        model_used: m.model_used,
        timestamp: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }));
    }
  } catch (_e) {
    // Ignora erro
  }

  // Backup em LocalStorage se o Supabase não retornar dados
  try {
    const backupRaw = localStorage.getItem(`${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`);
    if (backupRaw) {
      const parsed = JSON.parse(backupRaw);
      if (Array.isArray(parsed)) {
        return parsed.slice(-limit);
      }
    }
  } catch (_e) {}

  return [];
}

/**
 * SALVA UMA NOVA MENSAGEM NA TABELA 'agente_mensagens' NO SUPABASE
 */
export async function salvarMensagemSupabase(
  conversaId: string, 
  sender: 'user' | 'agent' | 'assistant', 
  text: string, 
  modelUsed?: string
): Promise<void> {
  const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 1. Atualizar backup local para acesso instantâneo no navegador
  try {
    const backupRaw = localStorage.getItem(`${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`);
    const backupArr = backupRaw ? JSON.parse(backupRaw) : [];
    backupArr.push({ sender, text, model_used: modelUsed, timestamp });
    // Mantém no máximo 50 mensagens no backup local
    localStorage.setItem(`${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`, JSON.stringify(backupArr.slice(-50)));
  } catch (_e) {}

  // 2. Gravar mensagem na tabela 'agente_mensagens' no Supabase
  try {
    await supabase.from('agente_mensagens').insert({
      conversa_id: conversaId,
      sender,
      text,
      model_used: modelUsed
    });

    // Atualiza a data da conversa na tabela 'agente_conversas'
    await supabase.from('agente_conversas').update({
      updated_at: new Date().toISOString()
    }).eq('id', conversaId);
  } catch (_e) {
    // Ignora erro
  }
}
