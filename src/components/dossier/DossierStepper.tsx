import React from 'react';
import { 
  FiClock, 
  FiAlertTriangle, 
  FiFileText, 
  FiCheckCircle, 
  FiCheck,
  FiChevronRight
} from 'react-icons/fi';
import type { Lead } from '../../App';

export type LeadEtapa = Lead['etapa'];

interface DossierStepperProps {
  currentStage: LeadEtapa;
  onStageChange: (newStage: LeadEtapa) => void;
  disabled?: boolean;
}

interface StepDef {
  id: LeadEtapa;
  order: number;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  accentColor: string;
}

const STEPS: StepDef[] = [
  {
    id: 'Roleta',
    order: 1,
    label: '1. Roleta / Avaliar',
    shortLabel: 'Roleta',
    icon: FiClock,
    accentColor: '#6366f1' // Indigo
  },
  {
    id: 'Pendencia',
    order: 2,
    label: '2. Pendência Operacional',
    shortLabel: 'Pendência',
    icon: FiAlertTriangle,
    accentColor: '#f97316' // Orange CORPSA
  },
  {
    id: 'Analise',
    order: 3,
    label: '3. Análise de Crédito',
    shortLabel: 'Análise',
    icon: FiFileText,
    accentColor: '#0ea5e9' // Sky Blue
  },
  {
    id: 'Conclusao',
    order: 4,
    label: '4. Conclusão & CorPay',
    shortLabel: 'Conclusão',
    icon: FiCheckCircle,
    accentColor: '#10b981' // Emerald
  }
];

export const DossierStepper: React.FC<DossierStepperProps> = ({
  currentStage,
  onStageChange,
  disabled = false
}) => {
  const currentStepObj = STEPS.find(s => s.id === currentStage) || STEPS[0];
  const currentOrder = currentStepObj.order;

  return (
    <nav 
      aria-label="Esteira de Crédito"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '6px 12px',
        backgroundColor: '#07101e',
        borderTop: '1px solid #1e293b',
        borderBottom: '1px solid #1e293b',
        overflowX: 'auto',
        userSelect: 'none'
      }}
    >
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStage;
        const isPast = step.order < currentOrder;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStageChange(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: isActive 
                  ? `1.5px solid ${step.accentColor}` 
                  : isPast 
                  ? '1px solid #1e293b' 
                  : '1px solid transparent',
                backgroundColor: isActive 
                  ? step.accentColor 
                  : isPast 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : 'transparent',
                color: isActive 
                  ? '#ffffff' 
                  : isPast 
                  ? '#cbd5e1' 
                  : '#64748b',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease-in-out',
                fontWeight: isActive ? 800 : isPast ? 600 : 500,
                fontSize: '0.78rem',
                boxShadow: isActive ? `0 2px 8px ${step.accentColor}40` : 'none',
                whiteSpace: 'nowrap'
              }}
              title={`Alternar para ${step.label}`}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: isActive 
                    ? 'rgba(255, 255, 255, 0.25)' 
                    : isPast 
                    ? '#10b981' 
                    : 'rgba(255, 255, 255, 0.08)',
                  color: isPast && !isActive ? '#ffffff' : 'inherit'
                }}
              >
                {isPast && !isActive ? (
                  <FiCheck size={12} style={{ strokeWidth: 3 }} />
                ) : (
                  <Icon size={12} />
                )}
              </div>

              <span>{step.label}</span>

              {isActive && (
                <span 
                  style={{ 
                    fontSize: '0.62rem', 
                    padding: '1px 5px', 
                    borderRadius: '4px', 
                    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
                    color: '#ffffff',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Ativo
                </span>
              )}
            </button>

            {idx < STEPS.length - 1 && (
              <FiChevronRight 
                size={14} 
                style={{ 
                  color: isPast ? '#0ea5e9' : '#334155', 
                  flexShrink: 0,
                  margin: '0 2px' 
                }} 
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
