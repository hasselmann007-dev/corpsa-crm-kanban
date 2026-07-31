# Technical Analysis: Lead Card Structure & SLA Tracking (Requirement R1)

**Target Repository**: `corpsa-crm-kanban`  
**Working Directory**: `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_sla_1`  
**Date**: 2026-07-31  

---

## Executive Summary
This analysis details the architecture, data models, rendering logic, and state management of **Lead Cards** in `corpsa-crm-kanban`, specifically targeting **Requirement R1 (Service Level Agreement - SLA Tracking)**.

The investigation confirms that:
1. `data_hora_entrada` is parsed from raw text or generated on creation, stored as an ISO 8601 string (`timestamptz`), and accessible via the `Lead` interface.
2. Lead card stages (`etapa`) are modeled as a union type `'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao'`.
3. SLA delay logic currently checks if elapsed time since `data_hora_entrada` exceeds 2 hours (120 minutes), suppressing SLA warnings when `etapa === 'Conclusao'`.
4. Visual indicators (red border highlighting and red `"SLA Atrasada"` badge) are rendered conditionally inside `src/App.tsx`.

Below are the detailed findings for each focus area, followed by exact code locations and recommendations for Requirement R1.

---

## 1. Structure, Storage, and Parsing of `data_hora_entrada`

### Data Model & Interface
- **File**: `src/App.tsx` (lines 27–45)
- **Interface**: `Lead`
```typescript
interface Lead {
  id: string;
  data_hora_entrada: string; // ISO 8601 date string, e.g. "2026-07-31T14:30:00.000Z"
  nome_cliente: string;
  cpf_cliente: string;
  valor_imovel: number;
  cidade: string;
  grupo_origem: string;
  informacoes_importantes?: string;
  descricao_pendencia?: string;
  resultado_analise?: string;
  motivo_resultado?: string;
  etapa: 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao';
  tipo_avaliacao?: 'Reavaliação' | 'Nova Avaliação';
  tipo_financiamento?: 'SBPE' | 'MCMV';
  categoria?: string;
  adicionado_corpay: boolean;
  prioridade?: 'Baixa' | 'Média' | 'Alta';
}
```

### Parsing Logic
- **File**: `src/utils/parser.ts` (lines 214–242)
- **Function**: `parseDataHoraEntrada(text: string): { isoString: string; raw: string }`
- **Behavior**:
  - Uses Regex `/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/` to locate date patterns (`DD/MM/YYYY` or `DD/MM`).
  - Uses Regex `/\b(\d{1,2})[:h](\d{2})\b/` to locate time patterns (`HH:MM` or `HHhMM`).
  - Defaults missing year to `2026`.
  - Instantiates JavaScript `Date(year, month - 1, day, hours, minutes)`.
  - Returns `isoString` (`dateObj.toISOString()`).
  - Fallback: If no date match is found, returns `new Date().toISOString()`.

### Database Storage & Creation
- **File**: `src/App.tsx` (lines 611–625)
- **Table**: `leads` in Supabase database.
- **Insertion**:
  ```typescript
  data_hora_entrada: parsedLeadForm.data_hora_entrada || new Date().toISOString()
  ```

### Current Card Rendering
- **File**: `src/App.tsx` (lines 1531–1533)
- Rendered in card footer using Brazilian date format:
  ```tsx
  <span className="card-date">
    {new Date(lead.data_hora_entrada).toLocaleDateString('pt-BR')}
  </span>
  ```

---

## 2. Definition and Management of Card Stages (`etapa`)

### Stage Union & Column Constants
- **File**: `src/App.tsx` (lines 47–52)
```typescript
const COLUMNS = [
  { id: 'Roleta', title: 'Roleta / Avaliar', color: 'var(--color-roleta)' },
  { id: 'Pendencia', title: 'Demanda Operacional / Pendência', color: 'var(--color-pendencia)' },
  { id: 'Analise', title: 'Análise de Crédito', color: 'var(--color-analise)' },
  { id: 'Conclusao', title: 'Conclusão', color: 'var(--color-conclusao)' }
] as const;
```

### Stage Management & Drag-and-Drop
- **File**: `src/App.tsx` (lines 659–716)
- Stage transitions occur via HTML5 Drag & Drop (`handleDrop`) or direct updates (`updateLeadStage`).
- Updating stage modifies `etapa` column in Supabase `leads` table:
  ```typescript
  await supabase.from('leads').update({ etapa, ...fields }).eq('id', leadId);
  ```
- The string identifying completed leads is strictly `'Conclusao'`.

---

## 3. Card Border Highlighting & Badges Rendering

### SLA Calculation Helper
- **File**: `src/App.tsx` (lines 398–406)
```typescript
const isSlaDelayed = (dataHoraEntrada: string, etapa: string): boolean => {
  if (etapa === 'Conclusao') return false;
  if (!dataHoraEntrada) return false;
  const entryTime = new Date(dataHoraEntrada).getTime();
  if (isNaN(entryTime)) return false;
  const now = Date.now();
  const diffInHours = (now - entryTime) / (1000 * 60 * 60);
  return diffInHours >= 2;
};
```

