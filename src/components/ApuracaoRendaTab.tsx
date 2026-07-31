import React, { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiSearch, 
  FiPaperclip, 
  FiTrash2, 
  FiSend, 
  FiCheckCircle, 
  FiDownload, 
  FiXCircle
} from 'react-icons/fi';

export interface ApuracaoArquivo {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

export interface ApuracaoMensagem {
  id: string;
  sender: 'user' | 'system' | 'ai';
  text: string;
  timestamp: string;
}

export interface ApuracaoSessao {
  id: string;
  nomeCliente: string;
  cpfCliente: string;
  status: 'Em Análise' | 'Concluída' | 'Pendente de Doc';
  dataCriacao: string;
  arquivos: ApuracaoArquivo[];
  regrasConsiderar: string;
  regrasDesconsiderar: string;
  rendaBruta: number;
  rendaLiquida: number;
  descontosDesconsiderados: number;
  capacidadePagamento: number;
  mensagens: ApuracaoMensagem[];
}

const STORAGE_KEY = 'crm_apuracoes_renda_v1';

// Initial Mock Sessions for immediate rich experience
const INITIAL_MOCK_SESSIONS: ApuracaoSessao[] = [
  {
    id: 'ap-1',
    nomeCliente: 'DANILO HASSELMANN',
    cpfCliente: '123.456.789-09',
    status: 'Concluída',
    dataCriacao: '2026-07-30T14:20:00.000Z',
    arquivos: [
      { id: 'f-1', name: 'Holerite_Maio_2026.pdf', size: '1.2 MB', type: 'PDF', uploadedAt: '30/07/2026 14:20' },
      { id: 'f-2', name: 'Extrato_Bancario_3Meses.pdf', size: '2.8 MB', type: 'PDF', uploadedAt: '30/07/2026 14:21' }
    ],
    regrasConsiderar: 'Salário Base (R$ 8.500), Comissão recorrente média (R$ 1.200).',
    regrasDesconsiderar: 'Desconsiderar Horas Extras eventuais e 1/3 de férias pago em Maio.',
    rendaBruta: 9700,
    rendaLiquida: 8200,
    descontosDesconsiderados: 450,
    capacidadePagamento: 2460,
    mensagens: [
      {
        id: 'm-1',
        sender: 'system',
        text: 'Sessão de apuração de renda iniciada para o cliente DANILO HASSELMANN.',
        timestamp: '30/07 14:20'
      },
      {
        id: 'm-2',
        sender: 'user',
        text: 'Anexei os holerites e o extrato bancário. Favor desconsiderar as horas extras de Maio.',
        timestamp: '30/07 14:22'
      },
      {
        id: 'm-3',
        sender: 'ai',
        text: 'Leitura concluída. Extraída renda bruta nominal de R$ 9.700. Foram desconsideradas R$ 450 em horas extras conforme instrução. Renda líquida aprovável fixada em R$ 8.200 (Capacidade de parcela: R$ 2.460/mês).',
        timestamp: '30/07 14:23'
      }
    ]
  },
  {
    id: 'ap-2',
    nomeCliente: 'PAOLA DE ANDRADE GOMES',
    cpfCliente: '058.554.656-83',
    status: 'Em Análise',
    dataCriacao: '2026-07-31T09:15:00.000Z',
    arquivos: [
      { id: 'f-3', name: 'IRPF_2026_Recibo.pdf', size: '850 KB', type: 'PDF', uploadedAt: '31/07/2026 09:15' }
    ],
    regrasConsiderar: 'Pró-labore mensal regular de R$ 12.000.',
    regrasDesconsiderar: 'Desconsiderar distribuição de lucros variável não recorrente.',
    rendaBruta: 12000,
    rendaLiquida: 10400,
    descontosDesconsiderados: 0,
    capacidadePagamento: 3120,
    mensagens: [
      {
        id: 'm-4',
        sender: 'system',
        text: 'Sessão de apuração de renda iniciada para a cliente PAOLA DE ANDRADE GOMES.',
        timestamp: '31/07 09:15'
      },
      {
        id: 'm-5',
        sender: 'user',
        text: 'Favor considerar apenas o Pró-labore fixo e ignorar a distribuição de lucros do IRPF.',
        timestamp: '31/07 09:18'
      }
    ]
  }
];

export const ApuracaoRendaTab: React.FC = () => {
  const [sessoes, setSessoes] = useState<ApuracaoSessao[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_MOCK_SESSIONS;
    } catch {
      return INITIAL_MOCK_SESSIONS;
    }
  });

  const [selectedSessaoId, setSelectedSessaoId] = useState<string>(() => {
    return sessoes[0]?.id || '';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCpf, setNewCpf] = useState('');
  const [inputMensagem, setInputMensagem] = useState('');

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessoes));
  }, [sessoes]);

  const activeSessao = sessoes.find(s => s.id === selectedSessaoId) || sessoes[0];

  // Filtered Sessions
  const filteredSessoes = sessoes.filter(s => 
    s.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cpfCliente.includes(searchTerm) ||
    s.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create New Session
  const handleCreateSessao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) return;

    const newSessao: ApuracaoSessao = {
      id: `ap-${Date.now()}`,
      nomeCliente: newNome.trim().toUpperCase(),
      cpfCliente: newCpf.trim() || 'Não informado',
      status: 'Em Análise',
      dataCriacao: new Date().toISOString(),
      arquivos: [],
      regrasConsiderar: '',
      regrasDesconsiderar: '',
      rendaBruta: 0,
      rendaLiquida: 0,
      descontosDesconsiderados: 0,
      capacidadePagamento: 0,
      mensagens: [
        {
          id: `m-${Date.now()}`,
          sender: 'system',
          text: `Sessão de apuração de renda criada para ${newNome.trim().toUpperCase()}. Anexe os documentos e defina as instruções.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setSessoes(prev => [newSessao, ...prev]);
    setSelectedSessaoId(newSessao.id);
    setNewNome('');
    setNewCpf('');
    setShowNewModal(false);
  };

  // Update Consideration Rules
  const handleUpdateRegras = (field: 'regrasConsiderar' | 'regrasDesconsiderar', val: string) => {
    if (!activeSessao) return;
    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        return { ...s, [field]: val };
      }
      return s;
    }));
  };

  // Handle File Upload Simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeSessao) return;
    const filesArray = Array.from(e.target.files);
    
    const newDocs: ApuracaoArquivo[] = filesArray.map((f, idx) => ({
      id: `f-${Date.now()}-${idx}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      type: f.name.endsWith('.pdf') ? 'PDF' : f.name.endsWith('.png') || f.name.endsWith('.jpg') ? 'Imagem' : 'Documento',
      uploadedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }));

    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        return {
          ...s,
          arquivos: [...s.arquivos, ...newDocs],
          mensagens: [
            ...s.mensagens,
            {
              id: `m-doc-${Date.now()}`,
              sender: 'system',
              text: `Anexado(s) ${newDocs.length} novo(s) documento(s): ${newDocs.map(d => d.name).join(', ')}.`,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return s;
    }));
    e.target.value = '';
  };

  // Remove File
  const handleRemoveFile = (fileId: string) => {
    if (!activeSessao) return;
    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        return {
          ...s,
          arquivos: s.arquivos.filter(f => f.id !== fileId)
        };
      }
      return s;
    }));
  };

  // Send Message in Conversation Thread
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMensagem.trim() || !activeSessao) return;

    const userText = inputMensagem.trim();
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const userMsg: ApuracaoMensagem = {
      id: `m-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: nowTime
    };

    // Calculate intelligent mock simulation updates based on input
    let newBruta = activeSessao.rendaBruta || 7500;
    let newLiquida = activeSessao.rendaLiquida || 6200;
    let newDescontos = activeSessao.descontosDesconsiderados || 350;

    if (userText.toLowerCase().includes('desconsiderar') || userText.toLowerCase().includes('ignorar')) {
      newDescontos += 300;
      newLiquida += 300;
    }
    if (userText.toLowerCase().includes('comissão') || userText.toLowerCase().includes('adicionar')) {
      newBruta += 1000;
      newLiquida += 800;
    }
    const newCapacidade = Math.round(newLiquida * 0.30);

    const aiMsg: ApuracaoMensagem = {
      id: `m-ai-${Date.now()}`,
      sender: 'ai',
      text: `Instrução processada: "${userText}". Apuração recalculada com sucesso: Renda Bruta R$ ${newBruta.toLocaleString('pt-BR')}, Renda Líquida Aprovável R$ ${newLiquida.toLocaleString('pt-BR')} (Margem 30%: R$ ${newCapacidade.toLocaleString('pt-BR')}/mês).`,
      timestamp: nowTime
    };

    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        return {
          ...s,
          rendaBruta: newBruta,
          rendaLiquida: newLiquida,
          descontosDesconsiderados: newDescontos,
          capacidadePagamento: newCapacidade,
          status: 'Concluída',
          mensagens: [...s.mensagens, userMsg, aiMsg]
        };
      }
      return s;
    }));

    setInputMensagem('');
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '650px' }}>
      
      {/* LEFT COLUMN: Searchable History */}
      <div 
        style={{ 
          width: '340px', 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
      >
        {/* Header & Search */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-dark)' }}>
              Histórico de Apurações
            </h3>
            <button 
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', gap: '4px' }}
              onClick={() => setShowNewModal(true)}
            >
              <FiPlus size={14} />
              Nova
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <FiSearch size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Buscar por cliente, CPF ou status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                fontSize: '0.825rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                outline: 'none',
                backgroundColor: 'white'
              }}
            />
          </div>
        </div>

        {/* Sessions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {filteredSessoes.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Nenhuma apuração encontrada.
            </div>
          ) : (
            filteredSessoes.map(sessao => {
              const isSelected = sessao.id === activeSessao?.id;
              return (
                <div 
                  key={sessao.id}
                  onClick={() => setSelectedSessaoId(sessao.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    marginBottom: '8px',
                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.05)',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.04)' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-dark)' }}>
                      {sessao.nomeCliente}
                    </span>
                    <span 
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: sessao.status === 'Concluída' ? '#dcfce7' : '#fef3c7',
                        color: sessao.status === 'Concluída' ? '#15803d' : '#b45309'
                      }}
                    >
                      {sessao.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span>CPF: {sessao.cpfCliente}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px dashed #f1f5f9', paddingTop: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiPaperclip size={12} /> {sessao.arquivos.length} doc(s)
                    </span>
                    {sessao.rendaLiquida > 0 && (
                      <span style={{ fontWeight: 700, color: 'var(--color-conclusao)' }}>
                        R$ {sessao.rendaLiquida.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Session Calculation & Conversation */}
      {activeSessao ? (
        <div 
          style={{ 
            flex: 1, 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}
        >
          {/* Active Session Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {activeSessao.nomeCliente}
                </h2>
                <span 
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: activeSessao.status === 'Concluída' ? '#dcfce7' : '#fef3c7',
                    color: activeSessao.status === 'Concluída' ? '#15803d' : '#b45309'
                  }}
                >
                  {activeSessao.status}
                </span>
              </div>
              <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                CPF: {activeSessao.cpfCliente} • Criado em {new Date(activeSessao.dataCriacao).toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={() => alert(`Relatório sintético de apuração de ${activeSessao.nomeCliente} exportado com sucesso!`)}
              >
                <FiDownload size={14} /> Exportar Parecer
              </button>
            </div>
          </div>

          {/* Main Content Area (Scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Income Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Renda Bruta Total</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>
                  R$ {activeSessao.rendaBruta.toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Renda Líquida Aprovável</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                  R$ {activeSessao.rendaLiquida.toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 600 }}>Descontos Desconsiderados</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#c2410c', marginTop: '4px' }}>
                  R$ {activeSessao.descontosDesconsiderados.toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Capacidade Parcela (30%)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
                  R$ {activeSessao.capacidadePagamento.toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            {/* Section 1: Attached Files Management */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPaperclip size={16} /> Arquivos da Apuração ({activeSessao.arquivos.length})
                </h4>
                <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer' }}>
                  <FiPlus size={14} /> Anexar Arquivos
                  <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {activeSessao.arquivos.length === 0 ? (
                <div style={{ padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Nenhum arquivo anexado a esta apuração. Clique acima para anexar holerites, extratos ou IRPF.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {activeSessao.arquivos.map(file => (
                    <div 
                      key={file.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ overflow: 'hidden', marginRight: '8px' }}>
                        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {file.size} • {file.uploadedAt}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveFile(file.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Remover arquivo"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Consideration & Disconsideration Rules */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FiCheckCircle size={15} /> Considerar na Apuração
                </label>
                <textarea 
                  rows={3}
                  placeholder="Ex: Salário base, comissão fixa recorrente, gratificação contratual..."
                  value={activeSessao.regrasConsiderar}
                  onChange={(e) => handleUpdateRegras('regrasConsiderar', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.825rem',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FiXCircle size={15} /> Desconsiderar na Apuração
                </label>
                <textarea 
                  rows={3}
                  placeholder="Ex: Horas extras eventuais, 1/3 de férias, empréstimo consignado..."
                  value={activeSessao.regrasDesconsiderar}
                  onChange={(e) => handleUpdateRegras('regrasDesconsiderar', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.825rem',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* Section 3: Conversation Thread (History Log) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>
                Conversa & Histórico de Apuração
              </h4>

              {/* Message List */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {activeSessao.mensagens.map(msg => (
                  <div 
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : msg.sender === 'ai' ? 'flex-start' : 'center',
                      maxWidth: msg.sender === 'system' ? '100%' : '80%',
                      backgroundColor: msg.sender === 'user' ? 'var(--color-primary)' : msg.sender === 'ai' ? '#f1f5f9' : '#f8fafc',
                      color: msg.sender === 'user' ? '#ffffff' : msg.sender === 'ai' ? '#0f172a' : '#64748b',
                      padding: '10px 14px',
                      borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : msg.sender === 'ai' ? '14px 14px 14px 2px' : '8px',
                      fontSize: '0.825rem',
                      lineHeight: '1.4',
                      border: msg.sender === 'system' ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div>{msg.text}</div>
                    <div style={{ fontSize: '0.68rem', textAlign: 'right', marginTop: '4px', opacity: 0.8 }}>
                      {msg.timestamp}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Box */}
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text"
                  placeholder="Escreva uma instrução ou pergunta para ajustar a apuração..."
                  value={inputMensagem}
                  onChange={(e) => setInputMensagem(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontSize: '0.85rem'
                  }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', borderRadius: '8px' }}>
                  <FiSend size={16} />
                </button>
              </form>
            </div>

          </div>
        </div>
      ) : (
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Selecione ou crie uma apuração de renda no painel à esquerda.
        </div>
      )}

      {/* Modal: Nova Apuração */}
      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Nova Apuração de Renda</h3>
              <button className="modal-close" onClick={() => setShowNewModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSessao}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Nome do Cliente *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: DANILO HASSELMANN"
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF do Cliente</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="000.000.000-00"
                    value={newCpf}
                    onChange={(e) => setNewCpf(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar Apuração</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
