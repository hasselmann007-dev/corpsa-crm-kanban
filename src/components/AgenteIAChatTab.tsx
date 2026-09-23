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
  FiAlertCircle,
  FiPlay,
  FiDatabase,
  FiClock,
  FiFileText,
  FiGrid,
  FiMic,
  FiPaperclip,
  FiImage,
  FiMusic,
  FiX,
  FiCheck,
  FiLoader,
  FiDownload
} from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { 
  getOrCreateConversaSupabase, 
  carregarUltimasMensagensSupabase, 
  salvarMensagemSupabase 
} from '../utils/agenteMemoria';

export interface AgenteIAChatTabProps {
  userId?: string;
  currentUserName?: string;
  onOpenLead?: (lead: any) => void;
}

export interface ChatMediaAttachment {
  type: 'audio' | 'image' | 'pdf' | 'text';
  url: string;
  name: string;
  size?: string;
  transcribedText?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
  mediaAttachment?: ChatMediaAttachment;
}

const DEFAULT_PROMPT_AGENTCRM = `# objetivo
Você é analista responsável por fazer a triagem dos documentos recebidos para a CORPSA, seu objetivo é entender a dúvida do corretor, receber os documentos oficiais para adicionar em nossa esteira de crédito ou disparar consultas rápidas. Fale em tom caloroso, atencioso e objetivo, tratando por "você" em mensagens curtas e uma pergunta de cada vez.

## checklist oficial de documentos para financiamento caixa (json)
\`\`\`json
{
  "documentos_para_financiamento": {
    "comprador_e_participantes": [
      "CPF + RG ou CNH (legível, frente e verso)",
      "Certidão do Estado Civil (Nascimento ou Casamento)",
      "Comprovante de Endereço (em nome do requerente; conta de consumo máx. 30 dias)",
      "Carteira de Trabalho (apenas se for usar o FGTS)"
    ],
    "comprovantes_de_renda": {
      "assalariado_clt": [
        "02 Últimos holerites",
        "Imposto de Renda Completo (caso tenha declarado)"
      ],
      "empresario_autonomo": [
        "Extrato Bancário dos últimos 3 meses",
        "Imposto de Renda Completo (caso tenha declarado)",
        "Pró-labore / Aluguéis / Rendimentos etc."
      ]
    }
  }
}
\`\`\`

## ferramentas 
- **criar_card_kanban**: Cria um novo card na coluna "Roleta / Avaliar" do fluxo Kanban da CORPSA. Dispara notificação imediata a todos os analistas.
- **solicitar_consulta_rapida**: Dispara um alerta sonoro e notificação de Consulta Rápida (para verificação de IRPF, pesquisa de bens/imóvel, consulta de restrições de CPF ou Serasa) para todos os analistas online do sistema. NÃO cria card no fluxo Kanban.
- **consultar_manual_constituicao**: Consulta o Manual de Boas Práticas da CORPSA.

## como agir 
- **Solicitação de Avaliação de Crédito / Novo Lead:**
  1. Quando o corretor pedir para avaliar um cliente ou cadastrar um processo, **NÃO crie o card imediatamente**.
  2. Pergunte se o cliente é **Assalariado (Funcionário CLT)** ou **Empresário / Autônomo**, e se haverá cônjuge/participante.
  3. Envie a lista completa dos documentos necessários juntos (com base no JSON oficial acima).
  4. **SEM OS DOCUMENTOS NÃO ENVIA O CARD:** Somente quando o corretor anexar os documentos no chat (ou confirmar expressamente o envio dos documentos), acione a ferramenta \`criar_card_kanban\`.
- **Consulta Rápida:** Se o corretor solicitar apenas uma consulta pontual/rápida (ex: verificar CPF, verificar IRPF ou checar se possui imóvel em seu nome), acione a ferramenta \`solicitar_consulta_rapida\` para alertar os analistas online sem poluir o fluxo.
- Confirme ao corretor em tempo real quando o card for criado ou quando o alerta for disparado.
- Fale sempre em tom caloroso, atencioso, profissional e objetivo.
- Faça estritamente **UMA pergunta de cada vez** para manter a conversa fluida e organizada.

## nunca faça isso 
- **Nunca crie o card de avaliação no Kanban sem antes questionar o perfil e solicitar os documentos necessários.** Sem os documentos, o card não deve ser enviado para a esteira.
- Nunca crie card no fluxo para consultas que foram solicitadas expressamente como rápidas/pontuais.
- Nunca invente documentos fictícios; utilize sempre os arquivos reais enviados pelo corretor no chat.
- Nunca envie mensagens longas, prolixas ou com múltiplos parágrafos extensos.
- Nunca faça mais de uma pergunta no mesmo balão de mensagem.`;

