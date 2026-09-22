import React, { useState, useEffect, useRef } from 'react';
import { X, CheckSquare, Zap } from 'lucide-react';
import { playAlertChime } from '../utils/notificationSound';
import { getConsultasRapidas } from '../utils/consultaRapidaStore';
import type { ConsultaRapida } from '../types/consultaRapida';

interface ConsultaRapidaToastAlertProps {
  onOpenPopup: () => void;
}

export const ConsultaRapidaToastAlert: React.FC<ConsultaRapidaToastAlertProps> = ({ onOpenPopup }) => {
  const [activeAlert, setActiveAlert] = useState<ConsultaRapida | null>(null);
  const lastSeenIdRef = useRef<string>('');

  useEffect(() => {
    // 1. Escuta evento reativo disparado na mesma aba
    const handleNovaConsulta = (e: any) => {
      if (e.detail) {
        lastSeenIdRef.current = e.detail.id;
        setActiveAlert(e.detail);
        playAlertChime();
      }
    };

    window.addEventListener('corpsa_nova_consulta_rapida', handleNovaConsulta);

    // 2. Polling resiliente a cada 3 segundos para detectar consultas criadas via API/Chat
    const interval = setInterval(() => {
      try {
        const consultas = getConsultasRapidas();
        if (consultas.length > 0) {
          const latest = consultas[0];
          if (!lastSeenIdRef.current) {
            lastSeenIdRef.current = latest.id;
          } else if (latest.id !== lastSeenIdRef.current && latest.status === 'Pendente') {
            lastSeenIdRef.current = latest.id;
            setActiveAlert(latest);
            playAlertChime();
          }
        }
      } catch (_e) {}
    }, 3000);

    return () => {
      window.removeEventListener('corpsa_nova_consulta_rapida', handleNovaConsulta);
      clearInterval(interval);
    };
  }, []);

  if (!activeAlert) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        backgroundColor: '#0a192f',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 16px 36px rgba(0,0,0,0.4)',
        border: '2px solid #f97316',
        maxWidth: '380px',
        animation: 'slideUp 0.3s ease-out',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'inherit'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={15} style={{ color: '#f97316' }} />
            <span style={{ fontWeight: 900, fontSize: '0.84rem', color: '#f97316', letterSpacing: '0.4px' }}>
              CONSULTA RÁPIDA: {activeAlert.tipo_consulta.toUpperCase()}
            </span>
          </div>
        </div>
        <button 
          onClick={() => setActiveAlert(null)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
          title="Fechar alerta"
        >
          <X size={16} />
        </button>
      </div>

      <div>
        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
          {activeAlert.nome_cliente}
        </div>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
          CPF: {activeAlert.cpf_cliente || 'Não Informado'}
        </div>
        {activeAlert.detalhes_solicitacao && (
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '4px', fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.06)', padding: '6px 8px', borderRadius: '6px' }}>
            "{activeAlert.detalhes_solicitacao}"
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => {
            setActiveAlert(null);
            onOpenPopup();
          }}
          style={{
            flex: 1,
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
          }}
        >
          <CheckSquare size={14} />
          <span>Responder Consulta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          style={{
            backgroundColor: 'transparent',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.74rem',
            cursor: 'pointer'
          }}
        >
          Dispensar
        </button>
      </div>
    </div>
  );
};
