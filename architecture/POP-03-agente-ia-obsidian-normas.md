# POP-03: Agente Consultor IA Conectado ao Obsidian (@Normas) & CRM

## 1. Objetivo
Estabelecer a integração factual do Agente de IA do CRM, impedindo alucinações e garantindo que todas as orientações técnicas sejam obtidas do cofre Obsidian (`c:\Users\User\Desktop\Ai agent\Normas\wiki/`), e que dados de clientes sejam buscados diretamente no banco de dados do CRM.

## 2. Invariantes Comportamentais
1. **Papel de Consultor Factual:** O agente NUNCA inventa normas, limites de renda, prazos, espécies de INSS ou dados de clientes. Ele atua como um consultor técnico rigoroso que declara apenas o que está formalmente documentado.
2. **Contexto de Conversa Contínuo:** O agente preserva o histórico de mensagens trocadas na sessão para manter o raciocínio encadeado.
3. **Consulta Obrigatória ao Obsidian para Dúvidas:** Quando perguntado sobre regras Caixa, procedimentos da CORPSA, documentos aceitos, cálculos de margem, tetos ou tabelas, o agente DEVE invocar a ferramenta `consultar_obsidian_normas(termo_ou_topico)`.
4. **Consulta Obrigatória ao CRM para Dados de Clientes:** Quando o analista solicitar informações de um cliente (por CPF ou Nome), o agente invoca `consultar_dados_cliente_crm(identificador)` e extrai exatamente os 4 blocos cadastrais:
   - Observações Operacionais & Dados da Triagem (`informacoes_importantes`)
   - Descrição e Detalhamento da Pendência (`descricao_pendencia`)
   - Parecer Oficial do Analista de Crédito (`resultado_analise` / `motivo_resultado`)
   - Considerações Finais & Instruções para Contrato (`tipo_avaliacao`, `tipo_financiamento`, etc.)

## 3. Catálogo de Conteúdo do Obsidian (`Normas/wiki/`)
- `normas/`:
  - `regra-beneficios-inss.md`: Espécies aceitas e vedadas (BPC/LOAS vedado).
  - `regra-dependentes-mcmv.md`: Requisitos e declarações para dependentes.
  - `regra-irpf-caixa.md`: Regras de DIRPF original e retificadora.
  - `regra-municipios-limitrofes-fgts.md`: RMs de Ribeirão Preto, Campinas e SP.
  - `regra-pesquisa-cpf-lgpd.md`: Obrigatoriedade da autorização formal MO 43.112.
  - `regra-rating-comprometimento.md`: Margens máximas (A: 30%, B: 27%, C/D: 25%).
- `tabelas/`:
  - `tabela-especies-inss.md`: Relação oficial das espécies do INSS.
  - `tabela-faixas-renda-taxas-mcmv-sbpe.md`: Faixas de renda, tetos e taxas.
  - `tabela-custos-despesas-imovel.md`: Custas da operação individual.
  - `tabela-modalidades-credito.md`: As 8 modalidades e piso de R$ 150k.
- `procedimentos/`:
  - `fluxo-operacional-repasse.md`: O fluxo das 18 fases.
  - `procedimento-comprovacao-renda-informal.md`: Roteiro de 7 blocos.
  - `procedimento-renda-motoristas-entregadores.md`: Extratos Uber, 99 e iFood.
  - `procedimento-projeto-resgate.md`: Recuperação de reprovados em 45 dias.
  - `procedimento-autorizacao-fgts.md`: Autorização no app do FGTS.
- `modelos/`:
  - `checklist-documentos-financiamento.md`: Checklist completo de documentos.
  - `checklist-interno-aprovacao-corpsa.md`: Ficha interna de aprovação.
  - `modelo-autorizacao-pesquisa-cpf.md`, `modelo-declaracao-parentesco.md`, etc.