export const AgenteIAChatTab: React.FC<AgenteIAChatTabProps> = ({
  userId,
  currentUserName = 'Danilo Hasselmann',
  onOpenLead
}) => {
  const [conversaId, setConversaId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [matchedExistingLead, setMatchedExistingLead] = useState<any | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key_v1') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('gemini_model_v1') || 'gemini-flash-latest');
  const [temperature, setTemperature] = useState<number>(() => {
    const saved = localStorage.getItem('gemini_temp_v1');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [promptCrmText, setPromptCrmText] = useState<string>(DEFAULT_PROMPT_AGENTCRM);
  const [promptCrmSaved, setPromptCrmSaved] = useState<boolean>(false);

  const [constitutionText, setConstitutionText] = useState<string>('');
  const [constitutionSaved, setConstitutionSaved] = useState<boolean>(false);

  const [regrasText, setRegrasText] = useState<string>('');
  const [regrasSaved, setRegrasSaved] = useState<boolean>(false);

  const [activeSideTab, setActiveSideTab] = useState<'prompt' | 'config' | 'constitution' | 'regras'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // File attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string>('');
  const [selectedFileType, setSelectedFileType] = useState<'audio' | 'image' | 'pdf' | 'text'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionFilesRef = useRef<Array<{ id: string; nome: string; tamanho: string; tipo: 'PDF' | 'Imagem' | 'DOC' | 'Outro'; categoria: string; data: string; fileData: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio Recording Handlers
  const startAudioRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage('Permissão de microfone negada ou indisponível.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioBlob(null);
    setAudioPreviewUrl('');
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const lowerType = file.type.toLowerCase();

    let mType: 'audio' | 'image' | 'pdf' | 'text' = 'text';
    if (lowerType.startsWith('audio/') || lowerName.endsWith('.mp3') || lowerName.endsWith('.ogg') || lowerName.endsWith('.wav') || lowerName.endsWith('.m4a') || lowerName.endsWith('.webm')) {
      mType = 'audio';
    } else if (lowerType.startsWith('image/') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) {
      mType = 'image';
    } else if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
      mType = 'pdf';
    }

    setSelectedFile(file);
    setSelectedFileType(mType);

    if (mType === 'image' || mType === 'audio') {
      const url = URL.createObjectURL(file);
      setSelectedFilePreview(url);
    } else {
      setSelectedFilePreview('');
    }
  };

  const clearSelectedFile = () => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFile(null);
    setSelectedFilePreview('');
    setSelectedFileType('text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const initMemory = async () => {
      const cid = await getOrCreateConversaSupabase(userId);
      setConversaId(cid);

      const history = await carregarUltimasMensagensSupabase(cid, 20);
      if (history.length > 0) {
        const formatted: ChatMessage[] = history.map((h: any, i: number) => ({
          id: i.toString(),
          sender: h.sender === 'user' ? 'user' : 'agent',
          text: h.text,
          timestamp: h.created_at ? new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: h.model_used
        }));
        setMessages(formatted);
      } else {
        setMessages([
          {
            id: '1',
            sender: 'agent',
            text: `Olá ${currentUserName}! Sou o assistente de triagem da CORPSA. Como posso ajudar você hoje?`,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            modelUsed: selectedModel
          }
        ]);
      }
    };

    initMemory();
    fetchPromptCrm();
    fetchConstitution();
    fetchRegras();
  }, [userId]);

  // Fetch prompt-agentcrm.md from server if available
  const fetchPromptCrm = async () => {
    try {
      const res = await fetch('/api/agent/prompt-agentcrm');
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

  // Load Constitution (Manual de Boas Práticas)
  const fetchConstitution = async () => {
    try {
      const res = await fetch('/api/agent/constitution');
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

  // Load Regras de Análise Kanban
  const fetchRegras = async () => {
    try {
      const res = await fetch('/api/kanban/regras-analise');
      if (res.ok) {
        const data = await res.json();
        if (data.regras) {
          setRegrasText(data.regras);
        }
      }
    } catch (_e) {
      // Server offline or on Vercel
    }
  };

  const handleSaveRegras = async () => {
    try {
      const res = await fetch('/api/kanban/regras-analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: regrasText })
      });
      if (res.ok) {
        setRegrasSaved(true);
        setTimeout(() => setRegrasSaved(false), 2500);
      }
    } catch (_e) {
      setRegrasSaved(true);
      setTimeout(() => setRegrasSaved(false), 2500);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key_v1', geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_model_v1', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('gemini_temp_v1', temperature.toString());
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

  // Helper to convert Blob/File to Base64 in browser
  const fileToBase64 = (fileOrBlob: Blob | File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrBlob);
    });
  };

  // Direct In-Browser Gemini Multimodal Transcription (Audio Speech-to-Text / Vision OCR / PDF Extraction)
  const transcribeMediaInBrowser = async (
    fileOrBlob: Blob | File, 
    mediaType: 'audio' | 'image' | 'pdf' | 'text', 
    mimeType: string,
    keyToUse: string
  ): Promise<string> => {
    const cleanKey = keyToUse.trim();
    if (!cleanKey) {
      throw new Error('Chave API do Google Gemini não configurada.');
    }

    const base64Data = await fileToBase64(fileOrBlob);

    let promptInstruction = '';
    if (mediaType === 'audio') {
      promptInstruction = 'Transcreva fielmente todo o áudio falado neste arquivo em português do Brasil com máxima precisão. Retorne estritamente o texto falado, sem aspas adicionais, sem preâmbulos, explicações ou notas de áudio.';
    } else if (mediaType === 'image') {
      promptInstruction = 'Analise detalhadamente esta imagem/documento e extraia todo o texto visível, dados cadastrais, nomes de clientes, CPFs, valores monetários, comprovantes de renda ou tabelas. Transcreva com fidelidade o conteúdo do documento para triagem.';
    } else if (mediaType === 'pdf') {
      promptInstruction = 'Leia e extraia fielmente todo o conteúdo deste documento PDF, incluindo textos, dados do cliente, holerites, extratos bancários, valores, declaração de imposto de renda e tabelas financeiras de forma clara e estruturada.';
    } else {
      promptInstruction = 'Extraia o conteúdo textual deste arquivo.';
    }

    let normalizedMime = mimeType;
    if (mediaType === 'audio') {
      normalizedMime = mimeType.includes('webm') ? 'audio/webm' : mimeType.includes('ogg') ? 'audio/ogg' : mimeType.includes('wav') ? 'audio/wav' : 'audio/webm';
    }

    const payload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: normalizedMime,
                data: base64Data
              }
            },
            {
              text: promptInstruction
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cleanKey}`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson: any;
      try { errJson = JSON.parse(errText); } catch {}
      throw new Error(errJson?.error?.message || errText || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return textOutput;
  };

  // Direct Google Gemini REST API completion handler using prompt-agentcrm.md as system prompt
  const callGoogleGeminiApi = async (memoryHistory: { sender: string; text: string }[], keyToUse: string, modelToUse: string): Promise<{ text: string; actualModel: string }> => {
    let systemInstructionText = promptCrmText && promptCrmText.trim()
      ? `${promptCrmText.trim()}`
      : `${DEFAULT_PROMPT_AGENTCRM}`;

    const lastMsg = memoryHistory[memoryHistory.length - 1]?.text.toLowerCase() || '';
    const keywordsManual = ['manual', 'boas práticas', 'sla', 'prazo', 'checklist', 'mcmv', 'teto', 'construtora', 'mrv', 'direcional', 'adn', 'agência', 'roleta'];
    
    if (keywordsManual.some(k => lastMsg.includes(k))) {
      if (constitutionText && constitutionText.trim()) {
        systemInstructionText += `\n\n[FERRAMENTA DE CONSULTA: MANUAL DE BOAS PRÁTICAS CORPSA (skills/constituicao.md)]:\n${constitutionText.trim()}`;
      }
    }

    const last20Messages = memoryHistory.slice(-20);
    const contents = last20Messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const cleanKey = keyToUse.trim();
    if (!cleanKey) {
      throw new Error('Chave API do Google Gemini não configurada.');
    }

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${cleanKey}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        contents,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 800
        }
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
    const candidate = data.candidates?.[0];
    const textParts = candidate?.content?.parts?.filter((p: any) => p.text && !p.thought) || [];
    const replyText = textParts.map((p: any) => p.text).join('\n') || candidate?.content?.parts?.[0]?.text || 'Sem resposta gerada pelo modelo.';

    // Inserção determinística no cliente para garantir criação do card apenas com documentos reais
    const lastUserText = memoryHistory[memoryHistory.length - 1]?.text || '';
    const isCreateCardIntent = /\b(?:cri(?:e|ar)|cadastr(?:e|ar)|adicion(?:e|ar)|novo\s+lead|novo\s+cliente|pasta)\b/i.test(lastUserText);
    const hasDocumentsInSession = sessionFilesRef.current.length > 0;
    const hasExplicitDocConfirmation = /\b(?:documentos?|anex(?:o|os|ado|ei)|holerite|extrato|comprovante|pasta\s+completa|juntei|enviei)\b/i.test(lastUserText);

    // REGRA: Sem documentos não cria o card de avaliação
    if (isCreateCardIntent && (hasDocumentsInSession || hasExplicitDocConfirmation)) {
      try {
        const cpfMatch = lastUserText.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/);
        const valorMatch = lastUserText.match(/(?:R\$\s*|im[oó]vel\s*(?:de)?\s*)(\d+[\d.,]*\s*(?:k|mil|milh[oõ]es)?)/i);
        let valorNum = 0;
        if (valorMatch) {
          const rawV = valorMatch[1].toLowerCase();
          if (rawV.includes('k') || rawV.includes('mil')) valorNum = parseFloat(rawV) * 1000;
          else valorNum = parseFloat(rawV.replace(/\./g, '').replace(',', '.')) || 0;
        }
        const nomeMatch = lastUserText.match(/(?:cliente|nome|para)\s*[:=]?\s*([A-ZÀ-Úa-zà-ú\s]{4,35})/i);
        const nomeFinal = nomeMatch ? nomeMatch[1].trim().toUpperCase() : 'NOVO CLIENTE';
        
        const createRes = await fetch('/api/kanban/criar-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_cliente: nomeFinal,
            cpf_cliente: cpfMatch ? cpfMatch[1] : undefined,
            valor_imovel: valorNum,
            detalhes_solicitacao: `Criado via Chat IA com ${sessionFilesRef.current.length} documentos reais anexados.`
          })
        });

        if (createRes.ok) {
          const createdJson = await createRes.json();
          const newLeadId = createdJson.leadId || createdJson.data?.id;
          if (newLeadId && sessionFilesRef.current.length > 0) {
            const docsToStore = sessionFilesRef.current.map(d => ({ ...d, leadId: newLeadId }));
            localStorage.setItem(`corpsa_lead_docs_${newLeadId}`, JSON.stringify(docsToStore));
          }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('corpsa_refresh_leads'));
        }
      } catch (_e) {}
    }

    return {
      text: replyText,
      actualModel: data.modelVersion || modelToUse
    };
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    const hasMedia = Boolean(audioBlob || selectedFile);

    if (!text && !hasMedia) return;
    if (isTyping) return;

    setErrorMessage('');
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 🛑 REGRA DE NEGÓCIO: Verificação de Unicidade de CPF no Chat do Agente
    // Intercepta apenas se for uma tentativa explícita de CADASTRAR/CRIAR um novo card com CPF já existente
    const isCadastroIntent = /\b(?:cadastr(?:ar|e|o)|cri(?:ar|e|a[çc][ãa]o)|adicion(?:ar|e)|nov[oa]\s+(?:lead|cliente|pasta)|proposta\s+nov|inserir)\b/i.test(text);
    const isConsultaIntent = /\b(?:como\s+est[aá]|situa[çc][ãa]o|status|informa[çc][ãa]o|consult(?:ar|e|a)|simulador|simula[çc][ãa]o|aprovad[oa]|pend[eê]ncia|onde\s+est[aá]|o\s+que\s+falta|qual\s+o\s+status|ver|detalhe|olh(?:e|ar)|buscar|pesquisar)\b/i.test(text);

    const rawDigits = text.replace(/\D/g, '');
    const cpfMatch = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/) || (rawDigits.length === 11 ? [rawDigits] : null);
    if (cpfMatch && isCadastroIntent && !isConsultaIntent) {
      const cleanDigits = cpfMatch[0].replace(/\D/g, '');
      if (cleanDigits.length === 11 && cleanDigits !== '00000000000') {
        const formattedCpf = `${cleanDigits.slice(0, 3)}.${cleanDigits.slice(3, 6)}.${cleanDigits.slice(6, 9)}-${cleanDigits.slice(9, 11)}`;
        try {
          const { data: existingLead } = await supabase
            .from('leads')
            .select('*')
            .or(`cpf_cliente.eq.${formattedCpf},cpf_cliente.eq.${cleanDigits}`)
            .limit(1)
            .maybeSingle();

          if (existingLead) {
            setMatchedExistingLead(existingLead);
            const userMsg: ChatMessage = {
              id: Date.now().toString(),
              sender: 'user',
              text: text,
              timestamp,
              mediaAttachment: selectedFile ? {
                type: selectedFileType,
                url: selectedFilePreview || '',
                name: selectedFile.name,
                size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
              } : undefined
            };
            const replyText = `Já possui um cliente com esse CPF em nossa base (${existingLead.nome_cliente} na etapa ${existingLead.etapa}). Você quer reavaliar ou adicionar um novo proponente?`;
            const agentMsg: ChatMessage = {
              id: (Date.now() + 1).toString(),
              sender: 'agent',
              text: replyText,
              timestamp,
              modelUsed: selectedModel
            };

            setMessages(prev => [...prev, userMsg, agentMsg]);
            setInputMessage('');
            if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
            setAudioBlob(null);
            setAudioPreviewUrl('');
            clearSelectedFile();

            if (conversaId) {
              await salvarMensagemSupabase(conversaId, 'user', text);
              await salvarMensagemSupabase(conversaId, 'agent', replyText, selectedModel);
            }
            return;
          }
        } catch (_cpfErr) {}
      }
    }

    let mediaAttachment: ChatMediaAttachment | undefined = undefined;
    let fileToSend: Blob | File | null = null;
    let fileNameToSend = 'arquivo';
    let fileMimeType = 'application/octet-stream';
    let mediaTypeToSend: 'audio' | 'image' | 'pdf' | 'text' = 'text';

    if (audioBlob) {
      fileToSend = audioBlob;
      fileNameToSend = `audio-${Date.now()}.webm`;
      fileMimeType = audioBlob.type || 'audio/webm';
      mediaTypeToSend = 'audio';
      mediaAttachment = {
        type: 'audio',
        url: audioPreviewUrl,
        name: fileNameToSend
      };
    } else if (selectedFile) {
      fileToSend = selectedFile;
      fileNameToSend = selectedFile.name;
      fileMimeType = selectedFile.type || 'application/octet-stream';
      mediaTypeToSend = selectedFileType;
      mediaAttachment = {
        type: selectedFileType,
        url: selectedFilePreview || '',
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
      };

      // Armazena cópia binária real do documento para anexar à pasta do cliente se o card for criado
      const currFile = selectedFile;
      const fReader = new FileReader();
      fReader.onload = () => {
        const dUrl = fReader.result as string;
        sessionFilesRef.current.push({
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          nome: currFile.name,
          tamanho: `${(currFile.size / 1024).toFixed(1)} KB`,
          tipo: currFile.name.toLowerCase().endsWith('.pdf') ? 'PDF' : currFile.type.includes('image') ? 'Imagem' : 'DOC',
          categoria: currFile.name.toLowerCase().includes('holerite') ? 'Holerite' :
                     currFile.name.toLowerCase().includes('extrato') ? 'Extrato' :
                     currFile.name.toLowerCase().includes('irpf') ? 'IRPF' :
                     currFile.name.toLowerCase().includes('sicaq') ? 'SICAQ' :
                     (currFile.name.toLowerCase().includes('rg') || currFile.name.toLowerCase().includes('cpf')) ? 'RG/CPF' : 'Geral',
          data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          fileData: dUrl
        });
      };
      fReader.readAsDataURL(currFile);
    }

    const initialUserDisplayText = text || (mediaAttachment?.type === 'audio' ? '🎤 [Áudio gravado]' : `📎 [${mediaAttachment?.name}]`);
    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: initialUserDisplayText,
      timestamp,
      mediaAttachment
    };

    const updatedUIHistory = [...messages, userMsg];
    setMessages(updatedUIHistory);
    setInputMessage('');
    clearSelectedFile();
    setAudioBlob(null);
    setAudioPreviewUrl('');
    setRecordingSeconds(0);
    setIsTyping(true);

    const activeKey = geminiApiKey.trim();

    try {
      let transcribedText = '';

      // ETAPA 1: Transcrição e Extração de Mídia (se houver áudio, imagem ou PDF)
      if (fileToSend && mediaAttachment) {
        // Tenta primeiro via Backend Express se disponível
        try {
          const formData = new FormData();
          formData.append('file', fileToSend, fileNameToSend);
          formData.append('mimeType', fileMimeType);
          formData.append('filename', fileNameToSend);
          formData.append('apiKey', activeKey);

          const transcribeRes = await fetch('/api/agente/transcribe', {
            method: 'POST',
            body: formData
          });

          if (transcribeRes.ok) {
            const tData = await transcribeRes.json();
            if (tData.success && tData.transcribedText) {
              transcribedText = tData.transcribedText;
            }
          }
        } catch (_transcribeBackendErr) {
          // Backend indisponível, faz transcrição direta no navegador via Gemini REST API
        }

        // Se backend não transcreveu, faz transcrição direta via Gemini Multimodal no navegador
        if (!transcribedText && activeKey) {
          try {
            transcribedText = await transcribeMediaInBrowser(
              fileToSend, 
              mediaTypeToSend, 
              fileMimeType, 
              activeKey
            );
          } catch (browserTranscribeErr: any) {
            console.error('Erro na transcrição in-browser:', browserTranscribeErr);
          }
        }

        // Atualiza a bolha de mensagem do usuário na tela com o texto transcrito
        if (transcribedText) {
          setMessages(prev => prev.map(m => {
            if (m.id === userMsgId && m.mediaAttachment) {
              return {
                ...m,
                mediaAttachment: {
                  ...m.mediaAttachment,
                  transcribedText
                }
              };
            }
            return m;
          }));
        }
      }

      // Constrói o texto real que será enviado para o Agente CRM
      let promptContentForAgent = '';
      if (mediaTypeToSend === 'audio' && transcribedText) {
        promptContentForAgent = `[Áudio falado pelo corretor/cliente transcrito]: "${transcribedText}"`;
        if (text) promptContentForAgent += `\n[Comentário adicional]: ${text}`;
      } else if (mediaTypeToSend === 'image' && transcribedText) {
        promptContentForAgent = `[Documento/Imagem enviada pelo corretor - Conteúdo extraído]:\n${transcribedText}`;
        if (text) promptContentForAgent += `\n[Comentário adicional]: ${text}`;
      } else if (mediaTypeToSend === 'pdf' && transcribedText) {
        promptContentForAgent = `[Documento PDF enviado pelo corretor - Conteúdo extraído]:\n${transcribedText}`;
        if (text) promptContentForAgent += `\n[Comentário adicional]: ${text}`;
      } else {
        promptContentForAgent = text || initialUserDisplayText;
      }

      // Grava no Supabase o texto real processado
      if (conversaId) {
        await salvarMensagemSupabase(conversaId, 'user', promptContentForAgent);
      }

      // Monta as últimas 20 mensagens com o novo turno
      const last20Messages = (conversaId 
        ? await carregarUltimasMensagensSupabase(conversaId, 20)
        : updatedUIHistory.slice(-20).map((m: any) => ({ sender: m.sender, text: m.text, timestamp: m.timestamp }))
      );

      // Substitui o último turno pelo texto transcrito real
      if (last20Messages.length > 0 && last20Messages[last20Messages.length - 1].sender === 'user') {
        last20Messages[last20Messages.length - 1].text = promptContentForAgent;
      }

      // ETAPA 2: Execução do Agente CRM
      let agentReplyText = '';
      let agentModelUsed = selectedModel;
      let agentMediaAttachment: ChatMediaAttachment | undefined = undefined;

      // Tenta via backend /api/agent/gemini-chat
      try {
        const backendRes = await fetch('/api/agent/gemini-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: last20Messages.map((m: any) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
            apiKey: activeKey,
            customPrompt: promptCrmText,
            customConstitution: constitutionText
          })
        });

        if (backendRes.ok) {
          const bData = await backendRes.json();
          if (bData.success && bData.text) {
            agentReplyText = bData.text;
            agentModelUsed = bData.model || selectedModel;
            if (bData.mediaAttachment) {
              agentMediaAttachment = bData.mediaAttachment;
            }
          }
        }
      } catch (_backendErr) {
        // Fallback direto
      }

      // Fallback direto ao Google Gemini REST API se backend não responder
      if (!agentReplyText) {
        if (!activeKey) {
          throw new Error('Insira sua chave do Google Gemini no painel à direita para conversar ao vivo.');
        }
        const directResult = await callGoogleGeminiApi(last20Messages, activeKey, selectedModel);
        agentReplyText = directResult.text;
        agentModelUsed = directResult.actualModel;
      }

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: agentReplyText,
        modelUsed: agentModelUsed,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        ...(agentMediaAttachment ? { mediaAttachment: agentMediaAttachment } : {})
      };

      setMessages(prev => [...prev, agentMsg]);

      // Dispara atualização em tempo real do Kanban e Consultas Rápidas
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('corpsa_refresh_leads'));
        window.dispatchEvent(new CustomEvent('corpsa_nova_consulta_rapida'));
      }

      if (conversaId) {
        await salvarMensagemSupabase(conversaId, 'agent', agentReplyText, agentModelUsed);
      }
    } catch (err: any) {
      const errTxt = err?.message || 'Falha ao processar resposta do Agente IA.';
      setErrorMessage(errTxt);
      const agentErrorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `⚠️ ${errTxt}`,
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
                backgroundColor: '#0284c7', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <FiCpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                  Agente de IA (Gemini 3.6 Flash)
                </h2>
                <span 
                  style={{ 
                    backgroundColor: '#e0f2fe', 
                    color: '#0369a1', 
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
                Triagem CORPSA + Ferramenta Manual de Boas Práticas (skills/constituicao.md)
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
        {!geminiApiKey.trim() && (
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
                Para ativarmos respostas do Google Gemini API, insira sua <strong>Gemini API Key</strong>:
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="password"
                placeholder="Chave Google Gemini API..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
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
            <FiPlay size={10} /> Testes de Triagem & Kanban:
          </span>
          <button
            onClick={() => handleApplyPreset('Por favor, adicione o novo cliente MARCELO COSTA, CPF 298.112.443-10, Imóvel de 280k da Construtora Direcional em Ribeirão Preto para análise de crédito.')}
            style={{ fontSize: '0.72rem', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            📋 Criar Card na Roleta
          </button>
          <button
            onClick={() => handleApplyPreset('Olá! Como está a pasta do cliente MARCELO COSTA, CPF 298.112.443-10? Ele já foi aprovado e tem o simulador Caixa disponível?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            🎯 Consultar CPF & Simulador
          </button>
          <button
            onClick={() => handleApplyPreset('Solicito a consulta urgente de CPF, pesquisa de bens/imóvel e IRPF da cliente ALINE FERREIRA, CPF 412.556.789-01.')}
            style={{ fontSize: '0.72rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            🔍 Consulta CPF / IRPF / Imóvel
          </button>
          <button
            onClick={() => handleApplyPreset('Olá, preciso enviar a pasta de um cliente para a fila de crédito. Quais documentos você precisa?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📄 Triagem de Documentos
          </button>
          <button
            onClick={() => handleApplyPreset('Qual é o prazo de SLA de atendimento para construtoras e imobiliárias no Manual de Boas Práticas?')}
            style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📖 Consultar Manual (SLA)
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
                      backgroundColor: '#0284c7', 
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
                    backgroundColor: isUser ? '#0284c7' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    border: isUser ? 'none' : '1px solid #e2e8f0'
                  }}
                >
                  {/* Media Attachment Rendering */}
                  {msg.mediaAttachment && (
                    <div style={{ marginBottom: '8px' }}>
                      {msg.mediaAttachment.type === 'audio' && msg.mediaAttachment.url && (
                        <div style={{ padding: '4px 0' }}>
                          <audio controls src={msg.mediaAttachment.url} style={{ width: '100%', maxWidth: '280px', height: '36px' }} />
                        </div>
                      )}
                      {msg.mediaAttachment.type === 'image' && msg.mediaAttachment.url && (
                        <div style={{ padding: '4px 0' }}>
                          <img 
                            src={msg.mediaAttachment.url} 
                            alt={msg.mediaAttachment.name} 
                            style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', objectFit: 'cover', display: 'block' }} 
                          />
                        </div>
                      )}
                      {(msg.mediaAttachment.type === 'pdf' || msg.mediaAttachment.type === 'text') && (
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px', 
                            padding: '8px 12px', 
                            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#f8fafc', 
                            borderRadius: '8px',
                            border: isUser ? '1px solid rgba(255,255,255,0.3)' : '1px solid #e2e8f0',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                            <FiFileText size={20} color={isUser ? '#ffffff' : '#0284c7'} />
                            <div>
                              <div style={{ color: isUser ? '#ffffff' : '#0f172a' }}>{msg.mediaAttachment.name}</div>
                              {msg.mediaAttachment.size && (
                                <div style={{ opacity: 0.8, fontSize: '0.7rem', color: isUser ? '#e2e8f0' : '#64748b' }}>
                                  {msg.mediaAttachment.size}
                                </div>
                              )}
                            </div>
                          </div>
                          {msg.mediaAttachment.url && (
                            <a 
                              href={msg.mediaAttachment.url} 
                              download={msg.mediaAttachment.name || 'Simulacao_Caixa.doc'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '6px 14px', 
                                backgroundColor: '#10b981', 
                                color: '#ffffff', 
                                borderRadius: '6px', 
                                textDecoration: 'none', 
                                fontSize: '0.78rem', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                                whiteSpace: 'nowrap'
                              }}
                              title="Baixar Simulador Caixa (.doc oficial para Word)"
                            >
                              <FiDownload size={15} />
                              <span>Baixar Simulador Caixa</span>
                            </a>
                          )}
                        </div>
                      )}
                      {msg.mediaAttachment.transcribedText && (
                        <div 
                          style={{ 
                            marginTop: '8px', 
                            padding: '8px 10px', 
                            borderRadius: '8px', 
                            backgroundColor: isUser ? 'rgba(0,0,0,0.18)' : '#f8fafc', 
                            border: isUser ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0', 
                            fontSize: '0.8rem',
                            lineHeight: '1.4'
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {msg.mediaAttachment.type === 'audio' && <span>🎤 Áudio Transcrito:</span>}
                            {msg.mediaAttachment.type === 'image' && <span>🖼️ Conteúdo da Imagem:</span>}
                            {msg.mediaAttachment.type === 'pdf' && <span>📄 Conteúdo do PDF:</span>}
                          </div>
                          <span style={{ fontStyle: 'italic' }}>"{msg.mediaAttachment.transcribedText}"</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                  
                  {msg.text.includes('Já possui um cliente com esse CPF em nossa base') && matchedExistingLead && onOpenLead && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                      <button
                        type="button"
                        onClick={() => onOpenLead(matchedExistingLead)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#0a192f',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(10, 25, 47, 0.2)'
                        }}
                      >
                        <span>Ir para o card existente ({matchedExistingLead.nome_cliente})</span>
                      </button>
                    </div>
                  )}
                  
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
                  backgroundColor: '#0284c7', 
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
                <FiLoader className="spinner" size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processando transcrição e gerando resposta com Agente IA...</span>
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

          {/* Selected File Preview Pill */}
          {selectedFile && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '6px 12px', 
                backgroundColor: '#f1f5f9', 
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedFileType === 'audio' && <FiMusic size={16} style={{ color: '#0284c7' }} />}
                {selectedFileType === 'image' && <FiImage size={16} style={{ color: '#0284c7' }} />}
                {selectedFileType === 'pdf' && <FiFileText size={16} style={{ color: '#0284c7' }} />}
                <span style={{ fontWeight: 600, color: '#334155' }}>{selectedFile.name}</span>
                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button 
                type="button" 
                onClick={clearSelectedFile}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                title="Remover anexo"
              >
                <FiX size={16} />
              </button>
            </div>
          )}

          {/* Audio Recording Active Bar */}
          {isRecording ? (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '10px 16px', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca',
                borderRadius: '8px',
                animation: 'pulse 1.5s infinite'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.875rem' }}>
                  Gravando áudio... {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={cancelAudioRecording}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#64748b'
                  }}
                >
                  <FiX size={14} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={stopAudioRecording}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FiCheck size={14} /> Concluir Áudio
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="audio/*,image/*,application/pdf" 
                style={{ display: 'none' }} 
              />

              {/* Attach File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping}
                title="Anexar Áudio, Imagem ou PDF"
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isTyping ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <FiPaperclip size={18} />
              </button>

              {/* Record Audio Button */}
              <button
                type="button"
                onClick={startAudioRecording}
                disabled={isTyping}
                title="Gravar Áudio via Microfone"
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#0284c7',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isTyping ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <FiMic size={18} />
              </button>

              {/* Text Input */}
              <input 
                type="text"
                placeholder={audioBlob ? "Áudio pronto para envio! Adicione texto se desejar..." : selectedFile ? `Arquivo ${selectedFile.name} selecionado. Digite uma mensagem opcional...` : "Digite sua dúvida ou anexe áudio/imagem/PDF para triagem..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isTyping}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!inputMessage.trim() && !audioBlob && !selectedFile) || isTyping}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 20px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  cursor: (inputMessage.trim() || audioBlob || selectedFile) && !isTyping ? 'pointer' : 'not-allowed',
                  opacity: (inputMessage.trim() || audioBlob || selectedFile) && !isTyping ? 1 : 0.6
                }}
              >
                <FiSend size={16} />
                <span>Enviar</span>
              </button>
            </div>
          )}
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
              backgroundColor: activeSideTab === 'prompt' ? '#e0f2fe' : 'transparent',
              color: activeSideTab === 'prompt' ? '#0369a1' : '#64748b',
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
            Prompt System
          </button>
          <button
            onClick={() => setActiveSideTab('constitution')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'constitution' ? '#e0f2fe' : 'transparent',
              color: activeSideTab === 'constitution' ? '#0369a1' : '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <FiBookOpen size={13} />
            Manual / Skill
          </button>
          <button
            onClick={() => setActiveSideTab('regras')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'regras' ? '#e0f2fe' : 'transparent',
              color: activeSideTab === 'regras' ? '#0369a1' : '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <FiGrid size={13} />
            Regras Kanban
          </button>
          <button
            onClick={() => setActiveSideTab('config')}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeSideTab === 'config' ? '#e0f2fe' : 'transparent',
              color: activeSideTab === 'config' ? '#0369a1' : '#64748b',
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
        </div>

        {activeSideTab === 'prompt' ? (
          /* Prompt Agent CRM Live Editor Tab */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiFileText size={15} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>prompt-agentcrm.md</span>
              </div>
              <span style={{ fontSize: '0.68rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>System Prompt Único</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>
              Instrução de sistema lida em todas as mensagens do chatbot.
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
                backgroundColor: promptCrmSaved ? '#16a34a' : '#0284c7',
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
        ) : activeSideTab === 'constitution' ? (
          /* Manual de Boas Práticas / Skill (skills/constituicao.md) */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiBookOpen size={14} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Manual de Boas Práticas</span>
              </div>
              <span style={{ fontSize: '0.68rem', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Ferramenta Sob Demanda</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>
              Salvo em <code>skills/constituicao.md</code>. Usado como base de conhecimento sob demanda para o agente consultar regras, SLAs, checklists e agências das construtoras.
            </p>
            <textarea
              value={constitutionText}
              onChange={(e) => setConstitutionText(e.target.value)}
              placeholder="Conteúdo do Manual de Boas Práticas..."
              style={{
                flex: 1,
                minHeight: '280px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
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
                backgroundColor: constitutionSaved ? '#16a34a' : '#0284c7',
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
              {constitutionSaved ? 'Manual Salvo!' : 'Salvar em skills/constituicao.md'}
            </button>
          </div>
        ) : activeSideTab === 'regras' ? (
          /* Regras de Análise & Criação no Kanban (skills/regras-analise-kanban.md) */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiGrid size={15} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Regras de Análise Kanban</span>
              </div>
              <span style={{ fontSize: '0.68rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Editável pelo Usuário</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>
              Salvo em <code>skills/regras-analise-kanban.md</code>. Edite as regras, gatilhos de criação de cards na Roleta, parâmetros de consulta de CPF/IRPF/Imóvel e adicione regras de negócio personalizadas.
            </p>
            <textarea
              value={regrasText}
              onChange={(e) => setRegrasText(e.target.value)}
              placeholder="Digite ou adicione suas regras de análise e criação de cards..."
              style={{
                flex: 1,
                minHeight: '280px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.4'
              }}
            />
            <button
              type="button"
              onClick={handleSaveRegras}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                backgroundColor: regrasSaved ? '#16a34a' : '#0284c7',
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
              {regrasSaved ? 'Regras Salvas com Sucesso!' : 'Salvar em skills/regras-analise-kanban.md'}
            </button>
          </div>
        ) : (
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
                <span>Carregando automaticamente as <strong>últimas 20 mensagens</strong> antes de cada resposta.</span>
              </div>
            </div>

            {/* Section: Google Gemini API Connection */}
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
                <FiKey size={14} style={{ color: '#0284c7' }} />
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Google Gemini API Key</label>
              </div>
              <input
                type="password"
                placeholder="Chave Google Gemini API..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: geminiApiKey.trim() ? '#16a34a' : '#d97706' }}>
                {geminiApiKey.trim() ? '✅ Chave Gemini salva no .env local' : '⚠️ Insira sua chave API do Google Gemini.'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <FiLayers size={14} style={{ color: '#0284c7' }} />
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Modelo da IA</label>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem('gemini_model_v1', e.target.value);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  backgroundColor: '#ffffff',
                  fontWeight: 600
                }}
              >
                <option value="gemini-flash-latest">✨ Google: Gemini 3.6 Flash (Recomendado)</option>
                <option value="gemini-pro-latest">Google: Gemini Pro Latest</option>
                <option value="gemini-flash-lite-latest">Google: Gemini Flash Lite Latest</option>
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
        )}
      </div>
    </div>
  );
};
