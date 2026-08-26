-- ==============================================================================
-- MEMÓRIA DO AGENTE DE IA (CORPSA CRM)
-- Tabelas para persistência de conversas e histórico de mensagens por cliente
-- ==============================================================================

-- 1. Tabela de conversas/sessões do cliente
CREATE TABLE IF NOT EXISTS public.agente_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL DEFAULT 'cliente_anonimo',
  titulo TEXT DEFAULT 'Atendimento Agente de IA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de mensagens da conversa
CREATE TABLE IF NOT EXISTS public.agente_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.agente_conversas(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'assistant')),
  text TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices para otimizar busca rápida das últimas 20 mensagens por conversa/cliente
CREATE INDEX IF NOT EXISTS idx_agente_conversas_cliente ON public.agente_conversas(cliente_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agente_mensagens_conversa_created ON public.agente_mensagens(conversa_id, created_at DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.agente_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_mensagens ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acesso para leitura e gravação
DROP POLICY IF EXISTS "Permitir leitura de conversas" ON public.agente_conversas;
CREATE POLICY "Permitir leitura de conversas" ON public.agente_conversas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de conversas" ON public.agente_conversas;
CREATE POLICY "Permitir inserção de conversas" ON public.agente_conversas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de conversas" ON public.agente_conversas;
CREATE POLICY "Permitir atualização de conversas" ON public.agente_conversas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de conversas" ON public.agente_conversas;
CREATE POLICY "Permitir exclusão de conversas" ON public.agente_conversas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir leitura de mensagens" ON public.agente_mensagens;
CREATE POLICY "Permitir leitura de mensagens" ON public.agente_mensagens FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de mensagens" ON public.agente_mensagens;
CREATE POLICY "Permitir inserção de mensagens" ON public.agente_mensagens FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de mensagens" ON public.agente_mensagens;
CREATE POLICY "Permitir exclusão de mensagens" ON public.agente_mensagens FOR DELETE USING (true);
