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

const memoryStore: Record<string, string> = {};

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (_e) {}
  return memoryStore[key] || null;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (_e) {}
  memoryStore[key] = value;
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (_e) {}
  delete memoryStore[key];
}

/**
 * Obtém ou gera um ID único para o cliente/sessão do CRM (único por usuário se fornecido)
 */
export function getOrCreateClienteId(userId?: string): string {
  const key = userId ? `crm_agente_ia_cliente_${userId}` : LOCAL_STORAGE_CLIENT_KEY;
  let clienteId = safeGetStorage(key);
  if (!clienteId) {
    clienteId = userId ? `user_${userId}` : `cliente_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    safeSetStorage(key, clienteId);
  }
  return clienteId;
}

/**
 * Obtém ou cria uma sessão de conversa na tabela 'agente_conversas' no Supabase
 * Única por usuário conectado
 */
export async function getOrCreateConversaSupabase(userId?: string): Promise<string> {
  const cid = getOrCreateClienteId(userId);
  const conversaKey = userId ? `crm_agente_ia_conversa_${userId}` : LOCAL_STORAGE_CONVERSA_KEY;
  const savedConversaId = safeGetStorage(conversaKey);

  // Se já temos um conversa_id salvo no navegador para este usuário, verifica no Supabase
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

  // Tenta buscar a conversa mais recente desse usuário no Supabase
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('agente_conversas')
      .select('id')
      .eq('cliente_id', cid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id && !fetchErr) {
      safeSetStorage(conversaKey, existing.id);
      return existing.id;
    }

    // Se não existir, cria uma nova conversa na tabela 'agente_conversas'
    const newId = crypto.randomUUID ? crypto.randomUUID() : `conv-${Date.now()}`;
    const { data: created, error: insertErr } = await supabase
      .from('agente_conversas')
      .insert([
        {
          id: newId,
          cliente_id: cid,
          titulo: `Atendimento ${new Date().toLocaleDateString('pt-BR')}`
        }
      ])
      .select('id')
      .single();

    if (created?.id && !insertErr) {
      safeSetStorage(conversaKey, created.id);
      return created.id;
    }
  } catch (err) {
    console.warn('Erro ao conectar tabela agente_conversas:', err);
  }

  // Fallback seguro em memória/local
  const fallbackId = savedConversaId || `fallback-conv-${Date.now()}`;
  safeSetStorage(conversaKey, fallbackId);
  return fallbackId;
}

/**
 * Carrega as últimas mensagens persistidas da conversa ativa do usuário
 */
export async function carregarMensagensConversa(conversaId: string, limit = 20): Promise<AgenteMensagemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('agente_mensagens')
      .select('*')
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    if (data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Falha ao ler agente_mensagens do Supabase, usando backup local:', err);
  }

  // Fallback LocalStorage
  try {
    const raw = safeGetStorage(`${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_e) {}

  return [];
}

/**
 * Salva uma nova mensagem no histórico do usuário
 */
export async function salvarMensagemConversa(
  conversaId: string,
  sender: 'user' | 'agent' | 'assistant',
  text: string,
  modelUsed?: string
): Promise<void> {
  const msgRecord: AgenteMensagemRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}`,
    conversa_id: conversaId,
    sender,
    text,
    model_used: modelUsed,
    created_at: new Date().toISOString()
  };

  // Salva no Supabase
  try {
    await supabase.from('agente_mensagens').insert([msgRecord]);
    await supabase
      .from('agente_conversas')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversaId);
  } catch (err) {
    console.warn('Falha ao persistir no Supabase agente_mensagens:', err);
  }

  // Backup em LocalStorage
  try {
    const backupKey = `${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`;
    const current = await carregarMensagensConversa(conversaId, 40);
    const updated = [...current.filter(m => m.id !== msgRecord.id), msgRecord].slice(-40);
    safeSetStorage(backupKey, JSON.stringify(updated));
  } catch (_e) {}
}

/**
 * Limpa o histórico da sessão ativa do usuário
 */
export async function limparMemoriaConversa(conversaId: string, userId?: string): Promise<void> {
  try {
    await supabase.from('agente_mensagens').delete().eq('conversa_id', conversaId);
    await supabase.from('agente_conversas').delete().eq('id', conversaId);
  } catch (_e) {}

  const conversaKey = userId ? `crm_agente_ia_conversa_${userId}` : LOCAL_STORAGE_CONVERSA_KEY;
  safeRemoveStorage(conversaKey);
  safeRemoveStorage(`${LOCAL_STORAGE_MEMORY_BACKUP}_${conversaId}`);
}

// Aliases de compatibilidade
export const carregarUltimasMensagensSupabase = carregarMensagensConversa;
export const salvarMensagemSupabase = salvarMensagemConversa;

