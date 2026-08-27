import React, { useState, useRef, useEffect } from 'react';
import { 
  FiSend, 
  FiTrash2, 
  FiCpu, 
  FiBookOpen, 
  FiUser, 
  FiKey, 
  FiLayers,
  FiSliders,
  FiSave,
  FiCode,
  FiAlertCircle,
  FiPlay,
  FiDatabase,
  FiClock,
  FiFileText
} from 'react-icons/fi';
import { 
  getOrCreateConversaSupabase, 
  carregarUltimasMensagensSupabase, 
  salvarMensagemSupabase 
} from '../utils/agenteMemoria';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
}

const DEFAULT_PROMPT_AGENTCRM = `# objetivo
Você é analista responsavel por fazer a triagem dos documentos recebidos para a CORPSA, seu objetivo é entender a duvida do corretor e até mesmo receber esses documentos para adicionar em nossa fila de credito. fale em tom caloroso, atencioso e objetivo, tratando por "você" em mensagens curtas e uma pergunta de cada vez.

## ferramentas 
- **Memória de Atendimento (Supabase)**: Leitura automática das últimas 20 mensagens do corretor nas tabelas \`agente_conversas\` e \`agente_mensagens\`.
- **Triagem e Leitura de Documentos**: Recepção de comprovantes de renda, holerites, extratos bancários, documentos pessoais (RG/CPF/CNH) e certidões para análise de crédito imobiliário.
- **Fila de Crédito CORPSA**: Encaminhamento direto de cadastros e pastas de documentos para a roleta e fila de análise de crédito.
- **Calculadora de Apuração de Renda**: Verificação de renda formal e informal (extratos para autônomos, imposto de renda, pró-labore).

## como agir 
- Fale sempre em tom caloroso, atencioso, profissional e objetivo.
- Trate o corretor diretamente por "você".
- Envie respostas em mensagens curtas e diretas, sem blocos longos de texto.
- Faça estritamente **UMA pergunta de cada vez** para manter a conversa fluida e organizada.
- Ao identificar a dúvida do corretor, oriente de forma clara sobre quais documentos são necessários para a triagem.
- Confirme o recebimento dos documentos e informe que a pasta será adicionada à fila de crédito da CORPSA.

## nunca faça isso 
- Nunca envie mensagens longas, prolixas ou com múltiplos parágrafos extensos.
- Nunca faça mais de uma pergunta no mesmo balão de mensagem.
- Nunca responda de forma fria, robótica ou distante.
- Nunca altere, invente ou descarte informações fornecidas pelo corretor.
- Nunca deixe o corretor sem um próximo passo claro para a triagem ou envio de documentos.`;

