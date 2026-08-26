-- ==============================================================================
-- CORPSA CRM: ATIVAÇÃO DE RLS (ROW LEVEL SECURITY) E POLÍTICAS DE SEGURANÇA
-- ==============================================================================

-- 1. Habilitar RLS em todas as tabelas públicas do CRM
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apuracoes_renda ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. POLÍTICAS DE SEGURANÇA: TABELA PROFILES (PERFIS)
-- ==============================================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Perfis: permitir leitura pública/autenticada" ON public.profiles;
DROP POLICY IF EXISTS "Perfis: permitir inserção de perfil" ON public.profiles;
DROP POLICY IF EXISTS "Perfis: permitir atualização apenas do próprio perfil" ON public.profiles;

-- Leitura de perfis de assessores
CREATE POLICY "Perfis: permitir leitura pública/autenticada"
ON public.profiles
FOR SELECT
USING (true);

-- Inserção de perfil no cadastro
CREATE POLICY "Perfis: permitir inserção de perfil"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Atualização: cada assessor só pode atualizar seu próprio perfil
CREATE POLICY "Perfis: permitir atualização apenas do próprio perfil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- ==============================================================================
-- 3. POLÍTICAS DE SEGURANÇA: TABELA LEADS (KANBAN DO CRM)
-- ==============================================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Leads: permitir leitura" ON public.leads;
DROP POLICY IF EXISTS "Leads: permitir inserção" ON public.leads;
DROP POLICY IF EXISTS "Leads: permitir atualização" ON public.leads;
DROP POLICY IF EXISTS "Leads: permitir exclusão" ON public.leads;

-- Leitura de cards de leads
CREATE POLICY "Leads: permitir leitura"
ON public.leads
FOR SELECT
USING (true);

-- Cadastro de novos leads (via formulário ou criação rápida)
CREATE POLICY "Leads: permitir inserção"
ON public.leads
FOR INSERT
WITH CHECK (true);

-- Movimentação entre colunas (Roleta, Pendência, Análise, Conclusão) e edição
CREATE POLICY "Leads: permitir atualização"
ON public.leads
FOR UPDATE
USING (true);

-- Exclusão de cards pelo botão de lixeira
CREATE POLICY "Leads: permitir exclusão"
ON public.leads
FOR DELETE
USING (true);

-- ==============================================================================
-- 4. POLÍTICAS DE SEGURANÇA: TABELA APURACOES_RENDA (APURAÇÃO DE RENDA)
-- ==============================================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Apurações: permitir leitura" ON public.apuracoes_renda;
DROP POLICY IF EXISTS "Apurações: permitir inserção" ON public.apuracoes_renda;
DROP POLICY IF EXISTS "Apurações: permitir atualização" ON public.apuracoes_renda;
DROP POLICY IF EXISTS "Apurações: permitir exclusão" ON public.apuracoes_renda;

-- Leitura de histórico de apurações
CREATE POLICY "Apurações: permitir leitura"
ON public.apuracoes_renda
FOR SELECT
USING (true);

-- Criação de novas apurações de renda
CREATE POLICY "Apurações: permitir inserção"
ON public.apuracoes_renda
FOR INSERT
WITH CHECK (true);

-- Atualização de parecer ou regras da apuração
CREATE POLICY "Apurações: permitir atualização"
ON public.apuracoes_renda
FOR UPDATE
USING (true);

-- Exclusão de registros de apuração
CREATE POLICY "Apurações: permitir exclusão"
ON public.apuracoes_renda
FOR DELETE
USING (true);
