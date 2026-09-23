# POP-02: Gestão Financeira CORPSA Pay & Múltiplos Lançamentos por Cliente

## 1. Objetivo
Definir as regras determinísticas de remuneração operacional (CORPSA Pay), garantindo privacidade absoluta entre analistas, suporte a múltiplos lançamentos (avaliação inicial + reavaliações) para o mesmo cliente, e interface de CRUD na Fase 4 (Conclusão).

## 2. Invariantes de Negócio
1. **Privacidade Absoluta:** O saldo total, métricas e histórico de lançamentos do CORPSA Pay pertencem única e exclusivamente a quem rodou o SICAQ / realizou a avaliação. Um analista NUNCA pode visualizar a remuneração ou os lançamentos de outro analista.
2. **Múltiplos Lançamentos:** Um mesmo cliente pode ter múltiplos eventos de remuneração no CORPSA Pay (ex: 1 Avaliação inicial + N Reavaliações).
3. **Valores Oficiais de Remuneração CORPSA:**
   - **Reavaliação:** R$ 7,00 (independente de programa/modalidade).
   - **Nova Avaliação MCMV:** R$ 12,00.
   - **Nova Avaliação SBPE:** R$ 13,00.
4. **Gerenciamento na Fase 4 (Conclusão):**
   - Na Fase 4 de cada card, o analista tem controle total sobre os lançamentos vinculados àquele lead:
     - Adicionar novo lançamento CorPay.
     - Editar lançamento existente.
     - Excluir lançamento.
5. **Atributos de Cada Lançamento:**
   - `id`: Identificador único (UUID ou nanoid).
   - `lead_id`: ID do lead no Supabase.
   - `analista_nome`: Nome do analista responsável pelo lançamento.
   - `data_hora`: Timestamp ISO do lançamento.
   - `tipo_imovel`: 'Planta' | 'Usado' | 'Novo' | 'Terreno & Construção' | 'Comercial'.
   - `programa`: 'MCMV' | 'SBPE'.
   - `tipo_servico`: 'Avaliação' | 'Reavaliação'.
   - `valor_remuneracao`: Valor monetário numérico (7.00, 12.00 ou 13.00, ou customizável).
   - `resultado`: 'Aprovado' | 'Condicionado' | 'Reprovado' | 'Outro'.
   - `observacoes`: Texto livre para notas complementares.

## 3. Persistência
Os lançamentos são serializados em formato JSON estruturado na tag `[CORPAY_LANCAMENTOS: ...]` dentro do campo `informacoes_importantes` do lead no Supabase e mantidos em cache reativo no cliente (`corpayStore`).

Exemplo:
```text
[CORPAY_LANCAMENTOS: [{"id":"cp-01","analista_nome":"Danilo Hasselmann","tipo_servico":"Avaliação","programa":"MCMV","tipo_imovel":"Planta","valor":12,"data":"2026-09-23T10:00:00Z"},{"id":"cp-02","analista_nome":"Danilo Hasselmann","tipo_servico":"Reavaliação","programa":"MCMV","tipo_imovel":"Planta","valor":7,"data":"2026-09-23T14:30:00Z"}]]
```

## 4. Agregações e Métricas
- `corPayTotal`: Soma de `valor_remuneracao` de todos os lançamentos onde `analista_nome === currentAnalistaNome`.
- `corPayCount`: Contagem de lançamentos onde `analista_nome === currentAnalistaNome`.