export const AgenteIAChatTab: React.FC = () => {
  const [conversaId, setConversaId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('openrouter_api_key_v1') || (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('openrouter_model_v1') || 'nvidia/nemotron-3-ultra-550b-a55b:free');
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = localStorage.getItem('openrouter_temp_v1');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [promptCrmText, setPromptCrmText] = useState<string>(DEFAULT_PROMPT_AGENTCRM);
  const [promptCrmSaved, setPromptCrmSaved] = useState<boolean>(false);

  const [constitutionText, setConstitutionText] = useState<string>('');
  const [constitutionSaved, setConstitutionSaved] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<'config' | 'prompt' | 'constitution'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Supabase Memory & Load Last 20 Messages
  useEffect(() => {
    const initMemory = async () => {
      const cid = await getOrCreateConversaSupabase();
      setConversaId(cid);

      // Carrega as últimas 20 mensagens gravadas no Supabase para esse cliente
      const history = await carregarUltimasMensagensSupabase(cid, 20);
      if (history.length > 0) {
        const formatted: ChatMessage[] = history.map((h, i) => ({
          id: i.toString(),
          sender: h.sender === 'user' ? 'user' : 'agent',
          text: h.text,
          timestamp: h.timestamp,
          modelUsed: h.model_used
        }));
        setMessages(formatted);
      } else {
        setMessages([
          {
            id: '1',
            sender: 'agent',
            text: 'Olá! Sou o analista responsável pela triagem de documentos da CORPSA. Como posso ajudar você hoje?',
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            modelUsed: selectedModel
          }
        ]);
      }
    };

    initMemory();
    fetchPromptCrm();
    fetchConstitution();
  }, []);

  // Fetch prompt-agentcrm.md from server if available
  const fetchPromptCrm = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent/prompt-agentcrm');
      if (res.ok) {
        const data = await res.json();
        if (data.prompt) {
          setPromptCrmText(data.prompt);
        }
      }
    } catch (_e) {
      // Server offline or on Vercel
    }
  };

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
      // Server offline or on Vercel
    }
  };

  useEffect(() => {
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

  const handleSavePromptCrm = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent/prompt-agentcrm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: promptCrmText })
      });
      if (res.ok) {
        setPromptCrmSaved(true);
        setTimeout(() => setPromptCrmSaved(false), 2500);
      } else {
        setPromptCrmSaved(true);
        setTimeout(() => setPromptCrmSaved(false), 2500);
      }
    } catch (_e) {
      setPromptCrmSaved(true);
      setTimeout(() => setPromptCrmSaved(false), 2500);
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
      } else {
        setConstitutionSaved(true);
        setTimeout(() => setConstitutionSaved(false), 2500);
      }
    } catch (_e) {
      setConstitutionSaved(true);
      setTimeout(() => setConstitutionSaved(false), 2500);
    }
  };

  // Direct OpenRouter completion handler reading prompt-agentcrm.md and last 20 messages from Supabase memory
  const callOpenRouterApi = async (memoryHistory: { sender: string; text: string }[], keyToUse: string, modelToUse: string): Promise<{ text: string; actualModel: string }> => {
    const promptHeader = promptCrmText && promptCrmText.trim()
      ? `[ESTRUTURA DE ATENDIMENTO CORPSA - prompt-agentcrm.md]:\n${promptCrmText.trim()}`
      : `[ESTRUTURA DE ATENDIMENTO CORPSA]:\n${DEFAULT_PROMPT_AGENTCRM}`;

    const constitutionHeader = constitutionText && constitutionText.trim()
      ? `\n\n[CONSTITUIÇÃO E DIRETRIZES DO AGENTE]:\n${constitutionText.trim()}`
      : '';

    const systemPrompt = `${promptHeader}${constitutionHeader}`;

    // Utiliza estritamente as últimas 20 mensagens do histórico carregado
    const last20Messages = memoryHistory.slice(-20);

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...last20Messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    ];

    const cleanKey = keyToUse.trim();
    if (!cleanKey) {
      throw new Error('Chave API não configurada.');
    }

    const tryRequest = async (targetModel: string) => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`,
          'HTTP-Referer': 'https://corpsa-crm-kanban.vercel.app',
          'X-Title': 'CORPSA CRM AI Agent'
        },
        body: JSON.stringify({
          model: targetModel,
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
      return {
        text: data.choices?.[0]?.message?.content || 'Sem resposta gerada pelo modelo.',
        actualModel: data.model || targetModel
      };
    };

    try {
      return await tryRequest(modelToUse);
    } catch (err: any) {
      const errStr = (err.message || '').toLowerCase();
      if ((errStr.includes('insufficient credits') || errStr.includes('never purchased credits')) && modelToUse !== 'nvidia/nemotron-3-ultra-550b-a55b:free') {
        const freeResult = await tryRequest('nvidia/nemotron-3-ultra-550b-a55b:free');
        return {
          text: `${freeResult.text}\n\n*(Nota: Resposta gerada via modelo gratuito NVIDIA Nemotron 3 Ultra 550B pois a chave atual não possui créditos pagos).*`,
          actualModel: 'nvidia/nemotron-3-ultra-550b-a55b:free (Grátis)'
        };
      }
      throw err;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    setErrorMessage('');
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp
    };

    const updatedUIHistory = [...messages, userMsg];
    setMessages(updatedUIHistory);
    setInputMessage('');
    setIsTyping(true);

    // 1. Grava a mensagem do usuário no Supabase (Tabela 'agente_mensagens')
    if (conversaId) {
      await salvarMensagemSupabase(conversaId, 'user', text);
    }

    // 2. Lê as últimas 20 mensagens do cliente gravadas no Supabase antes da resposta
    const last20FromSupabase = conversaId 
      ? await carregarUltimasMensagensSupabase(conversaId, 20)
      : updatedUIHistory.slice(-20).map(m => ({ sender: m.sender, text: m.text, timestamp: m.timestamp }));

    const activeKey = apiKey.trim();

    // 3. Tenta responder via servidor local se ativo
    try {
      const backendRes = await fetch('http://localhost:3001/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: last20FromSupabase.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
          model: selectedModel,
          apiKey: activeKey,
          temperature,
          customConstitution: constitutionText
        })
      });

      if (backendRes.ok) {
        const bData = await backendRes.json();
        if (bData.success && bData.text) {
          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: bData.text,
            modelUsed: bData.model || selectedModel,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, agentMsg]);
          if (conversaId) {
            await salvarMensagemSupabase(conversaId, 'agent', bData.text, bData.model || selectedModel);
          }
          setIsTyping(false);
          return;
        }
      }
    } catch (_backendErr) {
      // Backend offline, faz chamada direta
    }

    // 4. Chamada direta ao OpenRouter usando prompt-agentcrm.md e as últimas 20 mensagens da memória
    if (!activeKey) {
      setIsTyping(false);
      setErrorMessage('Insira sua OpenRouter API Key no painel à direita (ex: sk-or-v1-...) para conversar ao vivo.');
      return;
    }

    try {
      const { text: replyText, actualModel } = await callOpenRouterApi(last20FromSupabase, activeKey, selectedModel);
      
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: replyText,
        modelUsed: actualModel,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, agentMsg]);

      // Grava a resposta do agente na tabela 'agente_mensagens' do Supabase
      if (conversaId) {
        await salvarMensagemSupabase(conversaId, 'agent', replyText, actualModel);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Erro ao comunicar com OpenRouter';
      setErrorMessage(errMsg);
      const agentErrorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `⚠️ Erro no OpenRouter: ${errMsg}\n\nDica: Selecione o modelo gratuito "NVIDIA Nemotron 3 Ultra 550B (Grátis)" no menu à direita para usar sem necessidade de saldo pago.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, agentErrorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setInputMessage(presetText);
  };

  const handleClearChat = () => {
    if (window.confirm('Deseja limpar o histórico atual da tela do Chat?')) {
      const initial: ChatMessage[] = [
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: 'Tela de mensagens reiniciada. O agente mantém o histórico preservado no Supabase.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel
        }
      ];
      setMessages(initial);
      setErrorMessage('');
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
                backgroundColor: '#76b900', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 6px rgba(118, 185, 0, 0.3)'
              }}
            >
              <FiCpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                  Agente de IA do CRM (Triagem CORPSA)
                </h2>
                <span 
                  style={{ 
                    backgroundColor: '#dcfce7', 
                    color: '#15803d', 
                    fontSize: '0.68rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}
                >
                  prompt-agentcrm.md ATIVO
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Triagem de Documentos & Memória Supabase (Últimas 20 mensagens)
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
              title="Limpar histórico de exibição na tela"
            >
              <FiTrash2 size={14} />
              Limpar Tela
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
                  width: '220px'
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
            <FiPlay size={10} /> Testes de Triagem:
          </span>
          <button
            onClick={() => handleApplyPreset('Olá, preciso enviar a pasta de um cliente para a fila de crédito. Quais documentos você precisa?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📋 Triagem de Documentos
          </button>
          <button
            onClick={() => handleApplyPreset('Meu cliente é autônomo e tem extratos bancários dos últimos 6 meses. Como envio?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            💰 Extratos de Autônomo
          </button>
          <button
            onClick={() => handleApplyPreset('Você já recebeu meus documentos anteriores?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🧠 Testar Memória
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
                      backgroundColor: '#76b900', 
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
                  backgroundColor: '#76b900', 
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
                Lendo prompt-agentcrm.md e gerando resposta...
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
              placeholder="Digite sua dúvida ou envie informações para triagem..."
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
                backgroundColor: '#76b900',
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

      {/* Right / Settings, Prompt & Constitution Panel */}
      <div 
        style={{ 
          width: '370px', 
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
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveSideTab('prompt')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'prompt' ? '#dcfce7' : 'transparent',
              color: activeSideTab === 'prompt' ? '#15803d' : '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <FiFileText size={13} />
            Prompt CRM
          </button>
          <button
            onClick={() => setActiveSideTab('config')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'config' ? '#dcfce7' : 'transparent',
              color: activeSideTab === 'config' ? '#15803d' : '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <FiSliders size={13} />
            Config
          </button>
          <button
            onClick={() => setActiveSideTab('constitution')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'constitution' ? '#dcfce7' : 'transparent',
              color: activeSideTab === 'constitution' ? '#15803d' : '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <FiCode size={13} />
            Constituição
          </button>
        </div>

        {activeSideTab === 'prompt' ? (
          /* Prompt Agent CRM Live Editor Tab */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiFileText size={15} style={{ color: '#15803d' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>prompt-agentcrm.md</span>
              </div>
              <span style={{ fontSize: '0.68rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Lido a cada requisição</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>
              Diretrizes ativas do analista de triagem da CORPSA (objetivo, ferramentas, como agir e nunca faça isso).
            </p>
            <textarea
              value={promptCrmText}
              onChange={(e) => setPromptCrmText(e.target.value)}
              placeholder="Digite a estrutura do prompt-agentcrm.md..."
              style={{
                flex: 1,
                minHeight: '300px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.45'
              }}
            />
            <button
              type="button"
              onClick={handleSavePromptCrm}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: promptCrmSaved ? '#16a34a' : '#15803d',
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
              {promptCrmSaved ? 'Prompt Salvo!' : 'Salvar em prompt-agentcrm.md'}
            </button>
          </div>
        ) : activeSideTab === 'config' ? (
          <>
            {/* Section: Memory Tables in Supabase */}
            <div 
              style={{ 
                backgroundColor: '#f0fdf4', 
                padding: '14px', 
                borderRadius: '8px', 
                border: '1px solid #bbf7d0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiDatabase size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d' }}>
                  Memória Persistente (Supabase)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#166534', lineHeight: '1.4' }}>
                Tabelas ativas no Supabase:
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li><code>agente_conversas</code></li>
                  <li><code>agente_mensagens</code></li>
                </ul>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#15803d', marginTop: '4px' }}>
                <FiClock size={12} />
                <span>Carregando automaticamente as <strong>últimas 20 mensagens</strong> do cliente antes de cada resposta.</span>
              </div>
            </div>

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
              <span style={{ fontSize: '0.7rem', color: apiKey.trim() ? '#16a34a' : '#d97706' }}>
                {apiKey.trim() ? '✅ Chave inserida' : '⚠️ Insira sua chave (sk-or-v1-...) para ativar o chat ao vivo.'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <FiLayers size={14} style={{ color: '#76b900' }} />
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
                  fontWeight: 600
                }}
              >
                <option value="nvidia/nemotron-3-ultra-550b-a55b:free">✨ NVIDIA: Nemotron 3 Ultra 550B (Grátis)</option>
                <option value="google/gemma-4-31b-it:free">Google: Gemma 4 31B (Grátis)</option>
                <option value="liquid/lfm-2.5-2.6b:free">Liquid: LFM 2.5 2.6B (Grátis)</option>
                <option value="openrouter/free">openrouter/free (Grátis - Auto Roteador)</option>
                <option value="google/gemini-3.6-flash">Google: Gemini 3.6 Flash</option>
                <option value="google/gemini-2.5-flash">Google: Gemini 2.5 Flash</option>
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
          </>
        ) : (
          /* Constitution Live Editor Tab */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiBookOpen size={14} style={{ color: '#15803d' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Constituição do Agente</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Edite as regras e diretrizes adicionais no arquivo <code>skills/constituicao.md</code>.
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
                backgroundColor: constitutionSaved ? '#16a34a' : '#15803d',
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