### Card Border Highlighting
- **File**: `src/App.tsx` (line 1448)
```tsx
<div 
  key={lead.id} 
  className="lead-card"
  style={isSlaDelayed(lead.data_hora_entrada, lead.etapa) ? { border: '1.5px solid #ef4444', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' } : {}}
  draggable={true}
  onDragStart={(e) => handleDragStart(e, lead)}
  onClick={() => handleCardClick(lead)}
>
```

### Card Badge Rendering
- **File**: `src/App.tsx` (lines 1465–1484)
```tsx
{isSlaDelayed(lead.data_hora_entrada, lead.etapa) && (
  <span 
    className="priority-badge priority-alta"
    style={{ 
      backgroundColor: '#ef4444', 
      color: 'white', 
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '0.65rem'
    }}
    title="Este lead está no sistema há mais de 2 horas (SLA Atrasada)"
  >
    <FiAlertCircle size={10} />
    SLA Atrasada
  </span>
)}
```

---

## 4. Recommendations & Implementation Design for Requirement R1

### Requirement Checklist R1
- [x] Calculate elapsed time since `data_hora_entrada`.
- [x] Exceeding 2 hours (120 minutes) triggers SLA delay state if `etapa !== 'Conclusao'`.
- [x] Display static red/amber `"SLA Atrasada"` badge on delayed cards.
- [x] Highlight delayed card border in red/amber.
- [x] Moving card to stage `'Conclusao'` freezes/stops SLA tracking and removes delayed warning.

### Proposed Code Refinements & Locations

#### Location A: Helper Function `isSlaDelayed`
**File**: `src/App.tsx` (Line 398)  
**Proposed Code**:
```typescript
/**
 * Calculates whether a lead card has exceeded the 2-hour (120 minutes) SLA threshold.
 * SLA tracking is strictly suspended/frozen if the lead is in stage 'Conclusao'.
 */
const isSlaDelayed = (dataHoraEntrada: string, etapa: string): boolean => {
  // 1. Freeze SLA tracking if stage is 'Conclusao'
  if (etapa === 'Conclusao') return false;
  if (!dataHoraEntrada) return false;

  const entryTime = new Date(dataHoraEntrada).getTime();
  if (isNaN(entryTime)) return false;

  // 2. Calculate elapsed time in minutes
  const now = Date.now();
  const elapsedMinutes = (now - entryTime) / (1000 * 60);

  // 3. Trigger SLA delay if elapsed time >= 120 minutes (2 hours)
  return elapsedMinutes >= 120;
};
```

#### Location B: Dynamic Ticker (Auto-Refresh without Page Reload)
**File**: `src/App.tsx` (Line 58, inside `App` component)  
**Proposed Addition**:
To ensure that cards dynamically transition to SLA Delayed status in real time while open in the browser:
```typescript
// Ticker state to force SLA status recalculation every 60 seconds
const [nowTick, setNowTick] = useState(Date.now());

useEffect(() => {
  const timer = setInterval(() => {
    setNowTick(Date.now());
  }, 60000); // 60 seconds
  return () => clearInterval(timer);
}, []);
```

#### Location C: Card Rendering & Styling Enhancement
**File**: `src/App.tsx` (Lines 1445–1485)  
**Proposed Code**:
```tsx
<div 
  key={lead.id} 
  className={`lead-card ${isSlaDelayed(lead.data_hora_entrada, lead.etapa) ? 'sla-delayed' : ''}`}
  style={
    isSlaDelayed(lead.data_hora_entrada, lead.etapa)
      ? { border: '1.5px solid #ef4444', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)' }
      : {}
  }
  draggable={true}
  onDragStart={(e) => handleDragStart(e, lead)}
  onClick={() => handleCardClick(lead)}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span className="card-bank">{lead.grupo_origem}</span>
      {lead.prioridade && (
        <span 
          className={`priority-badge priority-${lead.prioridade.toLowerCase()}`}
          title={`Prioridade ${lead.prioridade}`}
        >
          <FiFlag size={10} />
          {lead.prioridade}
        </span>
      )}
      {isSlaDelayed(lead.data_hora_entrada, lead.etapa) && (
        <span 
          className="priority-badge priority-alta"
          style={{ 
            backgroundColor: '#ef4444', 
            color: '#ffffff', 
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.65rem'
          }}
          title="Lead no sistema há mais de 2 horas (SLA Atrasada)"
        >
          <FiAlertCircle size={10} />
          SLA Atrasada
        </span>
      )}
    </div>
    {lead.etapa === 'Conclusao' && (
      <FiCheckCircle style={{ color: 'var(--color-conclusao)' }} title="Processo concluído" />
    )}
  </div>
```

---

## Conclusion
The repository already possesses the underlying structures for `data_hora_entrada` and stage tracking. Requirement R1 can be fully satisfied by utilizing the `isSlaDelayed` helper function, ensuring the 120-minute threshold check and stage exclusion for `'Conclusao'` are maintained, and optionally adding a 60-second interval ticker for real-time SLA updates.
