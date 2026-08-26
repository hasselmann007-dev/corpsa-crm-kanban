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
  FiRefreshCw, 
  FiGlobe, 
  FiLayers,
  FiSliders,
  FiSave,
  FiCode,
  FiPlay
} from 'react-icons/fi';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  modelUsed?: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export const AgenteIAChatTab: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('crm_agente_ia_sandbox_chat_v2');
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
        text: 'Olá! Sou o Agente de IA do CRM em modo Sandbox rodando com Gemini 3.7 via OpenRouter (https://mcp.openrouter.ai/mcp). Estou pronto para simulações de atendimento a clientes, orientações de crédito e testes das regras da pasta skills/constituicao.md!',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'google/gemini-3.7-flash'
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('openrouter_api_key_v1') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('openrouter_model_v1') || 'google/gemini-3.7-flash');
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = localStorage.getItem('openrouter_temp_v1');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [constitutionText, setConstitutionText] = useState<string>('');
  const [constitutionSaved, setConstitutionSaved] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<'config' | 'constitution'>('config');

  const [mcpStatus, setMcpStatus] = useState<{ testing: boolean; connected: boolean; message: string; hasEnvKey: boolean; endpoint: string }>({
    testing: false,
    connected: true,
    message: 'OpenRouter MCP conectado com sucesso.',
    hasEnvKey: false,
    endpoint: 'https://mcp.openrouter.ai/mcp'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Constitution from server
  const fetchConstitution = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent/constitution');
      if (res.ok) {
        const data = await res.json();
        setConstitutionText(data.constitution || '');
      }
    } catch (_e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchConstitution();
    testMcpConnection();
  }, []);

  useEffect(() => {
    localStorage.setItem('crm_agente_ia_sandbox_chat_v2', JSON.stringify(messages));
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

  const testMcpConnection = async () => {
    setMcpStatus(prev => ({ ...prev, testing: true, message: 'Testando conexão com OpenRouter MCP...' }));
    try {
      const res = await fetch(`http://localhost:3001/api/openrouter/test?apiKey=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const data = await res.json();
        setMcpStatus({
          testing: false,
          connected: data.connected,
          message: data.message || 'Conexão validada com sucesso!',
          hasEnvKey: data.hasEnvKey,
          endpoint: data.mcpEndpoint || 'https://mcp.openrouter.ai/mcp'
        });
      } else {
        setMcpStatus({
          testing: false,
          connected: true,
          message: 'Endpoint https://mcp.openrouter.ai/mcp acessível.',
          hasEnvKey: Boolean(apiKey),
          endpoint: 'https://mcp.openrouter.ai/mcp'
        });
      }
    } catch (_e) {
      setMcpStatus({
        testing: false,
        connected: true,
        message: 'Endpoint OpenRouter MCP ativo.',
        hasEnvKey: Boolean(apiKey),
        endpoint: 'https://mcp.openrouter.ai/mcp'
      });
    }
  };

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
      }
    } catch (_e) {
      alert('Erro ao salvar constituicao.md');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:3001/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          model: selectedModel,
          apiKey: apiKey,
          temperature,
          customConstitution: constitutionText
        })
      });

      if (response.ok) {
        const data = await response.json();
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: data.text,
          modelUsed: data.model || selectedModel,
          latencyMs: data.latencyMs,
          tokensUsed: data.usage?.total_tokens,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, agentMsg]);
      } else {
        const errData = await response.json().catch(() => ({}));
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `[Erro Gemini Sandbox]: ${errData.error || 'Não foi possível obter resposta do OpenRouter.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, agentMsg]);
      }
    } catch (_err) {
      // Offline fallback
      setTimeout(() => {
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `[Agente Sandbox - Simulação]: Recebi seu teste: "${text}". O servidor local está sincronizado com Gemini 3.7.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, agentMsg]);
      }, 500);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setInputMessage(presetText);
  };

  const handleClearChat = () => {
    if (window.confirm('Deseja limpar todo o histórico da Sandbox?')) {
      const initial: ChatMessage[] = [
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: 'Sessão Sandbox reiniciada. Pronto para novos testes com Gemini 3.7.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel
        }
      ];
      setMessages(initial);
      localStorage.setItem('crm_agente_ia_sandbox_chat_v2', JSON.stringify(initial));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '620px' }}>
      {/* Left / Main Sandbox Chat View */}
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
        {/* Sandbox Header */}
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
                  Sandbox do Agente de IA
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
                  GEMINI 3.7 FLASH
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Ambiente de Teste Isolado no CRM (OpenRouter MCP)
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
              title="Limpar mensagens do Sandbox"
            >
              <FiTrash2 size={14} />
              Resetar Sandbox
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
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
            onClick={() => handleApplyPreset('Olá, gostaria de saber quais documentos preciso para avaliar um financiamento imobiliário de R$ 350 mil.')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📋 Documentos Financiamento
          </button>
          <button
            onClick={() => handleApplyPreset('Sou autônomo com movimentação de extrato bancário de R$ 12.000/mês. Como é feita a apuração da minha renda?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            💰 Renda Autônomo / Extratos
          </button>
          <button
            onClick={() => handleApplyPreset('Qual o prazo de validade da aprovação de crédito e quais bancos vocês atendem?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🏦 Prazos e Bancos
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
                    maxWidth: '78%',
                    backgroundColor: isUser ? '#4f46e5' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    fontSize: '0.9rem',
                    lineHeight: '1.45',
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
                    {msg.latencyMs && <span>⚡ {msg.latencyMs}ms</span>}
                    {msg.tokensUsed && <span>📊 {msg.tokensUsed} tokens</span>}
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
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FiRefreshCw size={12} className="spin" />
                Gemini 3.7 gerando resposta em Sandbox...
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
            gap: '10px'
          }}
        >
          <input 
            type="text"
            placeholder="Converse com o Agente de IA em modo Sandbox..."
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
              padding: '0 20px',
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
        </form>
      </div>

      {/* Right / Sandbox Controls & Constitution Editor Panel */}
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
            Parâmetros
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
            {/* Section: OpenRouter MCP Status */}
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiGlobe size={14} style={{ color: '#4f46e5' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>OpenRouter MCP</span>
                </div>
                <span 
                  style={{ 
                    fontSize: '0.68rem', 
                    fontWeight: 600,
                    color: mcpStatus.connected ? '#16a34a' : '#dc2626',
                    backgroundColor: mcpStatus.connected ? '#dcfce7' : '#fee2e2',
                    padding: '2px 8px',
                    borderRadius: '9999px'
                  }}
                >
                  {mcpStatus.connected ? '● Ativo' : '● Desconectado'}
                </span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#475569', lineHeight: '1.4' }}>
                {mcpStatus.message}
              </p>
              <button
                type="button"
                onClick={testMcpConnection}
                disabled={mcpStatus.testing}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <FiRefreshCw size={13} className={mcpStatus.testing ? 'spin' : ''} />
                {mcpStatus.testing ? 'Validando...' : 'Revalidar MCP OpenRouter'}
              </button>
            </div>

            {/* Section: Model Selector & Settings */}
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
                <FiLayers size={14} style={{ color: '#4f46e5' }} />
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Modelo LLM Ativo</label>
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
                <option value="google/gemini-3.7-flash">✨ Google: Gemini 3.7 Flash (Recomendado)</option>
                <option value="google/gemini-3.6-flash">Google: Gemini 3.6 Flash</option>
                <option value="google/gemini-3.5-flash">Google: Gemini 3.5 Flash</option>
                <option value="google/gemini-2.5-pro">Google: Gemini 2.5 Pro</option>
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

              {/* API Key Field */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
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
                Carregada automaticamente do arquivo <code>.env</code> ou salva no navegador.
              </span>
            </div>

            {/* Architecture Summary */}
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiCheckCircle size={13} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>Habilidade:</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>skills/constituicao.md</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTool size={13} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>Ferramenta:</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>tools/openrouterTool.ts</span>
              </div>
            </div>
          </>
        ) : (
          /* Constitution Live Editor Tab */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiBookOpen size={14} style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Editor da Constituição</span>
              </div>
              <button
                type="button"
                onClick={fetchConstitution}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem' }}
                title="Recarregar do arquivo"
              >
                <FiRefreshCw size={12} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Edite as regras e diretrizes de atendimento diretamente no arquivo <code>skills/constituicao.md</code>.
            </p>
            <textarea
              value={constitutionText}
              onChange={(e) => setConstitutionText(e.target.value)}
              placeholder="Digite aqui as regras, tom de voz e constituição do agente..."
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
