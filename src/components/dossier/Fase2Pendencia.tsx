import React, { useState, useEffect } from 'react';
import { 
  FiAlertTriangle, 
  FiCheckCircle, 
  FiFileText, 
  FiSave, 
  FiCheck
} from 'react-icons/fi';
import type { Lead } from '../../App';

interface Fase2PendenciaProps {
  lead: Lead;
  onResolvePendencia: (motivoResolvido?: string) => void;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
}

const MOTIVOS_PENDENCIA = [
  'QV (Quadro de Vagas / Pendência Caixa)',
  'Cancelamento',
  'Baixa Manual',
  'Pendência Documental',
  'Exigência de Fiador / Coobrigado',
  'Outros'
] as const;

export const Fase2Pendencia: React.FC<Fase2PendenciaProps> = ({
  lead,
  onResolvePendencia,
  onUpdateLead
}) => {
  const [motivoSelecionado, setMotivoSelecionado] = useState<string>(
    MOTIVOS_PENDENCIA[0]
  );
  const [descricaoPendencia, setDescricaoPendencia] = useState(
    lead.descricao_pendencia || 'Demanda operacional em triagem'
  );
  const [solucaoTexto, setSolucaoTexto] = useState('');
  const [salvoSuccess, setSalvoSuccess] = useState(false);

  useEffect(() => {
    if (lead.descricao_pendencia) {
      setDescricaoPendencia(lead.descricao_pendencia);
      // Tenta inferir o motivo se estiver presente no texto
      const foundMotivo = MOTIVOS_PENDENCIA.find(m => 
        lead.descricao_pendencia?.toLowerCase().includes(m.toLowerCase().slice(0, 8))
      );
      if (foundMotivo) {
        setMotivoSelecionado(foundMotivo);
      }
    }
  }, [lead.descricao_pendencia]);

  const handleSalvarPendencia = () => {
    const textoCompilado = `[${motivoSelecionado}] ${descricaoPendencia.trim()}`;
    onUpdateLead({
      descricao_pendencia: textoCompilado
    });
    setSalvoSuccess(true);
    setTimeout(() => setSalvoSuccess(false), 2000);
  };

  const handleResolver = () => {
    const textoResolucao = solucaoTexto.trim() 
      ? `Pendência resolvida: ${solucaoTexto.trim()}` 
      : `Pendência [${motivoSelecionado}] resolvida operacionalmente.`;
    
    onResolvePendencia(textoResolucao);
  };

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Banner de Alerta da Fase 2 */}
      <div 
        style={{ 
          backgroundColor: '#fff7ed', 
          border: '1.5px solid #fed7aa', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              backgroundColor: '#f97316', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FiAlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#9a3412' }}>
              Fase 2 — Demanda Operacional / Pendência
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#7c2d12' }}>
              Gerencie os gargalos e impedimentos operacionais da pasta junto à agência Caixa ou cliente.
            </p>
          </div>
        </div>

        <span 
          style={{ 
            backgroundColor: '#ea580c', 
            color: '#ffffff', 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontSize: '0.72rem', 
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}
        >
          Demanda Ativa
        </span>
      </div>

      {/* Painel de Gestão dos 6 Motivos Operacionais */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
          Selecione o Motivo Operacional da Pendência:
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {MOTIVOS_PENDENCIA.map((motivo) => {
            const isSelected = motivoSelecionado === motivo;
            return (
              <button
                key={motivo}
                type="button"
                onClick={() => setMotivoSelecionado(motivo)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: isSelected ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#fff7ed' : '#ffffff',
                  color: isSelected ? '#c2410c' : '#334155',
                  fontSize: '0.76rem',
                  fontWeight: isSelected ? 800 : 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: isSelected ? '#ea580c' : '#cbd5e1',
                    flexShrink: 0
                  }} 
                />
                <span>{motivo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhamento da Pendência */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiFileText size={15} style={{ color: '#ea580c' }} />
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
              Descrição e Detalhamento da Pendência: <span style={{ color: '#dc2626' }}>*</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSalvarPendencia}
            style={{
              background: '#0a192f',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {salvoSuccess ? <FiCheck size={12} /> : <FiSave size={12} />}
            <span>{salvoSuccess ? 'Salvo!' : 'Salvar Pendência'}</span>
          </button>
        </div>

        <textarea 
          rows={4}
          value={descricaoPendencia}
          onChange={(e) => setDescricaoPendencia(e.target.value)}
          placeholder="Descreva detalhadamente a exigência da Caixa, documento faltante ou motivo de cancelamento..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1.5px solid #fed7aa',
            fontSize: '0.78rem',
            lineHeight: '1.4',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Painel de Resolução da Pendência */}
      <div 
        style={{ 
          backgroundColor: '#f0fdf4', 
          border: '1.5px solid #bbf7d0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '0.84rem' }}>
          <FiCheckCircle size={18} style={{ color: '#16a34a' }} />
          <span>Resolução e Liberação para Análise</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#14532d', marginBottom: '3px' }}>
            Parecer de Resolução (Opcional):
          </label>
          <input 
            type="text" 
            value={solucaoTexto}
            onChange={(e) => setSolucaoTexto(e.target.value)}
            placeholder="Ex: Documento de residência recebido e conferido / Vagas realocadas pela gerência Caixa..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #86efac',
              fontSize: '0.78rem',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleResolver}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#16a34a',
            border: 'none',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(22, 163, 74, 0.25)',
            marginTop: '4px'
          }}
        >
          <FiCheckCircle size={18} />
          <span>✅ Resolver Pendência e Liberar para Análise ➔</span>
        </button>
      </div>
    </div>
  );
};
