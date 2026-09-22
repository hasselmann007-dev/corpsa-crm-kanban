import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Power, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';
import { getAnalistasPresenca, setAnalistaStatus } from '../utils/consultaRapidaStore';
import type { AnalistaPresenca } from '../types/consultaRapida';

interface AnalistasOnlineBarProps {
  currentUserName?: string;
}

export const AnalistasOnlineBar: React.FC<AnalistasOnlineBarProps> = ({
  currentUserName = 'Danilo Hasselmann'
}) => {
  const [analistas, setAnalistas] = useState<AnalistaPresenca[]>([]);
  const [isMyStatusOnline, setIsMyStatusOnline] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const loadPresence = () => {
    const list = getAnalistasPresenca();
    setAnalistas(list);
    const me = list.find(a => a.nome.toLowerCase() === currentUserName.toLowerCase());
    if (me) {
      setIsMyStatusOnline(me.isOnline);
    }
  };

  useEffect(() => {
    loadPresence();

    const handlePresenceChanged = (e: any) => {
      if (e.detail) {
        setAnalistas(e.detail);
      } else {
        loadPresence();
      }
    };

    window.addEventListener('corpsa_analistas_status_changed', handlePresenceChanged);
    return () => {
      window.removeEventListener('corpsa_analistas_status_changed', handlePresenceChanged);
    };
  }, [currentUserName]);

  const handleToggleMyStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = !isMyStatusOnline;
    setIsMyStatusOnline(nextStatus);
    const updated = setAnalistaStatus('me', nextStatus, currentUserName);
    setAnalistas(updated);
  };

  const onlineCount = analistas.filter(a => a.isOnline).length;

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#0a192f',
        color: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        fontSize: '0.8rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box',
        marginBottom: '10px'
      }}
    >
      {/* Barra Principal (Alinhada na Sidebar) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isExpanded ? '#0f172a' : '#0a192f',
          borderBottom: isExpanded ? '1px solid #1e293b' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isMyStatusOnline ? '#22c55e' : '#94a3b8',
              boxShadow: isMyStatusOnline ? '0 0 6px #22c55e' : 'none'
            }} 
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={14} style={{ color: '#38bdf8' }} />
            <span style={{ fontWeight: 800, fontSize: '0.74rem' }}>
              Analistas: {onlineCount} online
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Botão de Alternar Status */}
          <button
            type="button"
            onClick={handleToggleMyStatus}
            style={{
              padding: '2px 6px',
              borderRadius: '5px',
              border: isMyStatusOnline ? '1px solid #16a34a' : '1px solid #475569',
              backgroundColor: isMyStatusOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              color: isMyStatusOnline ? '#4ade80' : '#94a3b8',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Clique para alternar entre Online e Offline"
          >
            <Power size={11} />
            <span>{isMyStatusOnline ? 'Online' : 'Offline'}</span>
          </button>

          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        </div>
      </div>

      {/* Painel Expansível com Detalhes da Equipe */}
      {isExpanded && (
        <div 
          style={{ 
            padding: '8px 10px', 
            backgroundColor: '#0a192f',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            maxHeight: '180px',
            overflowY: 'auto'
          }}
        >
          <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Equipe de Plantão
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {analistas.map((an) => (
              <div 
                key={an.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 6px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  fontSize: '0.72rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span 
                    style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      backgroundColor: an.isOnline ? '#22c55e' : '#64748b' 
                    }} 
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: an.isOnline ? '#ffffff' : '#94a3b8', fontSize: '0.72rem' }}>
                      {an.nome}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>
                      {an.cargo}
                    </span>
                  </div>
                </div>

                <span 
                  style={{ 
                    fontSize: '0.62rem', 
                    fontWeight: 700, 
                    color: an.isOnline ? '#4ade80' : '#64748b' 
                  }}
                >
                  {an.isOnline ? 'Disponível' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
