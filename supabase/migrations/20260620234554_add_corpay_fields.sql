-- Alter table leads to support CorPay features
ALTER TABLE public.leads 
ADD COLUMN tipo_avaliacao TEXT CHECK (tipo_avaliacao IN ('Reavaliação', 'Nova Avaliação')),
ADD COLUMN tipo_financiamento TEXT CHECK (tipo_financiamento IN ('SBPE', 'MCMV')),
ADD COLUMN adicionado_corpay BOOLEAN NOT NULL DEFAULT false;
