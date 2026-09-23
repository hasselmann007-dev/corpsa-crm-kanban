import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiX, 
  FiFolder
} from 'react-icons/fi';
import type { Lead } from '../App';
import { DossierStepper } from './dossier/DossierStepper';
import { Coluna1LeadInfo } from './dossier/Coluna1LeadInfo';
import { Coluna3DocAnexos } from './dossier/Coluna3DocAnexos';
import { Fase1Roleta } from './dossier/Fase1Roleta';
import { Fase2Pendencia } from './dossier/Fase2Pendencia';
import { Fase3Analise } from './dossier/Fase3Analise';
import { Fase4ConclusaoCorPay } from './dossier/Fase4ConclusaoCorPay';

interface LeadDetailFullModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
  currentAnalistaNome?: string;
}

export const LeadDetailFullModal: React.FC<LeadDetailFullModalProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  if (!isOpen || !lead) return null;

  // Estado da etapa ativa refletindo a esteira do cliente
  const [activeStage, setActiveStage] = useState<Lead['etapa']>(lead.etapa || 'Roleta');

  // Atualiza a etapa ativa sempre que o lead recebido mudar
  useEffect(() => {
    if (lead?.etapa) {
      setActiveStage(lead.etapa);
    }
  }, [lead?.id, lead?.etapa]);

  // Transição de etapa com salvaguardas rigorosas para constraints do banco de dados (Supabase PostgreSQL)
  const handleStageTransition = useCallback(async (targetStage: Lead['etapa']) => {
    setActiveStage(targetStage);

    const patchPayload: Partial<Lead> = {
      etapa: targetStage
    };

    // Constraint chk_descricao_pendencia: se mover para Pendencia, exige descricao_pendencia não nula
    if (targetStage === 'Pendencia') {
      if (!lead.descricao_pendencia || lead.descricao_pendencia.trim().length === 0) {
        patchPayload.descricao_pendencia = 'Demanda operacional em triagem';
      }
    }

    // Constraint chk_resultado_analise: se mover para Analise, exige resultado_analise preenchido
    if (targetStage === 'Analise') {
      if (!lead.resultado_analise || lead.resultado_analise.trim().length === 0) {
        patchPayload.resultado_analise = 'Aprovado';
      }
    }

    onUpdateLead(patchPayload);
  }, [lead, onUpdateLead]);

  const getStageBadgeColor = (stage: Lead['etapa']) => {
    switch (stage) {
      case 'Roleta': return '#6366f1';
      case 'Pendencia': return '#f97316';
      case 'Analise': return '#0ea5e9';
      case 'Conclusao': return '#10b981';
      default: return '#f97316';
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        style={{
          width: '98vw',
          maxWidth: '1680px',
          height: '95vh',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Top Header Institucional CORPSA */}
        <div 
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#0a192f', 
            color: '#ffffff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '3px solid #f97316'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                backgroundColor: '#0284c7', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              <FiFolder size={18} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.3px' }}>
                  {lead.nome_cliente || 'DOSSIÊ DO CLIENTE'}
                </h2>
                <span 
                  style={{ 
                    backgroundColor: getStageBadgeColor(activeStage), 
                    color: '#ffffff', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.68rem', 
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  ETAPA: {activeStage.toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                CPF: {lead.cpf_cliente || '000.000.000-00'} | Origem: {lead.grupo_origem || 'WhatsApp'} | Cidade: {lead.cidade || 'Ribeirão Preto'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                border: 'none', 
                color: '#cbd5e1', 
                cursor: 'pointer', 
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Fechar Dossiê"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Stepper Interativo de Esteira no Topo do Dossiê (R2) */}
        <DossierStepper 
          currentStage={activeStage} 
          onStageChange={handleStageTransition} 
        />

        {/* Layout Grid com 3 Colunas Lado a Lado (R4 & R3) */}
        <div 
          style={{ 
            flex: 1, 
            display: 'grid', 
            gridTemplateColumns: '320px 1fr 320px', 
            overflow: 'hidden', 
            backgroundColor: '#f8fafc' 
          }}
        >
          {/* COLUNA 1 (ESQUERDA - 320px): HISTÓRICO DE MENSAGENS & CHAT DO CLIENTE */}
          <Coluna1LeadInfo 
            lead={lead} 
            onUpdateLead={onUpdateLead} 
            onStageChange={handleStageTransition} 
            currentStage={activeStage}
            currentAnalistaNome={currentAnalistaNome}
          />

          {/* COLUNA 2 (CENTRAL - 1fr): DINÂMICA ADAPTATIVA POR ETAPA (R3) */}
          <main 
            aria-label="Conteúdo Central da Etapa"
            style={{ 
              height: '100%', 
              overflowY: 'auto', 
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {activeStage === 'Roleta' && (
              <Fase1Roleta 
                lead={lead} 
                onAdvanceToAnalise={() => handleStageTransition('Analise')} 
                onReportPendencia={() => handleStageTransition('Pendencia')} 
                onUpdateLead={onUpdateLead} 
              />
            )}

            {activeStage === 'Pendencia' && (
              <Fase2Pendencia 
                lead={lead} 
                onResolvePendencia={(motivoResolvido) => {
                  if (motivoResolvido) {
                    onUpdateLead({ descricao_pendencia: motivoResolvido });
                  }
                  handleStageTransition('Analise');
                }} 
                onUpdateLead={onUpdateLead} 
              />
            )}

            {activeStage === 'Analise' && (
              <Fase3Analise 
                lead={lead} 
                onAdvanceToConclusao={() => handleStageTransition('Conclusao')} 
                onUpdateLead={onUpdateLead} 
                currentAnalistaNome={currentAnalistaNome} 
              />
            )}

            {activeStage === 'Conclusao' && (
              <Fase4ConclusaoCorPay 
                lead={lead} 
                onUpdateLead={onUpdateLead} 
                currentAnalistaNome={currentAnalistaNome}
              />
            )}
          </main>

          {/* COLUNA 3 (DIREITA - 320px): DOC E ANEXOS CENTRALIZADO (R4) */}
          <Coluna3DocAnexos lead={lead} />
        </div>
      </div>
    </div>
  );
};
