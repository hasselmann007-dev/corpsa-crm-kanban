-- Create leads table with constraints
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_hora_entrada TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome_cliente TEXT NOT NULL CHECK (char_length(trim(nome_cliente)) > 0),
    cpf_cliente TEXT NOT NULL CHECK (cpf_cliente ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$'),
    valor_imovel NUMERIC(15, 2) NOT NULL CHECK (valor_imovel >= 0),
    cidade TEXT NOT NULL CHECK (char_length(trim(cidade)) > 0),
    grupo_origem TEXT NOT NULL CHECK (char_length(trim(grupo_origem)) > 0),
    informacoes_importantes TEXT,
    descricao_pendencia TEXT,
    resultado_analise TEXT CHECK (resultado_analise IN ('Aprovado', 'Condicionado', 'Reprovado', 'Segue Pendente de Documento')),
    motivo_resultado TEXT,
    etapa TEXT NOT NULL DEFAULT 'Roleta' CHECK (etapa IN ('Roleta', 'Pendencia', 'Analise', 'Conclusao')),

    -- CHECK: If etapa is Pendencia, descricao_pendencia is required
    CONSTRAINT chk_descricao_pendencia CHECK (
        etapa != 'Pendencia' OR (descricao_pendencia IS NOT NULL AND char_length(trim(descricao_pendencia)) > 0)
    ),

    -- CHECK: If etapa is Analise, resultado_analise is required
    CONSTRAINT chk_resultado_analise CHECK (
        etapa != 'Analise' OR (resultado_analise IS NOT NULL)
    ),

    -- CHECK: If resultado_analise is Condicionado or Reprovado, motivo_resultado is required
    CONSTRAINT chk_motivo_resultado CHECK (
        resultado_analise NOT IN ('Condicionado', 'Reprovado') OR (motivo_resultado IS NOT NULL AND char_length(trim(motivo_resultado)) > 0)
    )
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for local development simplicity (or configure custom policies)
CREATE POLICY "Allow all public access for dev" ON public.leads
    FOR ALL TO public USING (true) WITH CHECK (true);
