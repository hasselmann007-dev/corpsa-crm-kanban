# ⚙️ REGRAS DE ANÁLISE E CRIAÇÃO DE CARDS NO KANBAN (CORPSA / CAIXA)
<!--
  ====================================================================================
  CONSTITUIÇÃO OFICIAL DE CRIAÇÃO DE CARDS E DOCUMENTOS OBRIGATÓRIOS PARA FINANCIAMENTO
  ====================================================================================
-->

## 1. JSON Oficial de Documentos para Financiamento (Aprovação de Crédito Caixa)
```json
{
  "documentos_para_financiamento": {
    "comprador_e_participantes": {
      "descricao": "Documentos pessoais do comprador (acrescentar cônjuge ou participante se houver):",
      "itens": [
        "CPF + RG ou CNH (legível, frente e verso, sem cortes)",
        "Certidão do Estado Civil (Certidão de Nascimento para solteiros ou Casamento com averbação se divorciado)",
        "Comprovante de Endereço (em nome do requerente; conta de consumo recente máx. 30 dias)",
        "Carteira de Trabalho (CTPS física ou digital - apenas se for usar o FGTS)"
      ]
    },
    "comprovantes_de_renda": {
      "funcionario_assalariado": {
        "perfil": "Renda Comprovada / Funcionário (Assalariados CLT)",
        "itens": [
          "02 Últimos holerites",
          "Imposto de Renda 2026 Completo com recibo de entrega (caso tenha declarado)"
        ]
      },
      "empresario_autonomo": {
        "perfil": "Empresário / Profissional Autônomo",
        "itens": [
          "Extrato Bancário dos últimos 6 meses completos em Ribeirão Preto, em outras cidades 3 meses (conta corrente)",
          "Imposto de Renda Completo com recibo de entrega (caso tenha declarado)",
          "Pró-labore / Aluguéis / Rendimentos etc."
        ]
      }
    }
  }
}
```

---

## 2. Regra Fundamental: Questionar Perfil e Enviar Lista de Documentos
- **Quando o corretor solicitar uma Avaliação de Crédito ou Novo Lead:**
  - O Agente IA **NÃO DEVE** criar o card imediatamente no fluxo se os documentos não tiverem sido enviados.
  - O Agente IA deve primeiro identificar o perfil do proponente:
    1. Perguntar se o cliente é **Assalariado (Funcionário CLT)** ou **Empresário / Autônomo**, e se haverá cônjuge/participante na renda.
    2. Enviar a lista exata dos documentos necessários juntos (conforme o JSON oficial acima).
  - **SEM ISSO NÃO ENVIA O CARD:** O card na coluna "Roleta / Avaliar" só deve ser criado quando o corretor anexar os documentos no chat ou confirmar o envio dos mesmos.
  - Os documentos anexados pelo corretor no chat são automaticamente vinculados à pasta real do cliente no fluxo Kanban (nunca inventando arquivos fictícios).

---

## 3. Regras de Solicitação de Consultas Rápidas (Alerta Instantâneo)
- Para consultas pontuais (apenas verificar CPF, verificar IRPF ou pesquisar se possui imóvel):
  - **NÃO cria card** no Kanban.
  - Aciona a ferramenta `solicitar_consulta_rapida` para disparar alerta sonoro e notificação direta aos analistas online de plantão.

---

## 4. Unicidade de CPF & Prevenção de Cards Duplicados
- **Regra Estrita:** Cada cliente é único. Não pode haver 2 cards com o mesmo CPF no fluxo Kanban.
- Se o corretor solicitar a criação ou avaliação de um cliente cujo CPF já existe na base:
  - **NÃO crie um novo card**.
  - Responda obrigatoriamente: *"Já possui um cliente com esse CPF em nossa base ([Nome do Cliente] na etapa [Etapa]). Você quer reavaliar ou adicionar um novo proponente?"*

---

## 5. Espaço Reservado para Regras Adicionais do Usuário
<!-- ESPAÇO RESERVADO: Adicione aqui novas regras de validação ou operacionais -->
- Regras adicionais configuradas dinamicamente pela equipe CORPSA.