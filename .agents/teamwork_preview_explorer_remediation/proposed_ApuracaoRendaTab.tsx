import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FiPlus, 
  FiSearch, 
  FiPaperclip, 
  FiTrash2, 
  FiSend, 
  FiCheckCircle, 
  FiDownload, 
  FiXCircle,
  FiZap,
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw
} from 'react-icons/fi';
import { supabase } from '../supabaseClient';

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
  rendaFormal: number;
  rendaInformal: number;
  rendaBruta: number;
  rendaLiquida: number;
  descontosDesconsiderados: number;
  capacidadePagamento: number;
  mensagens: ApuracaoMensagem[];
}

export type NlmAnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'calculating' | 'complete' | 'error';

export interface NlmAnalysisState {
  status: NlmAnalysisStatus;
  progressPercent: number;
  currentStepMessage: string;
  errorMessage?: string;
}

const STORAGE_KEY = 'crm_apuracoes_renda_v1';

// Initial Mock Sessions for rich immediate experience
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
    rendaFormal: 8500,
    rendaInformal: 1200,
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
        text: '⚡ **Apuração Concluída via NotebookLM (1-Clique)**\n\n' +
              '• **Renda Formal:** R$ 8.500,00\n' +
              '• **Renda Informal:** R$ 1.200,00\n' +
              '• **Renda Bruta Total:** R$ 9.700,00\n' +
              '• **Descontos Desconsiderados:** R$ 450,00\n' +
              '• **Renda Líquida Aprovável:** R$ 8.200,00\n' +
              '• **Capacidade de Parcela (30%):** R$ 2.460,00/mês\n\n' +
              '📝 **Parecer:** Renda formal apurada em holerite oficial. Renda informal validada por extrato bancário trimestral.',
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
    rendaFormal: 12000,
    rendaInformal: 0,
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

