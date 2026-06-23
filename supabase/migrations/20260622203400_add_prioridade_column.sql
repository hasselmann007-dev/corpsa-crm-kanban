-- Alter table leads to support 3-level priority
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Baixa' CHECK (prioridade IN ('Baixa', 'Média', 'Alta'));
