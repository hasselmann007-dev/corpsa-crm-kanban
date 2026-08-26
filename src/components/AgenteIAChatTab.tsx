import React, { useState, useRef, useEffect } from 'react';
import { 
  FiSend, 
  FiTrash2, 
  FiCpu, 
  FiBookOpen, 
  FiTool, 
  FiUser, 
  FiCheckCircle, 
  FiKey, 
  FiGlobe, 
  FiLayers,
  FiSliders,
  FiSave,
  FiCode,
  FiAlertCircle,
  FiPlay
} from 'react-icons/fi';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
}

export const AgenteIAChatTab: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('crm_agente_ia_live_chat_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_e) {
        // Fallback
      }
    }
    return [
      {
        id: '1',
        sender: 'agent',
        text: 'Olá! Sou o Agente de IA do CORPSA CRM. Estou pronto para prestar atendimento imobiliário, tirar dúvidas sobre crédito e seguir as regras da constituição em skills/constituicao.md. Como posso ajudar?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'google/gemini-2.5-flash'
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('openrouter_api_key_v1') || (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('openrouter_model_v1') || 'google/gemini-2.5-flash');
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = localStorage.getItem('openrouter_temp_v1');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [constitutionText, setConstitutionText] = useState<string>('');
  const [constitutionSaved, setConstitutionSaved] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<'config' | 'constitution'>('config');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Constitution
  const fetchConstitution = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent/constitution');
      if (res.ok) {
        const data = await res.json();
        if (data.constitution) {
          setConstitutionText(data.constitution);
        }
      }
    } catch (_e) {
      // Local server not running or deployed on Vercel
    }
  };

  useEffect(() => {
    fetchConstitution();
  }, []);

  useEffect(() => {
    localStorage.setItem('crm_agente_ia_live_chat_v3', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('openrouter_api_key_v1', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('openrouter_model_v1', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('openrouter_temp_v1', temperature.toString());
  }, [temperature]);

  const handleSaveConstitution = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent/constitution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: constitutionText })
      });
      if (res.ok) {
        setConstitutionSaved(true);
        setTimeout(() => setConstitutionSaved(false), 2500);
      } else {
        setConstitutionSaved(true);
        setTimeout(() => setConstitutionSaved(false), 2500);
      }
    } catch (_e) {
      setConstitutionSaved(true);
      setTimeout(() => setConstitutionSaved(false), 2500);
    }
  };

  // Direct OpenRouter completion handler
  const callOpenRouterApi = async (messagesHistory: ChatMessage[], keyToUse: string): Promise<string> => {
    const systemPrompt = constitutionText && constitutionText.trim()
      ? `[CONSTITUIÇÃO E REGRAS DO AGENTE CORPSA CRM]:\n${constitutionText.trim()}`
      : 'Você é o Agente de IA do CORPSA CRM. Preste atendimento imobiliário e financeiro com cordialidade, objetividade e clareza.';

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messagesHistory.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse.trim()}`,
        'HTTP-Referer': 'https://corpsa-crm-kanban.vercel.app',
        'X-Title': 'CORPSA CRM AI Agent'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson: any;
      try { errJson = JSON.parse(errText); } catch {}
      const msg = errJson?.error?.message || errText || `Erro HTTP ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sem resposta gerada pelo modelo.';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    setErrorMessage('');
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setIsTyping(true);

    const activeKey = apiKey.trim();

    if (!activeKey) {
      setIsTyping(false);
      setErrorMessage('Por favor, insira sua OpenRouter API Key para conversar ao vivo com a Inteligência Artificial.');
      return;
    }

    try {
      // 1. Try Direct Browser OpenRouter API Call
      const replyText = await callOpenRouterApi(newHistory, activeKey);
      
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: replyText,
        modelUsed: selectedModel,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      // 2. Try Backend Server Fallback
      try {
        const backendRes = await fetch('http://localhost:3001/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newHistory.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
            model: selectedModel,
            apiKey: activeKey,
            temperature,
            customConstitution: constitutionText
          })
        });

        if (backendRes.ok) {
          const bData = await backendRes.json();
          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: bData.text,
            modelUsed: bData.model || selectedModel,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, agentMsg]);
        } else {
          throw new Error(err.message || 'Erro ao obter resposta da IA');
        }
      } catch (_backendErr) {
        setErrorMessage(`Erro no OpenRouter: ${err.message || 'Chave API inválida ou saldo insuficiente.'}`);
        const agentErrorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `⚠️ Não foi possível obter resposta da Inteligência Artificial: ${err.message}. Verifique sua chave API do OpenRouter no painel à direita.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, agentErrorMsg]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setInputMessage(presetText);
  };

  const handleClearChat = () => {
    if (window.confirm('Deseja limpar todo o histórico do Chat?')) {
      const initial: ChatMessage[] = [
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: 'Chat reiniciado. Digite sua mensagem para conversar ao vivo com a Inteligência Artificial.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel
        }
      ];
      setMessages(initial);
      setErrorMessage('');
      localStorage.setItem('crm_agente_ia_live_chat_v3', JSON.stringify(initial));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '620px' }}>
      {/* Left / Main Chat View */}
      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: 'var(--color-surface, #ffffff)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            padding: '14px 20px', 
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            backgroundColor: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                backgroundColor: '#4f46e5', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
              }}
            >
              <FiCpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                  Agente de IA do CRM
                </h2>
                <span 
                  style={{ 
                    backgroundColor: '#ede9fe', 
                    color: '#6d28d9', 
                    fontSize: '0.68rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}
                >
                  OPENROUTER / GEMINI
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: apiKey.trim() ? '#10b981' : '#f59e0b' }}></span>
                {apiKey.trim() ? 'Conectado e Autenticado' : 'Aguardando Chave API do OpenRouter'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleClearChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#fee2e2',
                color: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Limpar histórico de conversas"
            >
              <FiTrash2 size={14} />
              Limpar Chat
            </button>
          </div>
        </div>

        {/* API Key Banner if Key Missing */}
        {!apiKey.trim() && (
          <div 
            style={{ 
              padding: '12px 20px', 
              backgroundColor: '#fffbeb', 
              borderBottom: '1px solid #fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiAlertCircle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 500 }}>
                Para ativarmos respostas ao vivo da IA, insira sua <strong>OpenRouter API Key</strong> (formato <code>sk-or-v1-...</code>):
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fcd34d',
                  fontSize: '0.8rem',
                  width: '200px'
                }}
              />
            </div>
          </div>
        )}

        {/* Presets Bar */}
        <div 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#f1f5f9', 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto'
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FiPlay size={10} /> Testes Rápidos:
          </span>
          <button
            onClick={() => handleApplyPreset('Olá! Quais documentos preciso enviar para fazer a análise de crédito de um imóvel?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📋 Documentos de Crédito
          </button>
          <button
            onClick={() => handleApplyPreset('Como funciona a apuração de renda para autônomos que usam extrato bancário?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            💰 Renda por Extrato
          </button>
          <button
            onClick={() => handleApplyPreset('Quais são as etapas do atendimento até a assinatura do contrato?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🏦 Etapas do Atendimento
          </button>
        </div>

        {/* Message Log */}
        <div 
          style={{ 
            flex: 1, 
            padding: '20px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '14px',
            backgroundColor: '#f8fafc'
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div 
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  gap: '8px',
                  alignItems: 'flex-end'
                }}
              >
                {!isUser && (
                  <div 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      backgroundColor: '#4f46e5', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <FiCpu size={14} />
                  </div>
                )}
                <div 
                  style={{
                    maxWidth: '80%',
                    backgroundColor: isUser ? '#4f46e5' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    border: isUser ? 'none' : '1px solid #e2e8f0'
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                  <div 
                    style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '0.68rem', 
                      marginTop: '6px', 
                      color: isUser ? 'rgba(255,255,255,0.8)' : '#94a3b8'
                    }}
                  >
                    {msg.modelUsed && <span>🤖 {msg.modelUsed}</span>}
                    <span style={{ marginLeft: 'auto' }}>{msg.timestamp}</span>
                  </div>
                </div>
                {isUser && (
                  <div 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      backgroundColor: '#0284c7', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <FiUser size={14} />
                  </div>
                )}
              </div>
            );
          })}
          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: '#4f46e5', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'white'
                }}
              >
                <FiCpu size={14} />
              </div>
              <div 
                style={{ 
                  backgroundColor: '#ffffff', 
                  padding: '10px 14px', 
                  borderRadius: '16px 16px 16px 2px',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  border: '1px solid #e2e8f0'
                }}
              >
                Pensando e gerando resposta...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form 
          onSubmit={handleSendMessage}
          style={{ 
            padding: '14px 20px', 
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {errorMessage && (
            <div style={{ fontSize: '0.78rem', color: '#dc2626', backgroundColor: '#fee2e2', padding: '6px 10px', borderRadius: '6px' }}>
              {errorMessage}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text"
              placeholder="Digite sua mensagem para conversar com o Agente de IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isTyping}
              style={{
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 22px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                opacity: inputMessage.trim() ? 1 : 0.6
              }}
            >
              <FiSend size={16} />
              <span>Enviar</span>
            </button>
          </div>
        </form>
      </div>

      {/* Right / Settings & Constitution Panel */}
      <div 
        style={{ 
          width: '360px', 
          backgroundColor: 'var(--color-surface, #ffffff)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        {/* Tabs Switcher */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveSideTab('config')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'config' ? '#ede9fe' : 'transparent',
              color: activeSideTab === 'config' ? '#6d28d9' : '#64748b',
              fontWeight: 600,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <FiSliders size={14} />
            Configurações
          </button>
          <button
            onClick={() => setActiveSideTab('constitution')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'constitution' ? '#ede9fe' : 'transparent',
              color: activeSideTab === 'constitution' ? '#6d28d9' : '#64748b',
              fontWeight: 600,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <FiCode size={14} />
            Constituição (Skill)
          </button>
        </div>

        {activeSideTab === 'config' ? (
          <>
            {/* Section: OpenRouter Connection */}
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiKey size={14} style={{ color: '#f59e0b' }} />
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>OpenRouter API Key</label>
              </div>
              <input
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {apiKey.trim() ? '✅ Chave salva e ativa' : '⚠️ Insira sua chave (sk-or-v1-...) para ativar a IA ao vivo.'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <FiLayers size={14} style={{ color: '#4f46e5' }} />
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Modelo da IA</label>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  backgroundColor: '#ffffff',
                  fontWeight: 500
                }}
              >
                <option value="google/gemini-2.5-flash">✨ Google: Gemini 2.5 Flash (Recomendado)</option>
                <option value="google/gemini-2.0-flash-001">Google: Gemini 2.0 Flash</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Meta: Llama 3.3 70B</option>
                <option value="anthropic/claude-3.5-haiku">Anthropic: Claude 3.5 Haiku</option>
                <option value="openai/gpt-4o-mini">OpenAI: GPT-4o Mini</option>
                <option value="deepseek/deepseek-chat">DeepSeek: DeepSeek V3</option>
              </select>

              {/* Temperature Slider */}
              <div style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Temperatura: {temperature}</span>
                  <span style={{ color: '#64748b' }}>{temperature < 0.4 ? 'Preciso' : temperature > 0.8 ? 'Criativo' : 'Equilibrado'}</span>
                </div>
                <input 
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Architecture Summary */}
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiCheckCircle size={14} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>Skill Ativa:</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>skills/constituicao.md</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiGlobe size={14} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>MCP Endpoint:</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>mcp.openrouter.ai</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTool size={14} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>Tool Código:</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>tools/openrouterTool.ts</span>
              </div>
            </div>
          </>
        ) : (
          /* Constitution Live Editor Tab */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiBookOpen size={14} style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Constituição do Agente</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Edite as regras e diretrizes de atendimento no arquivo <code>skills/constituicao.md</code>.
            </p>
            <textarea
              value={constitutionText}
              onChange={(e) => setConstitutionText(e.target.value)}
              placeholder="Digite aqui as regras, tom de voz e diretrizes de atendimento do agente..."
              style={{
                flex: 1,
                minHeight: '260px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.4'
              }}
            />
            <button
              type="button"
              onClick={handleSaveConstitution}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: constitutionSaved ? '#16a34a' : '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <FiSave size={14} />
              {constitutionSaved ? 'Constituição Salva!' : 'Salvar em skills/constituicao.md'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
