# POP-01: Isolamento de Pastas por Analista no Kanban & Transferência Auditável

## 1. Objetivo
Garantir que cada analista de crédito visualize em seu fluxo Kanban exclusivamente as pastas (leads) sob sua responsabilidade, evitando sobrecarga visual e interferência operacional, ao mesmo tempo permitindo a busca global por CPF/Nome para transferência ou resolução de pendências e reavaliações.

## 2. Invariantes de Negócio
1. **Responsabilidade Única:** Cada pasta pertence a um único analista por vez.
2. **Atribuição Primária:** Ao ser criada na Roleta, a pasta recebe o analista logado como responsável (`[ANALISTA RESPONSÁVEL]: Nome`), persistido em `informacoes_importantes` no Supabase.
3. **Visibilidade do Fluxo Kanban:** O Kanban renderiza apenas cards cujo analista responsável seja o analista autenticado no sistema (`currentAnalistaNome`).
4. **Busca Global sem Bloqueio de Localização:** A barra de busca e o atalho ⌘K pesquisam em todo o acervo do Supabase por CPF ou Nome.
5. **Transferência de Responsabilidade Auditável:** Quando outro analista localiza uma pasta de um colega e decide assumi-la (ex: "Pegar Pendência" ou "Pegar Reavaliação"), o sistema:
   - Substitui o analista responsável atual pelo novo analista.
   - Grava um log imutável no campo `informacoes_importantes` com data, hora, motivo e analista anterior.
   - Insere a notificação no chat interno do cliente.
   - Move a visibilidade do card para o Kanban do novo analista imediatamente.

## 3. Estrutura de Dados
```typescript
interface TransferenciaAnalistaLog {
  data_hora: string; // formato "DD/MM às HH:mm"
  novo_analista: string;
  analista_anterior: string;
  motivo: 'Pegar Pendência' | 'Pegar Reavaliação' | 'Assumir Atendimento Geral' | 'Cobrir Ausência do Analista';
  detalhes?: string;
}
```

Formatado no banco Supabase (`informacoes_importantes`):
```text
[ANALISTA RESPONSÁVEL]: Novo Analista
[TROCA DE ANALISTA - 23/09 às 10:15]: Novo Analista assumiu a pasta (Motivo: Pegar Pendência | Anterior: Analista Anterior) - Detalhes: Assumindo para liberação imediata
```

## 4. Casos de Borda e RLS
- Se o campo de responsável for nulo ou legado, o sistema assume fallback transparente sem lançar exceções.
- A unicidade de CPF é preservada em 100% dos cadastros.
