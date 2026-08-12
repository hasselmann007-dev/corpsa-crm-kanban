-- Migration: Create apuracoes_renda table for client income audit sessions
-- Timestamp: 20260812000000

CREATE TABLE IF NOT EXISTS public.apuracoes_renda (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome_cliente TEXT NOT NULL CHECK (char_length(trim(nome_cliente)) > 0),
    cpf_cliente TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em Análise' CHECK (status IN ('Em Análise', 'Concluída', 'Pendente de Doc')),
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    regras_considerar TEXT DEFAULT '',
    regras_desconsiderar TEXT DEFAULT '',
    renda_formal NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    renda_informal NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    renda_bruta NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    renda_liquida NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    descontos_desconsiderados NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    capacidade_pagamento NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    arquivos JSONB DEFAULT '[]'::jsonb NOT NULL,
    mensagens JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.apuracoes_renda ENABLE ROW LEVEL SECURITY;

-- Allow public access for development simplicity
CREATE POLICY "Allow all public access for apuracoes_renda" ON public.apuracoes_renda
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Grant privileges to default Supabase roles
GRANT ALL PRIVILEGES ON TABLE public.apuracoes_renda TO postgres, anon, authenticated, service_role;