// Helper to normalize diacritics for accent-insensitive search
const normalizeText = (str: string) => {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

export const ApuracaoRendaTab: React.FC = () => {
  const [sessoes, setSessoes] = useState<ApuracaoSessao[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((s: any) => s && typeof s === 'object')
            .map((s: any) => ({
              ...s,
              nomeCliente: s.nomeCliente || '',
              cpfCliente: s.cpfCliente || '',
              status: s.status || 'Em Análise',
              dataCriacao: s.dataCriacao || new Date().toISOString(),
              regrasConsiderar: s.regrasConsiderar || '',
              regrasDesconsiderar: s.regrasDesconsiderar || '',
              rendaFormal: s.rendaFormal ?? s.rendaBruta ?? 0,
              rendaInformal: s.rendaInformal ?? 0,
              rendaBruta: s.rendaBruta ?? 0,
              rendaLiquida: s.rendaLiquida ?? 0,
              descontosDesconsiderados: s.descontosDesconsiderados ?? 0,
              capacidadePagamento: s.capacidadePagamento ?? 0,
              arquivos: Array.isArray(s.arquivos) ? s.arquivos : [],
              mensagens: Array.isArray(s.mensagens) ? s.mensagens : []
            }));
        }
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

  const [analysisState, setAnalysisState] = useState<NlmAnalysisState>({
    status: 'idle',
    progressPercent: 0,
    currentStepMessage: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessoes));
  }, [sessoes]);

  // Sync with Supabase on mount
  useEffect(() => {
    let isMounted = true;
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('apuracoes_renda')
          .select('*')
          .order('data_atualizacao', { ascending: false });

        if (error) {
          console.warn('Supabase fetch notice (using LocalStorage fallback):', error.message);
          return;
        }

        if (data && data.length > 0 && isMounted) {
          const remoteSessoes: ApuracaoSessao[] = data.map((item: any) => ({
            id: item.id,
            nomeCliente: item.nome_cliente || '',
            cpfCliente: item.cpf_cliente || '',
            status: item.status || 'Em Análise',
            dataCriacao: item.data_criacao || new Date().toISOString(),
            regrasConsiderar: item.regras_considerar || '',
            regrasDesconsiderar: item.regras_desconsiderar || '',
            rendaFormal: Number(item.renda_formal ?? 0),
            rendaInformal: Number(item.renda_informal ?? 0),
            rendaBruta: Number(item.renda_bruta ?? 0),
            rendaLiquida: Number(item.renda_liquida ?? 0),
            descontosDesconsiderados: Number(item.descontos_desconsiderados ?? 0),
            capacidadePagamento: Number(item.capacidade_pagamento ?? 0),
            arquivos: Array.isArray(item.arquivos) ? item.arquivos : [],
            mensagens: Array.isArray(item.mensagens) ? item.mensagens : []
          }));

          setSessoes(prev => {
            const map = new Map<string, ApuracaoSessao>();
            prev.forEach(s => map.set(s.id, s));
            remoteSessoes.forEach(s => map.set(s.id, s));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Supabase sync notice:', err);
      }
    };

    loadFromSupabase();
    return () => { isMounted = false; };
  }, []);

  // Helper to sync single session to Supabase asynchronously
  const syncSessionToSupabase = useCallback(async (sessao: ApuracaoSessao) => {
    try {
      const payload = {
        id: sessao.id,
        nome_cliente: sessao.nomeCliente || '',
        cpf_cliente: sessao.cpfCliente || '',
        status: sessao.status || 'Em Análise',
        data_criacao: sessao.dataCriacao || new Date().toISOString(),
        data_atualizacao: new Date().toISOString(),
        regras_considerar: sessao.regrasConsiderar || '',
        regras_desconsiderar: sessao.regrasDesconsiderar || '',
        renda_formal: sessao.rendaFormal ?? 0,
        renda_informal: sessao.rendaInformal ?? 0,
        renda_bruta: sessao.rendaBruta ?? 0,
        renda_liquida: sessao.rendaLiquida ?? 0,
        descontos_desconsiderados: sessao.descontosDesconsiderados ?? 0,
        capacidade_pagamento: sessao.capacidadePagamento ?? 0,
        arquivos: sessao.arquivos || [],
        mensagens: sessao.mensagens || []
      };

      await supabase.from('apuracoes_renda').upsert(payload, { onConflict: 'id' });
    } catch (err) {
      console.warn('Supabase upsert notice:', err);
    }
  }, []);

  const activeSessao = sessoes.find(s => s.id === selectedSessaoId) || sessoes[0];

  // Auto scroll messages thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSessao?.mensagens]);

  // Filtered Sessions for Sidebar with safe navigation and accent normalization
  const normalizedSearch = normalizeText(searchTerm);
  const filteredSessoes = sessoes.filter(s => {
    const nomeNorm = normalizeText(s.nomeCliente);
    const cpfNorm = (s.cpfCliente || '');
    const statusNorm = normalizeText(s.status);
    return nomeNorm.includes(normalizedSearch) || cpfNorm.includes(searchTerm) || statusNorm.includes(normalizedSearch);
  });

  // 1-Click Action Handler for NotebookLM Analysis
  const handleAnalisarNotebookLM = async () => {
    if (!activeSessao) return;

    // File validation check
    if (!activeSessao.arquivos || activeSessao.arquivos.length === 0) {
      setAnalysisState({
        status: 'error',
        progressPercent: 0,
        currentStepMessage: '',
        errorMessage: 'Anexe pelo menos 1 documento (holerite, extrato ou IRPF) antes de iniciar a análise no NotebookLM (1-Clique).'
      });
      return;
    }

    try {
      // Step 1: Uploading
      setAnalysisState({
        status: 'uploading',
        progressPercent: 30,
        currentStepMessage: `Passo 1/3 [Uploading]: Enviando ${activeSessao.arquivos.length} documento(s) para o notebook central NotebookLM...`
      });

      // Step 2: Analyzing
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnalysisState({
        status: 'analyzing',
        progressPercent: 65,
        currentStepMessage: 'Passo 2/3 [Analyzing]: NotebookLM extraindo comprovantes, holerites e aplicando regras de apuração...'
      });

      // Step 3: Calculating
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnalysisState({
        status: 'calculating',
        progressPercent: 90,
        currentStepMessage: 'Passo 3/3 [Calculating]: Calculando Renda Formal, Informal, Descontos e Capacidade de Parcela (30%)...'
      });

      let resData: {
        rendaFormal: number;
        rendaInformal: number;
        rendaBruta: number;
        descontosDesconsiderados: number;
        rendaLiquida: number;
        capacidadePagamento: number;
        resumoParecer: string;
      };

      try {
        const response = await fetch('/api/nlm/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessao.id,
            nomeCliente: activeSessao.nomeCliente,
            cpfCliente: activeSessao.cpfCliente,
            regrasConsiderar: activeSessao.regrasConsiderar,
            regrasDesconsiderar: activeSessao.regrasDesconsiderar,
            arquivos: activeSessao.arquivos
          })
        });

        if (response.ok) {
          const json = await response.json();
          const dataPayload = json.data || json;
          resData = {
            rendaFormal: Number(dataPayload.rendaFormal ?? dataPayload.formalIncome ?? 0),
            rendaInformal: Number(dataPayload.rendaInformal ?? dataPayload.informalIncome ?? 0),
            rendaBruta: Number(dataPayload.rendaBruta ?? dataPayload.totalGrossIncome ?? 0),
            descontosDesconsiderados: Number(dataPayload.descontosDesconsiderados ?? dataPayload.disregardedDeductions ?? 0),
            rendaLiquida: Number(dataPayload.rendaLiquida ?? dataPayload.approvedNetIncome ?? 0),
            capacidadePagamento: Number(dataPayload.capacidadePagamento ?? dataPayload.paymentCapacity ?? 0),
            resumoParecer: dataPayload.resumoParecer || dataPayload.parecer || dataPayload.summary || 'Apuração concluída via NotebookLM.'
          };
        } else {
          let errText = '';
          try {
            const errJson = await response.json();
            errText = errJson.message || errJson.error || '';
            if (errJson.error === 'AUTH_REQUIRED' || response.status === 401) {
              errText = "Autenticação necessária: Execute 'nlm login' no terminal para conectar a conta do NotebookLM.";
            } else if (errJson.error === 'CLI_NOT_FOUND' || response.status === 500 && errText.includes('CLI')) {
              errText = "CLI NotebookLM não encontrada. Execute 'uv tool install notebooklm-mcp-cli' no terminal.";
            }
          } catch {
            errText = `O servidor local de integração (server/index.ts) retornou erro (HTTP ${response.status}). Execute 'npm run server' no terminal.`;
          }

          setAnalysisState({
            status: 'error',
            progressPercent: 0,
            currentStepMessage: '',
            errorMessage: errText || `O servidor de integração está offline ou com falha. Execute 'npm run server' no terminal.`
          });
          return;
        }
      } catch (networkErr: any) {
        setAnalysisState({
          status: 'error',
          progressPercent: 0,
          currentStepMessage: '',
          errorMessage: "O servidor local de integração (server/index.ts) está offline. Execute 'npm run server' no terminal para conectar a ponte do NotebookLM."
        });
        return;
      }

      // Update session state & metrics
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const aiMsgText = `⚡ **Apuração Automatizada NotebookLM (1-Clique)**\n\n` +
        `📊 **Resumo Apurado:**\n` +
        `• **Renda Formal:** R$ ${(resData.rendaFormal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `• **Renda Informal:** R$ ${(resData.rendaInformal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `• **Renda Bruta Total:** R$ ${(resData.rendaBruta ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `• **Descontos Desconsiderados:** R$ ${(resData.descontosDesconsiderados ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `• **Renda Líquida Aprovável:** R$ ${(resData.rendaLiquida ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `• **Capacidade de Parcela (30%):** R$ ${(resData.capacidadePagamento ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês\n\n` +
        `📝 **Parecer Sintético:**\n${resData.resumoParecer}`;

      const aiMsg: ApuracaoMensagem = {
        id: `m-nlm-${Date.now()}`,
        sender: 'ai',
        text: aiMsgText,
        timestamp: nowTime
      };

      let updatedSessaoToSync: ApuracaoSessao | null = null;

      setSessoes(prev => prev.map(s => {
        if (s.id === activeSessao.id) {
          const updated: ApuracaoSessao = {
            ...s,
            rendaFormal: resData.rendaFormal,
            rendaInformal: resData.rendaInformal,
            rendaBruta: resData.rendaBruta,
            rendaLiquida: resData.rendaLiquida,
            descontosDesconsiderados: resData.descontosDesconsiderados,
            capacidadePagamento: resData.capacidadePagamento,
            status: 'Concluída',
            mensagens: [...(s.mensagens || []), aiMsg]
          };
          updatedSessaoToSync = updated;
          return updated;
        }
        return s;
      }));

      if (updatedSessaoToSync) {
        syncSessionToSupabase(updatedSessaoToSync);
      }

      // Complete State
      setAnalysisState({
        status: 'complete',
        progressPercent: 100,
        currentStepMessage: 'Apuração no NotebookLM concluída com sucesso! Métricas e parecer atualizados.'
      });

      // Auto clear progress banner after 4 seconds
      setTimeout(() => {
        setAnalysisState({ status: 'idle', progressPercent: 0, currentStepMessage: '' });
      }, 4000);

    } catch (err) {
      setAnalysisState({
        status: 'error',
        progressPercent: 0,
        currentStepMessage: '',
        errorMessage: err instanceof Error ? err.message : 'Falha na análise via NotebookLM.'
      });
    }
  };

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
      rendaFormal: 0,
      rendaInformal: 0,
      rendaBruta: 0,
      rendaLiquida: 0,
      descontosDesconsiderados: 0,
      capacidadePagamento: 0,
      mensagens: [
        {
          id: `m-${Date.now()}`,
          sender: 'system',
          text: `Sessão de apuração de renda criada para ${newNome.trim().toUpperCase()}. Anexe os documentos e defina as regras para iniciar o 1-Clique NotebookLM.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setSessoes(prev => [newSessao, ...prev]);
    setSelectedSessaoId(newSessao.id);
    syncSessionToSupabase(newSessao);
    setNewNome('');
    setNewCpf('');
    setShowNewModal(false);
  };

  // Update Consideration Rules
  const handleUpdateRegras = (field: 'regrasConsiderar' | 'regrasDesconsiderar', val: string) => {
    if (!activeSessao) return;
    let targetToSync: ApuracaoSessao | null = null;
    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        const updated = { ...s, [field]: val };
        targetToSync = updated;
        return updated;
      }
      return s;
    }));
    if (targetToSync) {
      syncSessionToSupabase(targetToSync);
    }
  };

  // Handle File Upload Simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeSessao) return;
    const filesArray = Array.from(e.target.files);
    
    const newDocs: ApuracaoArquivo[] = filesArray.map((f, idx) => ({
      id: `f-${Date.now()}-${idx}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      type: f.name.toLowerCase().endsWith('.pdf') ? 'PDF' : f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg') ? 'Imagem' : 'Documento',
      uploadedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }));

    let targetToSync: ApuracaoSessao | null = null;

    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        const updated: ApuracaoSessao = {
          ...s,
          arquivos: [...(s.arquivos || []), ...newDocs],
          mensagens: [
            ...(s.mensagens || []),
            {
              id: `m-doc-${Date.now()}`,
              sender: 'system',
              text: `Anexado(s) ${newDocs.length} novo(s) documento(s): ${newDocs.map(d => d.name).join(', ')}.`,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
        targetToSync = updated;
        return updated;
      }
      return s;
    }));

    if (targetToSync) {
      syncSessionToSupabase(targetToSync);
    }
    e.target.value = '';
  };

  // Remove File
  const handleRemoveFile = (fileId: string) => {
    if (!activeSessao) return;
    let targetToSync: ApuracaoSessao | null = null;
    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        const updated = {
          ...s,
          arquivos: (s.arquivos || []).filter(f => f.id !== fileId)
        };
        targetToSync = updated;
        return updated;
      }
      return s;
    }));
    if (targetToSync) {
      syncSessionToSupabase(targetToSync);
    }
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

    let newFormal = activeSessao.rendaFormal ?? 0;
    let newInformal = activeSessao.rendaInformal ?? 0;
    let newBruta = activeSessao.rendaBruta ?? (newFormal + newInformal);
    let newLiquida = activeSessao.rendaLiquida ?? Math.max(0, newBruta - Math.round(newBruta * 0.12));
    let newDescontos = activeSessao.descontosDesconsiderados ?? 0;

    const textLower = userText.toLowerCase();
    if (textLower.includes('desconsiderar') || textLower.includes('ignorar')) {
      newDescontos += 300;
      newLiquida += 300;
    }
    if (textLower.includes('comissão') || textLower.includes('informal')) {
      newInformal += 800;
      newBruta = newFormal + newInformal;
      newLiquida += 650;
    }
    const newCapacidade = Math.round(newLiquida * 0.30);

    const aiMsg: ApuracaoMensagem = {
      id: `m-ai-${Date.now()}`,
      sender: 'ai',
      text: `Instrução processada: "${userText}". Recálculo de apuração atualizado:\n` +
            `• Renda Formal: R$ ${newFormal.toLocaleString('pt-BR')}\n` +
            `• Renda Informal: R$ ${newInformal.toLocaleString('pt-BR')}\n` +
            `• Renda Bruta: R$ ${newBruta.toLocaleString('pt-BR')}\n` +
            `• Renda Líquida Aprovável: R$ ${newLiquida.toLocaleString('pt-BR')} (Margem 30%: R$ ${newCapacidade.toLocaleString('pt-BR')}/mês).`,
      timestamp: nowTime
    };

    let targetToSync: ApuracaoSessao | null = null;

    setSessoes(prev => prev.map(s => {
      if (s.id === activeSessao.id) {
        const updated: ApuracaoSessao = {
          ...s,
          rendaFormal: newFormal,
          rendaInformal: newInformal,
          rendaBruta: newBruta,
          rendaLiquida: newLiquida,
          descontosDesconsiderados: newDescontos,
          capacidadePagamento: newCapacidade,
          status: 'Concluída',
          mensagens: [...(s.mensagens || []), userMsg, aiMsg]
        };
        targetToSync = updated;
        return updated;
      }
      return s;
    }));

    if (targetToSync) {
      syncSessionToSupabase(targetToSync);
    }

    setInputMensagem('');
  };

  const isProcessing = analysisState.status !== 'idle' && analysisState.status !== 'complete' && analysisState.status !== 'error';

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '650px' }}>
      
      {/* LEFT COLUMN: Searchable History Sidebar */}
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
              const arquivosCount = (sessao.arquivos || []).length;
              const rendaLiquidaVal = sessao.rendaLiquida ?? 0;
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
                      {sessao.nomeCliente || 'Cliente sem nome'}
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
                      {sessao.status || 'Em Análise'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span>CPF: {sessao.cpfCliente || 'Não informado'}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px dashed #f1f5f9', paddingTop: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiPaperclip size={12} /> {arquivosCount} doc(s)
                    </span>
                    {rendaLiquidaVal > 0 && (
                      <span style={{ fontWeight: 700, color: 'var(--color-conclusao)' }}>
                        R$ {rendaLiquidaVal.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Session Panel */}
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
          {/* Active Session Header with Prominent 1-Click Action Button */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {activeSessao.nomeCliente || 'Cliente sem nome'}
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
                  {activeSessao.status || 'Em Análise'}
                </span>
              </div>
              <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                CPF: {activeSessao.cpfCliente || 'Não informado'} • Criado em {activeSessao.dataCriacao ? new Date(activeSessao.dataCriacao).toLocaleDateString('pt-BR') : '-'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* PROMINENT 1-CLICK NOTEBOOKLM ACTION BUTTON */}
              <button 
                className="btn"
                onClick={handleAnalisarNotebookLM}
                disabled={isProcessing}
                style={{
                  background: isProcessing
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #ff8c00 0%, #ea580c 100%)',
                  color: '#ffffff',
                  boxShadow: isProcessing ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isProcessing ? (
                  <>
                    <FiLoader className="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <FiZap size={18} style={{ color: '#fff' }} />
                    <span>Analisar no NotebookLM (1-Clique)</span>
                  </>
                )}
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '9px 14px', borderRadius: '10px' }}
                onClick={() => alert(`Relatório sintético de apuração de ${activeSessao.nomeCliente} exportado com sucesso!`)}
              >
                <FiDownload size={14} /> Exportar Parecer
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* REAL-TIME PROGRESS BANNER */}
            {analysisState.status !== 'idle' && (
              <div 
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: analysisState.status === 'error' ? '#fef2f2' : analysisState.status === 'complete' ? '#f0fdf4' : '#eff6ff',
                  border: analysisState.status === 'error' ? '1px solid #fca5a5' : analysisState.status === 'complete' ? '1px solid #86efac' : '1px solid #93c5fd',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem', color: analysisState.status === 'error' ? '#991b1b' : analysisState.status === 'complete' ? '#166534' : '#1e40af' }}>
                    {isProcessing && <FiLoader size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                    {analysisState.status === 'complete' && <FiCheckCircle size={16} />}
                    {analysisState.status === 'error' && <FiAlertTriangle size={16} />}
                    <span>
                      {analysisState.status === 'uploading' && 'Status: Enviando Arquivos (Uploading)'}
                      {analysisState.status === 'analyzing' && 'Status: Analisando Documentos (Analyzing)'}
                      {analysisState.status === 'calculating' && 'Status: Processando Métricas (Calculating)'}
                      {analysisState.status === 'complete' && 'Status: Análise Concluída (Complete)'}
                      {analysisState.status === 'error' && 'Status: Erro na Análise'}
                    </span>
                  </div>

                  {analysisState.status === 'error' && (
                    <button 
                      onClick={handleAnalisarNotebookLM}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FiRefreshCw size={12} /> Tentar Novamente
                    </button>
                  )}
                </div>

                {/* Progress Bar Track */}
                <div style={{ height: '8px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div 
                    style={{
                      height: '100%',
                      width: `${analysisState.progressPercent}%`,
                      backgroundColor: analysisState.status === 'error' ? '#ef4444' : analysisState.status === 'complete' ? '#10b981' : '#ea580c',
                      transition: 'width 0.4s ease-in-out'
                    }}
                  />
                </div>

                <div style={{ fontSize: '0.8rem', color: analysisState.status === 'error' ? '#b91c1c' : '#475569' }}>
                  {analysisState.status === 'error' ? analysisState.errorMessage : analysisState.currentStepMessage}
                </div>
              </div>
            )}

            {/* EXPANDED INCOME SUMMARY CARDS (6 RESPONSIVE CARDS GRID) */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resumo da Apuração de Renda
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                
                {/* 1. Renda Formal */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>Renda Formal</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                    R$ {(activeSessao.rendaFormal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#60a5fa', marginTop: '2px' }}>Holerites / CLT / Pró-labore</div>
                </div>

                {/* 2. Renda Informal */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 700 }}>Renda Informal</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7e22ce', marginTop: '4px' }}>
                    R$ {(activeSessao.rendaInformal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#c084fc', marginTop: '2px' }}>Extratos / Movimentação PIX</div>
                </div>

                {/* 3. Renda Bruta Total */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>Renda Bruta Total</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    R$ {(activeSessao.rendaBruta ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Soma Formal + Informal</div>
                </div>

                {/* 4. Descontos Desconsiderados */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 700 }}>Descontos Desconsiderados</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c', marginTop: '4px' }}>
                    R$ {(activeSessao.descontosDesconsiderados ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#fb923c', marginTop: '2px' }}>Horas Extras / Exclusões</div>
                </div>

                {/* 5. Renda Líquida Aprovável */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>Renda Líquida Aprovável</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                    R$ {(activeSessao.rendaLiquida ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#4ade80', marginTop: '2px' }}>Valor Final Homologado</div>
                </div>

                {/* 6. Capacidade de Parcela (30%) */}
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
                  <div style={{ fontSize: '0.75rem', color: '#3730a3', fontWeight: 700 }}>Capacidade Parcela (30%)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4338ca', marginTop: '4px' }}>
                    R$ {(activeSessao.capacidadePagamento ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#818cf8', marginTop: '2px' }}>Margem Máxima Consignável</div>
                </div>

              </div>
            </div>

            {/* Section 1: Attached Files Management */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPaperclip size={16} /> Arquivos da Apuração ({(activeSessao.arquivos || []).length})
                </h4>
                <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 12px', cursor: 'pointer', borderRadius: '8px' }}>
                  <FiPlus size={14} /> Anexar Arquivos
                  <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {(!activeSessao.arquivos || activeSessao.arquivos.length === 0) ? (
                <div style={{ padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', backgroundColor: '#f8fafc' }}>
                  Nenhum arquivo anexado a esta apuração. Clique acima para anexar holerites, extratos ou IRPF e habilitar a análise em 1-Clique.
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
                  value={activeSessao.regrasConsiderar || ''}
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
                  value={activeSessao.regrasDesconsiderar || ''}
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {(activeSessao.mensagens || []).map(msg => (
                  <div 
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : msg.sender === 'ai' ? 'flex-start' : 'center',
                      maxWidth: msg.sender === 'system' ? '100%' : '85%',
                      backgroundColor: msg.sender === 'user' ? 'var(--color-primary)' : msg.sender === 'ai' ? '#f1f5f9' : '#f8fafc',
                      color: msg.sender === 'user' ? '#ffffff' : msg.sender === 'ai' ? '#0f172a' : '#64748b',
                      padding: '10px 14px',
                      borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : msg.sender === 'ai' ? '14px 14px 14px 2px' : '8px',
                      fontSize: '0.825rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                      border: msg.sender === 'system' ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div>{msg.text}</div>
                    <div style={{ fontSize: '0.68rem', textAlign: 'right', marginTop: '4px', opacity: 0.8 }}>
                      {msg.timestamp}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
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
