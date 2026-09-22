import React, { useState, useEffect, useRef } from 'react';
import { 
  FiUser, 
  FiCopy, 
  FiCheck, 
  FiMessageCircle, 
  FiSend,
  FiClock,
  FiLayers,
  FiRepeat,
  FiX
} from 'react-icons/fi';
import type { Lead } from '../../App';
import { 
  getAnalistaResponsavel, 
  isAnalistaOnline, 
  registrarTrocaAnalista,
  type MotivoTrocaAnalista 
} from '../../utils/analistaResponsavel';

export interface LeadChatMessage {
  id: string;
  autor: string;
  texto: string;
  data_hora: string;
  etapa_origem?: string;
}

interface Coluna1LeadInfoProps {
  lead: Lead;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
  onStageChange: (newStage: Lead['etapa']) => void;
  currentStage: Lead['etapa'];
  currentAnalistaNome?: string;
}

export const Coluna1LeadInfo: React.FC<Coluna1LeadInfoProps> = ({
  lead,
  onUpdateLead,
  onStageChange,
  currentStage,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  const [cpfCopied, setCpfCopied] = useState(false);
  const [messages, setMessages] = useState<LeadChatMessage[]>([]);
  const [inputTexto, setInputTexto] = useState('');
  const [showTrocaModal, setShowTrocaModal] = useState(false);
  const [motivoTroca, setMotivoTroca] = useState<MotivoTrocaAnalista>('Pegar Pendência');
  const [obsTroca, setObsTroca] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `corpsa_lead_chat_${lead.id}`;

  // Carrega histórico de mensagens do cliente (LocalStorage + notas iniciais)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (_e) {}

    // Mensagens padrão iniciais a partir dos dados do lead
    const initialMsgs: LeadChatMessage[] = [];

    // Mensagem 1: Entrada do cliente na esteira
    const dataChegada = lead.data_hora_entrada 
      ? new Date(lead.data_hora_entrada).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      : 'Hoje';

    initialMsgs.push({
      id: `msg-init-1-${lead.id}`,
      autor: 'Sistema CORPSA',
      texto: `Lead recebido na etapa Roleta via canal ${lead.grupo_origem || 'WhatsApp'}. Imóvel pretendido: R$ ${(lead.valor_imovel || 0).toLocaleString('pt-BR')}.`,
      data_hora: dataChegada,
      etapa_origem: 'Roleta'
    });

    // Mensagem 2: Se houver observações de triagem
    if (lead.informacoes_importantes && lead.informacoes_importantes.trim()) {
      initialMsgs.push({
        id: `msg-init-2-${lead.id}`,
        autor: 'Triagem / Corretor',
        texto: lead.informacoes_importantes.trim(),
        data_hora: dataChegada,
        etapa_origem: 'Roleta'
      });
    }

    setMessages(initialMsgs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(initialMsgs));
    } catch (_e) {}
  }, [lead.id, lead.data_hora_entrada, lead.grupo_origem, lead.valor_imovel, lead.informacoes_importantes, storageKey]);

  // Rola para a mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envio de nova mensagem no chat do cliente
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const texto = inputTexto.trim();
    if (!texto) return;

    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const novaMsg: LeadChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      autor: currentAnalistaNome,
      texto,
      data_hora: agora,
      etapa_origem: currentStage
    };

    const updated = [...messages, novaMsg];
    setMessages(updated);
    setInputTexto('');

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (_e) {}

    // Também adiciona ao histórico geral de informações importantes do lead para persistência no banco
    const appendTexto = `\n[${agora} - ${currentAnalistaNome}]: ${texto}`;
    onUpdateLead({
      informacoes_importantes: (lead.informacoes_importantes || '') + appendTexto
    });
  };

  // Cópia em 1-clique do CPF limpo (apenas números)
  const handleCopyCpf = () => {
    const cleanCpf = (lead.cpf_cliente || '').replace(/\D/g, '');
    if (!cleanCpf) return;
    navigator.clipboard.writeText(cleanCpf);
    setCpfCopied(true);
    setTimeout(() => setCpfCopied(false), 2000);
  };

  // Abrir WhatsApp direto com o cliente / corretor
  const handleOpenWhatsApp = () => {
    const raw = lead.informacoes_importantes || '';
    const phoneMatch = raw.match(/(?:\(?([1-9]{2})\)?\s*)?(?:9\s*)?([0-9]{4})[-.\s]?([0-9]{4})/);
    const digits = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : '';
    const cleanDigits = digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
    if (cleanDigits) {
      window.open(`https://wa.me/${cleanDigits}`, '_blank', 'noopener,noreferrer');
    } else {
      alert('Telefone do cliente/corretor não localizado nas notas da triagem.');
    }
  };

  const analistaResponsavel = getAnalistaResponsavel(lead, currentAnalistaNome);
  const isOnline = isAnalistaOnline(analistaResponsavel);

  const handleConfirmarTroca = () => {
    const { novoTextoInfo, mensagemChat } = registrarTrocaAnalista(
      lead,
      currentAnalistaNome,
      motivoTroca,
      obsTroca
    );

    // 1. Atualiza no Supabase / App
    onUpdateLead({ informacoes_importantes: novoTextoInfo });

    // 2. Registra no chat do lead
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const novaMsg: LeadChatMessage = {
      id: `msg-troca-${Date.now()}`,
      autor: 'Sistema CORPSA',
      texto: mensagemChat,
      data_hora: agora,
      etapa_origem: currentStage
    };

    const updatedMsgs = [...messages, novaMsg];
    setMessages(updatedMsgs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedMsgs));
    } catch (_e) {}

    // 3. Notifica o CRM
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('corpsa_refresh_leads'));
    }

    setShowTrocaModal(false);
    setObsTroca('');
  };

  return (
    <aside 
      aria-label="Histórico e Mensagens do Cliente"
      style={{
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
        backgroundColor: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Compacto de Identificação do Lead */}
      <div 
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                backgroundColor: '#0a192f', 
                color: '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FiUser size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div 
                style={{ 
                  fontSize: '0.86rem', 
                  fontWeight: 900, 
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={lead.nome_cliente}
              >
                {lead.nome_cliente || 'NOME DO CLIENTE'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                CPF: {lead.cpf_cliente || 'Não Informado'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCpf}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: cpfCopied ? '#dcfce7' : '#eff6ff',
              color: cpfCopied ? '#16a34a' : '#0284c7',
              border: `1px solid ${cpfCopied ? '#bbf7d0' : '#bfdbfe'}`,
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Copiar CPF limpo para a área de transferência"
          >
            {cpfCopied ? <FiCheck size={11} /> : <FiCopy size={11} />}
            <span>{cpfCopied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>

        {/* Ações Rápidas: WhatsApp e Seletor de Etapa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: '#22c55e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <FiMessageCircle size={13} />
            <span>WhatsApp</span>
          </button>

          <div style={{ flex: 1.2, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <FiLayers size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
            <select
              value={currentStage}
              onChange={(e) => onStageChange(e.target.value as any)}
              style={{
                width: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="Roleta">1. Roleta</option>
              <option value="Pendencia">2. Pendência</option>
              <option value="Analise">3. Análise</option>
              <option value="Conclusao">4. Conclusão</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1.1 Card do Analista Responsável & Troca / Assunção na Ausência */}
      <div 
        style={{
          padding: '8px 14px',
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div 
              style={{ 
                width: '26px', 
                height: '26px', 
                borderRadius: '50%', 
                backgroundColor: '#0a192f', 
                color: '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 800
              }}
            >
              {analistaResponsavel.slice(0, 2).toUpperCase()}
            </div>
            <span 
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isOnline ? '#22c55e' : '#f59e0b',
                border: '1.5px solid #ffffff'
              }} 
              title={isOnline ? 'Analista Online' : 'Analista Ausente / Offline'}
            />
          </div>

          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Analista:</span>
              <span style={{ color: isOnline ? '#16a34a' : '#d97706', fontWeight: 800 }}>
                {isOnline ? '● Online' : '○ Ausente'}
              </span>
            </div>
            <div 
              style={{ 
                fontSize: '0.74rem', 
                fontWeight: 800, 
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={analistaResponsavel}
            >
              {analistaResponsavel}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTrocaModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.68rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Assumir pasta ou transferir responsabilidade na ausência"
        >
          <FiRepeat size={11} style={{ color: '#f97316' }} />
          <span>Trocar</span>
        </button>
      </div>

      {/* 2. Barra de Título do Histórico / Chat */}
      <div 
        style={{
          padding: '10px 16px',
          backgroundColor: '#0a192f',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #f97316'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiMessageCircle size={15} style={{ color: '#f97316' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.3px' }}>
            Histórico de Mensagens & Notas
          </span>
        </div>
        <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
          {messages.length}
        </span>
      </div>

      {/* 3. Lista de Mensagens / Timeline do Cliente (Persistente em Todas as Fases) */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem', marginTop: '30px' }}>
            <FiClock size={24} style={{ marginBottom: '6px', opacity: 0.5 }} />
            <p>Nenhuma mensagem ou nota registrada para este cliente ainda.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.autor === currentAnalistaNome;
            const isSystem = msg.autor.includes('Sistema');

            return (
              <div 
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isSystem ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                  maxWidth: isSystem ? '95%' : '90%',
                  width: isSystem ? '95%' : 'auto'
                }}
              >
                {/* Cabeçalho da Mensagem: Autor & Hora */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '2px',
                    fontSize: '0.65rem',
                    color: '#64748b',
                    justifyContent: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <span style={{ fontWeight: 800, color: isSystem ? '#f97316' : (isMe ? '#0284c7' : '#334155') }}>
                    {msg.autor}
                  </span>
                  <span>•</span>
                  <span>{msg.data_hora}</span>
                  {msg.etapa_origem && (
                    <span 
                      style={{
                        fontSize: '0.6rem',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}
                    >
                      {msg.etapa_origem}
                    </span>
                  )}
                </div>

                {/* Balão da Mensagem */}
                <div 
                  style={{
                    backgroundColor: isSystem ? '#fff7ed' : (isMe ? '#0284c7' : '#ffffff'),
                    color: isSystem ? '#9a3412' : (isMe ? '#ffffff' : '#0f172a'),
                    border: isSystem ? '1px solid #ffedd5' : (isMe ? 'none' : '1px solid #cbd5e1'),
                    borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 11px',
                    fontSize: '0.76rem',
                    lineHeight: '1.4',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.texto}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Campo de Input para Adicionar Mensagens / Notas */}
      <form 
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          gap: '6px',
          alignItems: 'center'
        }}
      >
        <input 
          type="text"
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          placeholder="Escreva uma mensagem ou nota..."
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '0.76rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!inputTexto.trim()}
          style={{
            backgroundColor: inputTexto.trim() ? '#0a192f' : '#cbd5e1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: inputTexto.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Enviar mensagem sobre o cliente"
        >
          <FiSend size={13} />
        </button>
      </form>

      {/* Modal de Assunção / Troca de Analista na Ausência */}
      {showTrocaModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
          onClick={() => setShowTrocaModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: '#0a192f',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #f97316'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiRepeat size={16} style={{ color: '#f97316' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 800 }}>
                  Assumir / Trocar Pasta
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTrocaModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  lineHeight: '1.5'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Responsável Atual:</span>
                  <strong style={{ color: '#0f172a' }}>{analistaResponsavel}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Novo Responsável:</span>
                  <strong style={{ color: '#0284c7' }}>{currentAnalistaNome} (Você)</strong>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                  Motivo da Assunção / Troca
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: 'Pegar Pendência', label: 'Pegar Pendência (Ausência do responsável)' },
                    { id: 'Pegar Reavaliação', label: 'Pegar Reavaliação (Revisão de crédito)' },
                    { id: 'Assumir Atendimento Geral', label: 'Assumir Atendimento Geral da Pasta' }
                  ].map(opt => (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: motivoTroca === opt.id ? '#eff6ff' : '#ffffff',
                        border: `1px solid ${motivoTroca === opt.id ? '#3b82f6' : '#cbd5e1'}`,
                        cursor: 'pointer',
                        fontSize: '0.76rem',
                        fontWeight: motivoTroca === opt.id ? 700 : 500,
                        color: motivoTroca === opt.id ? '#1d4ed8' : '#334155'
                      }}
                    >
                      <input
                        type="radio"
                        name="motivoTroca"
                        value={opt.id}
                        checked={motivoTroca === opt.id}
                        onChange={() => setMotivoTroca(opt.id as any)}
                        style={{ accentColor: '#2563eb' }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  Observação Operacional (Opcional)
                </label>
                <textarea
                  value={obsTroca}
                  onChange={(e) => setObsTroca(e.target.value)}
                  placeholder="Ex: Assumindo para resolução imediata de pendência documental antes do fechamento..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.76rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowTrocaModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarTroca}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0a192f',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(10, 25, 47, 0.25)'
                  }}
                >
                  Confirmar Assunção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
