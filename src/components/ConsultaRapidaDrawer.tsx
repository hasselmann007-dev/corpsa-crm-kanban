import React, { useState, useEffect } from 'react';
import { 
  FiZap, 
  FiX, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiSend, 
  FiClock
} from 'react-icons/fi';
import { 
  getConsultasRapidas, 
  salvarNovaConsultaRapida, 
  responderConsultaRapida 
} from '../utils/consultaRapidaStore';
import type { ConsultaRapida } from '../types/consultaRapida';

interface ConsultaRapidaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalistaNome?: string;
}

export const ConsultaRapidaDrawer: React.FC<ConsultaRapidaDrawerProps> = ({
  isOpen,
  onClose,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  const [consultas, setConsultas] = useState<ConsultaRapida[]>([]);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'nova' | 'todas'>('pendentes');

  // Form State
  const [tipoConsulta, setTipoConsulta] = useState<'irpf' | 'imovel' | 'cpf' | 'serasa' | 'outros'>('cpf');
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [documentoIdentificacao, setDocumentoIdentificacao] = useState('');
  const [detalhesSolicitacao, setDetalhesSolicitacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Resposta State per consultation
  const [respostasState, setRespostasState] = useState<Record<string, {
    checkboxes: NonNullable<ConsultaRapida['resultado_checkboxes']>;
    texto: string;
    enviando: boolean;
  }>>({});

  const carregarConsultas = () => {
    const list = getConsultasRapidas();
    setConsultas(list);

    // Inicializa estado de resposta para cada consulta
    const initialRep: Record<string, any> = {};
    list.forEach(c => {
      initialRep[c.id] = {
        checkboxes: c.resultado_checkboxes || {
          pesquisa_limpa: false,
          possui_restricao: false,
          pendencia_documental: false,
          irpf_pendente: false,
          imovel_localizado: false
        },
        texto: c.devolutiva_texto || '',
        enviando: false
      };
    });
    setRespostasState(initialRep);
  };

  useEffect(() => {
    carregarConsultas();

    const handleNew = () => carregarConsultas();
    const handleUpdate = () => carregarConsultas();

    window.addEventListener('corpsa_nova_consulta_rapida', handleNew);
    window.addEventListener('corpsa_consulta_rapida_atualizada', handleUpdate);

    return () => {
      window.removeEventListener('corpsa_nova_consulta_rapida', handleNew);
      window.removeEventListener('corpsa_consulta_rapida_atualizada', handleUpdate);
    };
  }, []);

  const handleCriarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) return;

    setIsSubmitting(true);
    await salvarNovaConsultaRapida({
      tipo_consulta: tipoConsulta,
      nome_cliente: nomeCliente.trim().toUpperCase(),
      cpf_cliente: cpfCliente.trim(),
      data_nascimento: dataNascimento.trim(),
      documento_identificacao: documentoIdentificacao.trim(),
      detalhes_solicitacao: detalhesSolicitacao.trim() || 'Consulta solicitada pelo corretor.',
      canal_origem: 'Manual (Painel Kanban)'
    });

    setIsSubmitting(false);
    setSuccessMsg('Consulta rápida criada com sucesso! Analistas online foram notificados.');
    setNomeCliente('');
    setCpfCliente('');
    setDataNascimento('');
    setDocumentoIdentificacao('');
    setDetalhesSolicitacao('');
    carregarConsultas();
    setTimeout(() => {
      setSuccessMsg('');
      setActiveTab('pendentes');
    }, 1800);
  };

  const handleEnviarDevolutiva = async (consultaId: string) => {
    const state = respostasState[consultaId];
    if (!state) return;

    setRespostasState(prev => ({
      ...prev,
      [consultaId]: { ...prev[consultaId], enviando: true }
    }));

    await responderConsultaRapida(
      consultaId,
      state.checkboxes,
      state.texto || 'Consulta realizada e verificada pelos analistas.',
      currentAnalistaNome
    );

    carregarConsultas();
  };

  if (!isOpen) return null;

  const pendentes = consultas.filter(c => c.status === 'Pendente');
  const exibidas = activeTab === 'pendentes' ? pendentes : consultas;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            padding: '16px 20px', 
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
                backgroundColor: '#f97316', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <FiZap size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Central de Consultas Rápidas</h2>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Consultas de IRPF, Imóvel, CPF e Serasa (Sem criação de card no fluxo)
              </span>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pendentes')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'pendentes' ? '3px solid #0284c7' : 'none',
              backgroundColor: activeTab === 'pendentes' ? '#ffffff' : 'transparent',
              color: activeTab === 'pendentes' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FiAlertCircle size={15} />
            <span>Alertas Pendentes ({pendentes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('nova')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'nova' ? '3px solid #0284c7' : 'none',
              backgroundColor: activeTab === 'nova' ? '#ffffff' : 'transparent',
              color: activeTab === 'nova' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FiZap size={15} />
            <span>+ Nova Consulta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('todas')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'todas' ? '3px solid #0284c7' : 'none',
              backgroundColor: activeTab === 'todas' ? '#ffffff' : 'transparent',
              color: activeTab === 'todas' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FiClock size={15} />
            <span>Histórico ({consultas.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f8fafc' }}>
          {/* TAB 1: FORMULÁRIO DE NOVA CONSULTA */}
          {activeTab === 'nova' && (
            <form onSubmit={handleCriarConsulta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {successMsg && (
                <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                  ✅ {successMsg}
                </div>
              )}

              {/* Tipo de Consulta */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Tipo de Consulta Rápida:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'cpf', label: '🔍 CPF / Restrições Caixa' },
                    { id: 'irpf', label: '📄 Declaração de IRPF' },
                    { id: 'imovel', label: '🏠 Pesquisa de Bens / Imóvel' },
                    { id: 'serasa', label: '🛡️ Consulta Serasa / MO' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoConsulta(t.id as any)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: tipoConsulta === t.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: tipoConsulta === t.id ? '#e0f2fe' : '#ffffff',
                        color: tipoConsulta === t.id ? '#0369a1' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome do Cliente */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Nome Completo do Cliente *:
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Nome completo do proponente"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* CPF e Data de Nascimento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    CPF do Cliente:
                  </label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00"
                    value={cpfCliente}
                    onChange={(e) => setCpfCliente(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Data de Nascimento:
                  </label>
                  <input 
                    type="text" 
                    placeholder="DD/MM/AAAA"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Documento de Identificação (RG / CNH / Matrícula) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Documento de Identificação (RG, CNH, Matrícula do Imóvel):
                </label>
                <input 
                  type="text" 
                  placeholder="Nº do RG / Órgão emissor / Matrícula do imóvel"
                  value={documentoIdentificacao}
                  onChange={(e) => setDocumentoIdentificacao(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* Detalhes da Solicitação */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Descrição / Motivo da Consulta:
                </label>
                <textarea 
                  rows={3}
                  placeholder="Descreva o que o corretor precisa verificar com urgência..."
                  value={detalhesSolicitacao}
                  onChange={(e) => setDetalhesSolicitacao(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !nomeCliente.trim()}
                style={{
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                <FiZap size={18} />
                <span>Disparar Consulta & Notificar Analistas</span>
              </button>
            </form>
          )}

          {/* TAB 2 & 3: LISTA DE ALERTAS E DEVOLUTIVAS */}
          {activeTab !== 'nova' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {exibidas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <FiCheckCircle size={40} style={{ color: '#22c55e', marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma consulta pendente no momento!</p>
                  <span style={{ fontSize: '0.78rem' }}>Todas as solicitações rápidas foram atendidas.</span>
                </div>
              ) : (
                exibidas.map((item) => {
                  const state = respostasState[item.id] || {
                    checkboxes: item.resultado_checkboxes || {},
                    texto: item.devolutiva_texto || '',
                    enviando: false
                  };

                  const isRespondido = item.status === 'Respondido';

                  return (
                    <div 
                      key={item.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: isRespondido ? '1px solid #cbd5e1' : '2px solid #f97316',
                        boxShadow: isRespondido ? '0 1px 4px rgba(0,0,0,0.05)' : '0 4px 14px rgba(249,115,22,0.15)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Card Header */}
                      <div 
                        style={{ 
                          padding: '12px 16px', 
                          backgroundColor: isRespondido ? '#f1f5f9' : '#fff7ed', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #fed7aa'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            style={{ 
                              backgroundColor: isRespondido ? '#e2e8f0' : '#f97316', 
                              color: isRespondido ? '#475569' : '#ffffff', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.7rem', 
                              fontWeight: 800 
                            }}
                          >
                            {item.tipo_consulta.toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                            {item.nome_cliente}
                          </span>
                        </div>

                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            color: isRespondido ? '#16a34a' : '#ea580c' 
                          }}
                        >
                          {isRespondido ? `✅ Respondido por ${item.analista_responsavel}` : '🚨 Alerta Pendente'}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Dados do Cliente */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.78rem', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                          <div><strong>CPF:</strong> {item.cpf_cliente || 'Não informado'}</div>
                          <div><strong>Nascimento:</strong> {item.data_nascimento || 'Não informado'}</div>
                          <div><strong>Doc Identificação:</strong> {item.documento_identificacao || 'Não informado'}</div>
                          <div><strong>Canal:</strong> {item.canal_origem || 'WhatsApp / Sistema'}</div>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                          <strong>Solicitação:</strong> {item.detalhes_solicitacao}
                        </div>

                        {/* Checkboxes de Verificação do Analista */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                            📋 Resultado da Verificação do Analista:
                          </span>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                              { key: 'pesquisa_limpa', label: '✅ Pesquisa Limpa / Sem Restrições na Caixa / Bacen' },
                              { key: 'possui_restricao', label: '⚠️ Possui Restrição Cadastral / Dívida Caixa' },
                              { key: 'irpf_pendente', label: '📄 Pendência de Declaração de IRPF / Malha Fina' },
                              { key: 'imovel_localizado', label: '🏠 Possui Imóvel Ativo em seu nome' },
                              { key: 'pendencia_documental', label: '📁 Documentação incompleta / Ilegível' }
                            ].map(cb => {
                              const checked = (state.checkboxes as any)[cb.key] || false;
                              return (
                                <label 
                                  key={cb.key}
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: isRespondido ? 'default' : 'pointer' }}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isRespondido}
                                    onChange={(e) => {
                                      setRespostasState(prev => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          checkboxes: {
                                            ...prev[item.id].checkboxes,
                                            [cb.key]: e.target.checked
                                          }
                                        }
                                      }));
                                    }}
                                    style={{ accentColor: '#f97316' }}
                                  />
                                  <span>{cb.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Campo de Devolutiva / Resposta */}
                        <div style={{ marginTop: '6px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                            Mensagem de Devolutiva ao Corretor:
                          </label>
                          <textarea 
                            rows={2}
                            disabled={isRespondido}
                            value={state.texto}
                            onChange={(e) => {
                              setRespostasState(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  texto: e.target.value
                                }
                              }));
                            }}
                            placeholder="Escreva a resposta e orientações para o corretor..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                          />
                        </div>

                        {/* Botão Enviar Devolutiva */}
                        {!isRespondido && (
                          <button
                            type="button"
                            onClick={() => handleEnviarDevolutiva(item.id)}
                            disabled={state.enviando}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 14px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              alignSelf: 'flex-end',
                              marginTop: '4px'
                            }}
                          >
                            <FiSend size={14} />
                            <span>{state.enviando ? 'Enviando...' : 'Concluir & Enviar Devolutiva'}</span>
                          </button>
                        )}

                        {isRespondido && item.data_devolutiva && (
                          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontStyle: 'italic', textAlign: 'right' }}>
                            Devolutiva registrada às {item.data_devolutiva}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
