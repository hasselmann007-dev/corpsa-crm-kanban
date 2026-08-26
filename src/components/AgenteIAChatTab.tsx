import React, { useState, useRef, useEffect } from 'react';
import { 
  FiSend, 
  FiTrash2, 
  FiCpu, 
  FiBookOpen, 
  FiTool, 
  FiMessageSquare, 
  FiInfo,
  FiUser,
  FiCheckCircle
} from 'react-icons/fi';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export const AgenteIAChatTab: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('crm_agente_ia_test_chat_v1');
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
        text: 'Olá! Sou o Agente de IA do CRM em modo de teste no navegador. Por enquanto não tenho ferramentas ou memória complexa carregada, mas estou pronto para receber as instruções da pasta skills/ e ferramentas na pasta tools/. Como posso ajudar no teste inicial?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('crm_agente_ia_test_chat_v1', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
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

    // Simulated agent response based on clean baseline state
    setTimeout(() => {
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `[Agente CRM - Modo Teste]: Recebi sua mensagem: "${text}". Conforme configuramos a 'skills/constituicao.md' e as ferramentas em 'tools/', vou aprimorar minhas respostas e ações para o atendimento!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, agentMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleClearChat = () => {
    if (window.confirm('Deseja limpar todo o histórico de teste do Agente?')) {
      const initial: ChatMessage[] = [
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: 'Chat de teste reiniciado. O Agente está pronto para novas mensagens de teste.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ];
      setMessages(initial);
      localStorage.setItem('crm_agente_ia_test_chat_v1', JSON.stringify(initial));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '600px' }}>
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
            padding: '16px 20px', 
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
                width: '36px', 
                height: '36px', 
                borderRadius: '10px', 
                backgroundColor: '#6366f1', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <FiCpu size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>
                Agente de IA (Atendimento CRM)
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Ambiente de Teste no Navegador
              </span>
            </div>
          </div>

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
              fontWeight: 500,
              cursor: 'pointer'
            }}
            title="Limpar histórico de teste"
          >
            <FiTrash2 size={14} />
            Limpar Chat
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
            backgroundColor: '#f1f5f9'
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
                      backgroundColor: '#6366f1', 
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
                    maxWidth: '75%',
                    backgroundColor: isUser ? '#6366f1' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                  <span 
                    style={{ 
                      display: 'block', 
                      fontSize: '0.68rem', 
                      marginTop: '4px', 
                      textAlign: 'right',
                      color: isUser ? 'rgba(255,255,255,0.8)' : '#94a3b8'
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
                {isUser && (
                  <div 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      backgroundColor: '#3b82f6', 
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
                  backgroundColor: '#6366f1', 
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
                  fontSize: '0.85rem'
                }}
              >
                Digitando...
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
            placeholder="Digite uma mensagem de teste para o Agente de IA..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 16px',
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
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0 18px',
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

      {/* Right / Architecture & Skills Overview Panel */}
      <div 
        style={{ 
          width: '320px', 
          backgroundColor: 'var(--color-surface, #ffffff)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiInfo size={18} style={{ color: '#6366f1' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
            Estrutura do Agente
          </h3>
        </div>

        {/* Section: Skills */}
        <div 
          style={{ 
            backgroundColor: '#f8fafc', 
            padding: '14px', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <FiBookOpen size={16} style={{ color: '#0284c7' }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
              Pasta `skills/` (Instruções)
            </h4>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#64748b' }}>
            Arquivos .md que dizem ao agente COMO agir e as diretrizes de atendimento.
          </p>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 10px', 
              backgroundColor: '#ffffff', 
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              color: '#334155'
            }}
          >
            <FiCheckCircle size={12} style={{ color: '#10b981' }} />
            <span><code>skills/constituicao.md</code></span>
          </div>
        </div>

        {/* Section: Tools */}
        <div 
          style={{ 
            backgroundColor: '#f8fafc', 
            padding: '14px', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <FiTool size={16} style={{ color: '#f59e0b' }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
              Pasta `tools/` (Ações)
            </h4>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#64748b' }}>
            Código das ações que o agente executa sozinho (ex: criar lead, consultar CRM).
          </p>
          <div 
            style={{ 
              padding: '8px 10px', 
              backgroundColor: '#fffbeb', 
              borderRadius: '6px',
              border: '1px dashed #fcd34d',
              fontSize: '0.75rem',
              color: '#92400e'
            }}
          >
            Nenhuma ferramenta adicionada ainda (pasta vazia conforme planejado).
          </div>
        </div>

        {/* Section: Guidance */}
        <div 
          style={{ 
            backgroundColor: '#f0fdf4', 
            padding: '14px', 
            borderRadius: '8px', 
            border: '1px solid #bbf7d0' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <FiMessageSquare size={16} style={{ color: '#16a34a' }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
              Fase Atual
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#166534', lineHeight: '1.4' }}>
            O agente roda no chat de teste no navegador. Você pode adicionar regras em <code>skills/constituicao.md</code> ou novas ferramentas em <code>tools/</code> aos poucos.
          </p>
        </div>
      </div>
    </div>
  );
};
