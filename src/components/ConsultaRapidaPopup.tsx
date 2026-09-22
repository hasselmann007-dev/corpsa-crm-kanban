import React, { useState, useEffect } from 'react';
import { 
  FiZap, 
  FiX, 
  FiCheckCircle, 
  FiSend, 
  FiClock,
  FiUser,
  FiFileText,
  FiCheck,
  FiList
} from 'react-icons/fi';
import { 
  getConsultasRapidas, 
  salvarNovaConsultaRapida, 
  responderConsultaRapida 
} from '../utils/consultaRapidaStore';
import type { ConsultaRapida } from '../types/consultaRapida';

interface ConsultaRapidaPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalistaNome?: string;
}

export const ConsultaRapidaPopup: React.FC<ConsultaRapidaPopupProps> = ({
  isOpen,
  onClose,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  const [activeTab, setActiveTab] = useState<'nova' | 'pendentes'>('nova');
  const [tipoConsulta, setTipoConsulta] = useState<'cpf' | 'irpf' | 'imovel' | 'serasa' | 'outros'>('cpf');
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [detalhesSolicitacao, setDetalhesSolicitacao] = useState('');
  
  const [consultas, setConsultas] = useState<ConsultaRapida[]>([]);
  const [selectedConsulta, setSelectedConsulta] = useState<ConsultaRapida | null>(null);
  
  // Resposta do analista
  const [respostaCheckboxes, setRespostaCheckboxes] = useState({
    pesquisa_limpa: false,
    possui_restricao: false,
    pendencia_documental: false,
    irpf_pendente: false,
    imovel_localizado: false
  });
  const [devolutivaTexto, setDevolutivaTexto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadConsultas = () => {
    const list = getConsultasRapidas();
    setConsultas(list);
    const pendentes = list.filter(c => c.status === 'Pendente');
    if (pendentes.length > 0 && !selectedConsulta) {
      setSelectedConsulta(pendentes[0]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConsultas();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => loadConsultas();
    window.addEventListener('corpsa_nova_consulta_rapida', handleUpdate);
    window.addEventListener('corpsa_consulta_rapida_atualizada', handleUpdate);
    return () => {
      window.removeEventListener('corpsa_nova_consulta_rapida', handleUpdate);
      window.removeEventListener('corpsa_consulta_rapida_atualizada', handleUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const pendentesCount = consultas.filter(c => c.status === 'Pendente').length;

  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length > 6) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return digits;
  };

  const handleCriarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      await salvarNovaConsultaRapida({
        tipo_consulta: tipoConsulta,
        nome_cliente: nomeCliente.trim(),
        cpf_cliente: cpfCliente.trim() || undefined,
        detalhes_solicitacao: detalhesSolicitacao.trim() || 'Consulta solicitada via Popup Rápido',
        canal_origem: 'Popup CRM'
      });

      setFeedbackMsg('🚨 Alerta sonoro e notificação disparados com sucesso para os analistas online!');
      setNomeCliente('');
      setCpfCliente('');
      setDetalhesSolicitacao('');
      loadConsultas();
      setTimeout(() => {
        setFeedbackMsg('');
        setActiveTab('pendentes');
      }, 1200);
    } catch (_err) {
      alert('Erro ao enviar consulta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResponderConsulta = async () => {
    if (!selectedConsulta) return;
    setIsSubmitting(true);
    try {
      await responderConsultaRapida(
        selectedConsulta.id,
        respostaCheckboxes,
        devolutivaTexto.trim() || 'Consulta realizada e finalizada pelo analista.',
        currentAnalistaNome
      );

      setFeedbackMsg('✅ Devolutiva registrada com sucesso!');
      setDevolutivaTexto('');
      loadConsultas();
      setTimeout(() => setFeedbackMsg(''), 2000);
    } catch (_err) {
      alert('Erro ao responder consulta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            backgroundColor: '#0a192f',
            padding: '16px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid #f97316'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <FiZap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.3px' }}>
                Consultas Rápidas (Alerta Instantâneo)
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Não gera card no fluxo. Emite som e notificação direta aos analistas de plantão.
              </span>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setActiveTab('nova')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: activeTab === 'nova' ? '#ffffff' : 'transparent',
              color: activeTab === 'nova' ? '#0284c7' : '#64748b',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'nova' ? '2px solid #0284c7' : 'none'
            }}
          >
            <FiZap size={15} />
            <span>Nova Consulta Rápida</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pendentes')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: activeTab === 'pendentes' ? '#ffffff' : 'transparent',
              color: activeTab === 'pendentes' ? '#f97316' : '#64748b',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'pendentes' ? '2px solid #f97316' : 'none'
            }}
          >
            <FiList size={15} />
            <span>Fila de Consultas</span>
            {pendentesCount > 0 && (
              <span style={{ backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.68rem', fontWeight: 900 }}>
                {pendentesCount}
              </span>
            )}
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div style={{ padding: '10px 16px', backgroundColor: '#f0fdf4', color: '#15803d', borderBottom: '1px solid #bbf7d0', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCheckCircle size={16} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {activeTab === 'nova' ? (
            /* Formulário de 3 Campos Compactos */
            <form onSubmit={handleCriarConsulta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Tipo de Consulta */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  1. SELECIONE O TIPO DE CONSULTA:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'cpf', label: 'CPF / Caixa', desc: 'Restrições Caixa/Bacen' },
                    { id: 'irpf', label: 'IRPF', desc: 'Declaração / Malha' },
                    { id: 'imovel', label: 'Imóvel / Bens', desc: 'Posse de Bens' },
                    { id: 'serasa', label: 'Serasa', desc: 'Restrições / Score' },
                    { id: 'outros', label: 'Outro', desc: 'Dúvida geral' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoConsulta(t.id as any)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: tipoConsulta === t.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: tipoConsulta === t.id ? '#eff6ff' : '#ffffff',
                        color: tipoConsulta === t.id ? '#0369a1' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.76rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{t.label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Nome e CPF */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                    2. Nome do Cliente *:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', backgroundColor: '#ffffff' }}>
                    <FiUser size={15} style={{ color: '#94a3b8', marginRight: '6px' }} />
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Gabriel Monteiro"
                      value={nomeCliente}
                      onChange={(e) => setNomeCliente(e.target.value)}
                      style={{ width: '100%', border: 'none', outline: 'none', padding: '8px 0', fontSize: '0.84rem', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                    CPF do Cliente:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', backgroundColor: '#ffffff' }}>
                    <FiFileText size={15} style={{ color: '#94a3b8', marginRight: '6px' }} />
                    <input 
                      type="text" 
                      placeholder="000.000.000-00"
                      value={cpfCliente}
                      onChange={(e) => setCpfCliente(formatCpf(e.target.value))}
                      style={{ width: '100%', border: 'none', outline: 'none', padding: '8px 0', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Dúvida / Motivo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                  3. Descrição / Dúvida do Corretor:
                </label>
                <textarea 
                  rows={3}
                  required
                  placeholder="Ex: Verificar se possui declaração de IRPF entregue e se tem restrição cadastral no CPF..."
                  value={detalhesSolicitacao}
                  onChange={(e) => setDetalhesSolicitacao(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isSubmitting || !nomeCliente.trim()}
                style={{
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
                  marginTop: '4px'
                }}
              >
                <FiSend size={16} />
                <span>{isSubmitting ? 'Disparando...' : '🚨 Disparar Alerta para Analistas Online'}</span>
              </button>
            </form>
          ) : (
            /* Fila de Consultas e Devolutiva do Analista */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {consultas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  <FiClock size={32} style={{ marginBottom: '8px', color: '#cbd5e1' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma consulta rápida registrada ainda.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '14px' }}>
                  {/* Lista de Consultas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
                    {consultas.map(item => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedConsulta(item)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: selectedConsulta?.id === item.id ? '2px solid #0284c7' : '1px solid #e2e8f0',
                          backgroundColor: selectedConsulta?.id === item.id ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: item.status === 'Pendente' ? '#ea580c' : '#15803d' }}>
                            {item.tipo_consulta.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{item.status}</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nome_cliente}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>CPF: {item.cpf_cliente || 'N/A'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Detalhe & Resposta do Analista */}
                  {selectedConsulta ? (
                    <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>{selectedConsulta.nome_cliente}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>CPF: {selectedConsulta.cpf_cliente || 'N/A'} | Tipo: {selectedConsulta.tipo_consulta.toUpperCase()}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: selectedConsulta.status === 'Pendente' ? '#fef3c7' : '#dcfce7', color: selectedConsulta.status === 'Pendente' ? '#b45309' : '#15803d' }}>
                          {selectedConsulta.status}
                        </span>
                      </div>

                      <div style={{ backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: '6px', fontSize: '0.76rem', color: '#334155', border: '1px solid #e2e8f0' }}>
                        <strong>Dúvida do Corretor:</strong> {selectedConsulta.detalhes_solicitacao}
                      </div>

                      {selectedConsulta.status === 'Pendente' ? (
                        /* Área de resposta */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>CHECKBOXES DE CONFERÊNCIA:</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                            {[
                              { key: 'pesquisa_limpa', label: 'Pesquisa Limpa / Sem Restrições' },
                              { key: 'possui_restricao', label: 'Possui Restrição Cadastral' },
                              { key: 'imovel_localizado', label: 'Imóvel Ativo Localizado' },
                              { key: 'irpf_pendente', label: 'Pendência em Declaração de IRPF' },
                              { key: 'pendencia_documental', label: 'Documentação Incompleta' }
                            ].map(cb => (
                              <label key={cb.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox"
                                  checked={(respostaCheckboxes as any)[cb.key]}
                                  onChange={(e) => setRespostaCheckboxes({ ...respostaCheckboxes, [cb.key]: e.target.checked })}
                                  style={{ width: '14px', height: '14px', accentColor: '#0284c7' }}
                                />
                                <span>{cb.label}</span>
                              </label>
                            ))}
                          </div>

                          <div style={{ marginTop: '4px' }}>
                            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                              Devolutiva ao Corretor:
                            </label>
                            <input 
                              type="text" 
                              placeholder="Ex: Consulta realizada, CPF limpo e apto para simulação."
                              value={devolutivaTexto}
                              onChange={(e) => setDevolutivaTexto(e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleResponderConsulta}
                            disabled={isSubmitting}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <FiCheck size={14} />
                            <span>Concluir & Enviar Devolutiva</span>
                          </button>
                        </div>
                      ) : (
                        /* Já respondida */
                        <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 800, color: '#15803d' }}>✅ Resposta do Analista ({selectedConsulta.analista_responsavel || 'Equipe CORPSA'}):</span>
                          <span style={{ color: '#166534' }}>{selectedConsulta.devolutiva_texto}</span>
                          <span style={{ fontSize: '0.68rem', color: '#86efac' }}>Respondido às {selectedConsulta.data_devolutiva || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
