-- Adiciona colunas para consulta Serasa (CPF e MO) na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS mo_serasa TEXT,
ADD COLUMN IF NOT EXISTS status_serasa TEXT DEFAULT 'Pendente',
ADD COLUMN IF NOT EXISTS data_consulta_serasa TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS obs_serasa TEXT;

-- Cria índice para consulta rápida do status Serasa
CREATE INDEX IF NOT EXISTS idx_leads_status_serasa ON public.leads(status_serasa);
