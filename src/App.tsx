import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { parseRawText, isValidCpf } from './utils/parser';
import { isPendenciaSLAOverdue, getLeadSlaCountdown } from './utils/sla';
import { ApuracaoRendaTab } from './components/ApuracaoRendaTab';
import { AgenteIAChatTab } from './components/AgenteIAChatTab';
import type { Session } from '@supabase/supabase-js';
import { 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Grid, 
  Activity, 
  DollarSign, 
  FileText, 
  MapPin, 
  Users, 
  Lock,
  TrendingUp,
  Flag,
  CheckSquare,
  Trash2,
  Minimize2,
  Clock,
  Cpu,
  Bell,
  Volume2,
  Shield,
  Zap,
  RotateCw,
  ChevronDown,
  Power,
  User,
  KeyRound,
  LogOut,
  Settings
} from 'lucide-react';

// Mapeamento compatível para Lucide Icons
const FiPlus = Plus;
const FiSearch = Search;
const FiAlertCircle = AlertCircle;
const FiCheckCircle = CheckCircle2;
const FiX = X;
const FiGrid = Grid;
const FiActivity = Activity;
const FiDollarSign = DollarSign;
const FiFileText = FileText;
const FiMapPin = MapPin;
const FiUsers = Users;
const FiLock = Lock;
const FiTrendingUp = TrendingUp;
const FiFlag = Flag;
const FiCheckSquare = CheckSquare;
const FiTrash2 = Trash2;
const FiMinimize2 = Minimize2;
const FiClock = Clock;
const FiCpu = Cpu;
const FiBell = Bell;
const FiVolume2 = Volume2;
const FiShield = Shield;
const FiZap = Zap;
import { 
  playAlertChime, 
  requestNotificationPermission, 
  notifyNewLeadArrival 
} from './utils/notificationSound';
import { ConsultaRapidaPopup } from './components/ConsultaRapidaPopup';
import { ConsultaRapidaToastAlert } from './components/ConsultaRapidaToastAlert';
import { AnalistasOnlineBar } from './components/AnalistasOnlineBar';
import { LeadDetailFullModal } from './components/LeadDetailFullModal';
import { getConsultasRapidas, getAnalistasPresenca, setAnalistaStatus } from './utils/consultaRapidaStore';
import type { AnalistaPresenca } from './types/consultaRapida';
import { getAnalistaResponsavel, isAnalistaOnline, registrarTrocaAnalista } from './utils/analistaResponsavel';
import { extrairLancamentosCorPay, calcularRemuneracaoAnalista } from './utils/corpayStore';

export interface Lead {
  id: string;
  data_hora_entrada: string;
  nome_cliente: string;
  cpf_cliente: string;
  valor_imovel: number;
  cidade: string;
  grupo_origem: string;
  informacoes_importantes?: string;
  descricao_pendencia?: string;
  resultado_analise?: string;
  motivo_resultado?: string;
  etapa: 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao';
  tipo_avaliacao?: 'Reavaliação' | 'Nova Avaliação';
  tipo_financiamento?: 'SBPE' | 'MCMV';
  categoria?: string;
  adicionado_corpay: boolean;
  prioridade?: 'Baixa' | 'Média' | 'Alta';
  mo_serasa?: string;
  status_serasa?: 'Pendente' | 'Sem Restrição' | 'Com Restrição' | 'Consultado';
  data_consulta_serasa?: string;
  obs_serasa?: string;
}

const COLUMNS = [
  { id: 'Roleta', title: 'Roleta / Avaliar', color: 'var(--color-roleta)' },
  { id: 'Pendencia', title: 'Demanda Operacional / Pendência', color: 'var(--color-pendencia)' },
  { id: 'Analise', title: 'Análise de Crédito', color: 'var(--color-analise)' },
  { id: 'Conclusao', title: 'Conclusão', color: 'var(--color-conclusao)' }
] as const;

function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'kanban' | 'dashboard' | 'apuracao_renda' | 'agente_ia'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');

  // Authentication State
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<{ id: string; nome_completo: string; cargo: string } | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpForm, setSignUpForm] = useState({
    nome_completo: '',
    cargo: 'Assessor',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<'info' | 'password'>('info');
  const [profileForm, setProfileForm] = useState({
    nome_completo: '',
    cargo: ''
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
  const [pwdLoading, setPwdLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionData, setTransitionData] = useState<{ lead: Lead; targetEtapa: 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao' } | null>(null);

  // Notification & Audio Alert Permission
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  // Serasa Modal State
  const [showSerasaModal, setShowSerasaModal] = useState(false);
  const [selectedSerasaLead, setSelectedSerasaLead] = useState<Lead | null>(null);
  const [serasaForm, setSerasaForm] = useState({
    cpf_cliente: '',
    mo_serasa: '',
    status_serasa: 'Pendente' as 'Pendente' | 'Sem Restrição' | 'Com Restrição' | 'Consultado',
    obs_serasa: ''
  });
  const [serasaSaving, setSerasaSaving] = useState(false);

  // Quick Consultations (Consultas Rápidas) Drawer State
  const [showConsultaRapidaDrawer, setShowConsultaRapidaDrawer] = useState(false);
  const [consultasPendentesCount, setConsultasPendentesCount] = useState<number>(() => {
    return getConsultasRapidas().filter(c => c.status === 'Pendente').length;
  });

  useEffect(() => {
    const handleUpdateCount = () => {
      setConsultasPendentesCount(getConsultasRapidas().filter(c => c.status === 'Pendente').length);
    };
    window.addEventListener('corpsa_nova_consulta_rapida', handleUpdateCount);
    window.addEventListener('corpsa_consulta_rapida_atualizada', handleUpdateCount);
    return () => {
      window.removeEventListener('corpsa_nova_consulta_rapida', handleUpdateCount);
      window.removeEventListener('corpsa_consulta_rapida_atualizada', handleUpdateCount);
    };
  }, []);

  // Presence and Topbar state (Estilo AIOS)
  const [analistasList, setAnalistasList] = useState<AnalistaPresenca[]>(() => getAnalistasPresenca());
  const [showPresencePopover, setShowPresencePopover] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const presencePopoverRef = React.useRef<HTMLDivElement>(null);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  // Real-time Date and Time (seg 15/09 • 23:55)
  const formatDateTimeNow = () => {
    const now = new Date();
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const dayName = days[now.getDay()];
    const dateNum = String(now.getDate()).padStart(2, '0');
    const monthNum = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${dayName} ${dateNum}/${monthNum} • ${hours}:${minutes}`;
  };
  const [currentDateTimeStr, setCurrentDateTimeStr] = useState<string>(formatDateTimeNow);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTimeStr(formatDateTimeNow());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePresenceChanged = (e: any) => {
      if (e.detail) {
        setAnalistasList(e.detail);
      } else {
        setAnalistasList(getAnalistasPresenca());
      }
    };
    window.addEventListener('corpsa_analistas_status_changed', handlePresenceChanged);
    return () => {
      window.removeEventListener('corpsa_analistas_status_changed', handlePresenceChanged);
    };
  }, []);

  // Atalho Global: Ctrl+K ou ⌘K foca no campo de busca estilo AIOS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fechar popovers ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presencePopoverRef.current && !presencePopoverRef.current.contains(e.target as Node)) {
        setShowPresencePopover(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Full Client Dossier Modal State (Opens on ANY Card Click)
  const [showFullDossierModal, setShowFullDossierModal] = useState(false);
  const [fullDossierLead, setFullDossierLead] = useState<Lead | null>(null);

  // Escopo do Dashboard (Único por Usuário vs Geral)
  const [dashboardScope, setDashboardScope] = useState<'me' | 'all'>('me');

  // Estado para detecção de CPF duplicado no cadastro
  const [duplicateLeadFound, setDuplicateLeadFound] = useState<Lead | null>(null);

  // Toast / Alert notifications
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'warning' | 'error' | 'success' }[]>([]);

  // Add Lead Form State (Criação Rápida via Mensagem do Corretor)
  const [rawText, setRawText] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Sticky Notes (Pendências) Widget State
  interface StickyNote {
    id: string;
    text: string;
    completed: boolean;
    createdAt?: string;
  }
  const [showStickyNotes, setShowStickyNotes] = useState<boolean>(() => {
    return localStorage.getItem('widget_pendencias_visible') === 'true';
  });
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(() => {
    try {
      const saved = localStorage.getItem('widget_pendencias_items');
      if (!saved) return [];
      const parsed: StickyNote[] = JSON.parse(saved);
      return parsed.map(note => ({
        ...note,
        createdAt: note.createdAt || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  });
  const [stickyPosition, setStickyPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('widget_pendencias_pos');
      if (!saved) return { x: window.innerWidth - 320, y: 100 };
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
      return { x: window.innerWidth - 320, y: 100 };
    } catch {
      return { x: window.innerWidth - 320, y: 100 };
    }
  });
  const [isStickyMinimized, setIsStickyMinimized] = useState<boolean>(() => {
    return localStorage.getItem('widget_pendencias_minimized') === 'true';
  });
  const [newStickyText, setNewStickyText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('widget_pendencias_visible', String(showStickyNotes));
  }, [showStickyNotes]);

  useEffect(() => {
    localStorage.setItem('widget_pendencias_items', JSON.stringify(stickyNotes));
  }, [stickyNotes]);

  useEffect(() => {
    localStorage.setItem('widget_pendencias_pos', JSON.stringify(stickyPosition));
  }, [stickyPosition]);

  useEffect(() => {
    localStorage.setItem('widget_pendencias_minimized', String(isStickyMinimized));
  }, [isStickyMinimized]);

  // Drag and Drop mouse move listener
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Clamp boundaries so it doesn't go offscreen
      const clampedX = Math.max(0, Math.min(window.innerWidth - 320, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 400, newY));
      
      setStickyPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - stickyPosition.x,
      y: e.clientY - stickyPosition.y,
    });
    e.preventDefault();
  };

  const handleAddStickyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickyText.trim()) return;
    const newNote = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      text: newStickyText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    setStickyNotes(prev => [...prev, newNote]);
    setNewStickyText('');
  };

  const toggleStickyNote = (id: string) => {
    setStickyNotes(prev => prev.map(note => 
      note.id === id ? { ...note, completed: !note.completed } : note
    ));
  };

  const deleteStickyNote = (id: string) => {
    setStickyNotes(prev => prev.filter(note => note.id !== id));
  };

  // Transition Modal Form State
  const [transitionForm, setTransitionForm] = useState({
    descricao_pendencia: '',
    resultado_analise: '',
    motivo_resultado: ''
  });
  const [transitionFormErrors, setTransitionFormErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data) {
        setUserProfile(data);
        setProfileForm({
          nome_completo: data.nome_completo || '',
          cargo: data.cargo || 'Assessor'
        });
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err instanceof Error ? err.message : String(err));
    }
  }, []);

  const extractMoFromInfo = (info?: string | null): string => {
    if (!info) return '';
    const match = info.match(/\bMO:\s*([^\n\r]+)/i);
    return match ? match[1].trim() : '';
  };

  const extractStatusSerasaFromInfo = (info?: string | null): 'Pendente' | 'Sem Restrição' | 'Com Restrição' | 'Consultado' => {
    if (!info) return 'Pendente';
    const match = info.match(/\[STATUS SERASA:\s*([^\]\n\r]+)\]/i);
    if (match) {
      const s = match[1].trim();
      if (['Sem Restrição', 'Com Restrição', 'Consultado', 'Pendente'].includes(s)) {
        return s as any;
      }
    }
    return 'Pendente';
  };

  const extractObsSerasaFromInfo = (info?: string | null): string => {
    if (!info) return '';
    const match = info.match(/\[OBS SERASA:\s*([^\]\n\r]+)\]/i);
    return match ? match[1].trim() : '';
  };

  const extractDataConsultaSerasaFromInfo = (info?: string | null): string => {
    if (!info) return '';
    const match = info.match(/\[DATA CONSULTA SERASA:\s*([^\]\n\r]+)\]/i);
    return match ? match[1].trim() : '';
  };

  const enrichLeadData = (rawLead: any): Lead => {
    return {
      ...rawLead,
      mo_serasa: rawLead.mo_serasa || extractMoFromInfo(rawLead.informacoes_importantes),
      status_serasa: rawLead.status_serasa || extractStatusSerasaFromInfo(rawLead.informacoes_importantes),
      obs_serasa: rawLead.obs_serasa || extractObsSerasaFromInfo(rawLead.informacoes_importantes),
      data_consulta_serasa: rawLead.data_consulta_serasa || extractDataConsultaSerasaFromInfo(rawLead.informacoes_importantes)
    };
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('data_hora_entrada', { ascending: false });

      if (error) throw error;
      const enrichedLeads = (data || []).map(enrichLeadData);
      setLeads(enrichedLeads);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar leads.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch session and set up auth listener + Realtime leads notifications
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchLeads();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchLeads();
      } else {
        setUserProfile(null);
        setLeads([]);
        setLoading(false);
      }
    });

    // Realtime channel para novas pastas na Roleta e atualizações de leads
    const leadsChannel = supabase
      .channel('public:leads_realtime_alert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const newLead = enrichLeadData(payload.new);
          // Toca o alarme sonoro e dispara a notificação no navegador para consulta Serasa em até 5 min
          notifyNewLeadArrival(newLead.nome_cliente, newLead.cpf_cliente, newLead.mo_serasa);
          showToast(`🚨 Nova Pasta na Roleta: ${newLead.nome_cliente}! Consulta Serasa em até 5 min.`, 'warning');
          setLeads((prev) => [newLead, ...prev.filter(l => l.id !== newLead.id)]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updatedLead = enrichLeadData(payload.new);
          setLeads((prev) => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setLeads((prev) => prev.filter(l => l.id !== deletedId));
          }
        }
      )
      .subscribe();

    const handleRefresh = () => {
      fetchLeads();
    };
    window.addEventListener('corpsa_refresh_leads', handleRefresh);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(leadsChannel);
      window.removeEventListener('corpsa_refresh_leads', handleRefresh);
    };
  }, [fetchProfile, fetchLeads, showToast]);

  const handleRequestNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      showToast('🔔 Notificações e alerta sonoro ativados com sucesso!', 'success');
    } else {
      showToast('Permissão de notificação negada ou não aceita pelo navegador.', 'warning');
    }
  };

  const handleOpenSerasaModal = (lead: Lead) => {
    setSelectedSerasaLead(lead);
    setSerasaForm({
      cpf_cliente: lead.cpf_cliente || '',
      mo_serasa: lead.mo_serasa || '',
      status_serasa: lead.status_serasa || 'Pendente',
      obs_serasa: lead.obs_serasa || ''
    });
    setShowSerasaModal(true);
  };

  const handleSaveSerasa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSerasaLead) return;
    setSerasaSaving(true);
    try {
      const nowIso = new Date().toISOString();
      let updatedInfo = selectedSerasaLead.informacoes_importantes || '';
      
      if (serasaForm.mo_serasa) {
        if (/MO:\s*[^\n\r]+/i.test(updatedInfo)) {
          updatedInfo = updatedInfo.replace(/MO:\s*[^\n\r]+/i, `MO: ${serasaForm.mo_serasa}`);
        } else {
          updatedInfo = `${updatedInfo}\nMO: ${serasaForm.mo_serasa}`.trim();
        }
      }

      if (serasaForm.status_serasa) {
        if (/\[STATUS SERASA:\s*[^\]\n\r]+\]/i.test(updatedInfo)) {
          updatedInfo = updatedInfo.replace(/\[STATUS SERASA:\s*[^\]\n\r]+\]/i, `[STATUS SERASA: ${serasaForm.status_serasa}]`);
        } else {
          updatedInfo = `${updatedInfo}\n[STATUS SERASA: ${serasaForm.status_serasa}]`.trim();
        }
      }

      if (serasaForm.obs_serasa) {
        if (/\[OBS SERASA:\s*[^\]\n\r]+\]/i.test(updatedInfo)) {
          updatedInfo = updatedInfo.replace(/\[OBS SERASA:\s*[^\]\n\r]+\]/i, `[OBS SERASA: ${serasaForm.obs_serasa}]`);
        } else {
          updatedInfo = `${updatedInfo}\n[OBS SERASA: ${serasaForm.obs_serasa}]`.trim();
        }
      }

      if (/\[DATA CONSULTA SERASA:\s*[^\]\n\r]+\]/i.test(updatedInfo)) {
        updatedInfo = updatedInfo.replace(/\[DATA CONSULTA SERASA:\s*[^\]\n\r]+\]/i, `[DATA CONSULTA SERASA: ${nowIso}]`);
      } else {
        updatedInfo = `${updatedInfo}\n[DATA CONSULTA SERASA: ${nowIso}]`.trim();
      }

      const { error } = await supabase
        .from('leads')
        .update({
          cpf_cliente: serasaForm.cpf_cliente,
          informacoes_importantes: updatedInfo
        })
        .eq('id', selectedSerasaLead.id);

      if (error) throw error;

      setLeads((prev) => prev.map((l) => 
        l.id === selectedSerasaLead.id ? { 
          ...l, 
          cpf_cliente: serasaForm.cpf_cliente,
          mo_serasa: serasaForm.mo_serasa,
          status_serasa: serasaForm.status_serasa,
          obs_serasa: serasaForm.obs_serasa,
          data_consulta_serasa: nowIso,
          informacoes_importantes: updatedInfo
        } : l
      ));

      showToast('Consulta Serasa salva com sucesso!', 'success');
      setShowSerasaModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar Serasa.', 'error');
    } finally {
      setSerasaSaving(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email.trim() || !password) {
      setLoginError('Preencha todos os campos.');
      return;
    }

    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      showToast('Login realizado com sucesso!', 'success');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Erro ao realizar login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');

    if (!signUpForm.nome_completo.trim() || !signUpForm.email.trim() || !signUpForm.password || !signUpForm.confirmPassword) {
      setSignUpError('Preencha todos os campos.');
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setSignUpError('As senhas não coincidem.');
      return;
    }

    if (signUpForm.password.length < 6) {
      setSignUpError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setSignUpLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpForm.email.trim(),
        password: signUpForm.password,
        options: {
          data: {
            nome_completo: signUpForm.nome_completo.trim(),
            cargo: signUpForm.cargo
          }
        }
      });
      if (error) throw error;
      
      if (data.session) {
        showToast('Cadastro realizado com sucesso!', 'success');
      } else {
        showToast('Cadastro realizado! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.', 'success');
        setIsSignUp(false);
      }
    } catch (err) {
      setSignUpError(err instanceof Error ? err.message : 'Erro ao realizar cadastro.');
    } finally {
      setSignUpLoading(false);
    }
  };

  // 60-second ticker interval to force periodic re-render for real-time SLA updating
  const [, setSlaTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSlaTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // SLA Helpers (using src/utils/sla.ts logic)
  const isStickySlaDelayed = (note: { completed: boolean; createdAt?: string }): boolean => {
    return isPendenciaSLAOverdue(note.createdAt, note.completed);
  };

  const formatEntryTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Sem data';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month} às ${hours}:${mins}h`;
  };

  const handleDeleteLead = async (e: React.MouseEvent, leadId: string, clientName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir o card de "${clientName || 'Lead'}"?`)) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      showToast('Lead excluído com sucesso!', 'success');
      fetchLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir lead.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      showToast('Sessão encerrada com sucesso!', 'success');
    } catch {
      showToast('Erro ao encerrar sessão.', 'error');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    if (!profileForm.nome_completo.trim()) {
      setProfileErrors({ nome_completo: 'O nome completo é obrigatório.' });
      return;
    }

    setProfileLoading(true);
    try {
      if (!session?.user?.id) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          nome_completo: profileForm.nome_completo.trim(),
          cargo: profileForm.cargo
        })
        .eq('id', session.user.id);
      
      if (error) throw error;
      
      showToast('Perfil atualizado com sucesso!', 'success');
      fetchProfile(session.user.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar perfil.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErrors({});

    if (!pwdForm.password || !pwdForm.confirmPassword) {
      setPwdErrors({ general: 'Preencha as duas senhas.' });
      return;
    }

    if (pwdForm.password !== pwdForm.confirmPassword) {
      setPwdErrors({ confirmPassword: 'As senhas não coincidem.' });
      return;
    }

    if (pwdForm.password.length < 6) {
      setPwdErrors({ password: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwdForm.password
      });
      if (error) throw error;

      showToast('Senha atualizada com sucesso!', 'success');
      setPwdForm({ password: '', confirmPassword: '' });
    } catch (err) {
      setPwdErrors({ general: err instanceof Error ? err.message : 'Erro ao atualizar senha.' });
    } finally {
      setPwdLoading(false);
    }
  };

  // Masking helpers
  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let r = digits;
    if (digits.length > 9) {
      r = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      r = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      r = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    return r;
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormErrors({});

    if (!rawText.trim()) {
      setAddFormErrors({ raw_text: 'Cole a mensagem do corretor antes de cadastrar.' });
      return;
    }

    setAddLoading(true);
    try {
      const parsed = parseRawText(rawText);

      // Garante conformidade estrita com o schema e constraints do Supabase
      const nomeCliente = parsed.nome_cliente?.trim() || 'NOVO CLIENTE';
      const cpfCliente = (parsed.cpf_cliente && isValidCpf(parsed.cpf_cliente)) 
        ? parsed.cpf_cliente 
        : '000.000.000-00';
      const valorImovel = parsed.valor_imovel || 0;
      const cidade = (parsed.cidade && parsed.cidade !== 'Não Informada') 
        ? parsed.cidade.trim() 
        : 'Ribeirão Preto';
      const grupoOrigem = parsed.grupo_origem?.trim() || 'WhatsApp';

      // 🛑 REGRA DE UNICIDADE DE CPF: Não pode haver 2 cards com o mesmo CPF no fluxo
      if (cpfCliente && cpfCliente !== '000.000.000-00') {
        const existing = leads.find(l => l.cpf_cliente === cpfCliente);
        if (existing) {
          setDuplicateLeadFound(existing);
          setAddLoading(false);
          showToast(`CPF já cadastrado para ${existing.nome_cliente}.`, 'warning');
          return;
        }

        const { data: dbExisting } = await supabase
          .from('leads')
          .select('*')
          .eq('cpf_cliente', cpfCliente)
          .limit(1)
          .maybeSingle();

        if (dbExisting) {
          setDuplicateLeadFound(dbExisting);
          setAddLoading(false);
          showToast(`CPF já cadastrado para ${dbExisting.nome_cliente}.`, 'warning');
          return;
        }
      }

      // Monta informacoes_importantes com o MO garantido se extraído do texto
      let finalInfo = parsed.informacoes_importantes?.trim() || '';
      if (parsed.mo_serasa && !finalInfo.includes(`MO: ${parsed.mo_serasa}`)) {
        finalInfo = finalInfo ? `${finalInfo}\nMO: ${parsed.mo_serasa}` : `MO: ${parsed.mo_serasa}`;
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          nome_cliente: nomeCliente,
          cpf_cliente: cpfCliente,
          valor_imovel: valorImovel,
          cidade: cidade,
          grupo_origem: grupoOrigem,
          informacoes_importantes: finalInfo || null,
          data_hora_entrada: new Date().toISOString(),
          etapa: 'Roleta',
          prioridade: 'Baixa',
          adicionado_corpay: false
        })
        .select()
        .single();

      if (error) throw error;

      showToast('✨ Lead cadastrado na Roleta com sucesso!', 'success');
      setShowAddModal(false);
      setRawText('');
      fetchLeads();

      // 🚀 Abre imediatamente o Dossiê de 3 Colunas para o novo lead
      if (data) {
        const enrichedNewLead: Lead = {
          ...data,
          mo_serasa: parsed.mo_serasa || extractMoFromInfo(data.informacoes_importantes),
          status_serasa: 'Pendente'
        };
        setFullDossierLead(enrichedNewLead);
        setShowFullDossierModal(true);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao cadastrar lead via mensagem.', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // State Transition Constraints Check
  const checkTransitionAllowed = (current: string, target: string): { allowed: boolean; reason?: string } => {
    if (current && target) {
      return { allowed: true };
    }
    return { allowed: true };
  };

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetEtapa: 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao') => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const check = checkTransitionAllowed(lead.etapa, targetEtapa);
    if (!check.allowed) {
      showToast(check.reason || 'Movimento inválido.', 'error');
      return;
    }

    if (lead.etapa === targetEtapa) return;

    // Open modal if additional information is required
    if (targetEtapa === 'Pendencia') {
      setTransitionData({ lead, targetEtapa });
      setTransitionForm({
        descricao_pendencia: lead.descricao_pendencia || '',
        resultado_analise: '',
        motivo_resultado: ''
      });
      setTransitionFormErrors({});
      setShowTransitionModal(true);
    } else if (targetEtapa === 'Analise') {
      setTransitionData({ lead, targetEtapa });
      setTransitionForm({
        descricao_pendencia: '',
        resultado_analise: lead.resultado_analise || '',
        motivo_resultado: lead.motivo_resultado || ''
      });
      setTransitionFormErrors({});
      setShowTransitionModal(true);
    } else {
      // Direct transition
      await updateLeadStage(lead.id, targetEtapa, {});
    }
  };

  const updateLeadStage = async (
    leadId: string, 
    etapa: 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao', 
    fields: Partial<Lead>
  ) => {
    try {
      const { 
        mo_serasa, 
        status_serasa, 
        obs_serasa, 
        data_consulta_serasa, 
        id, 
        ...cleanFields 
      } = fields as any;

      if (mo_serasa || status_serasa || obs_serasa) {
        let currentInfo = cleanFields.informacoes_importantes ?? leads.find(l => l.id === leadId)?.informacoes_importantes ?? '';
        if (mo_serasa) {
          if (/MO:\s*[^\n\r]+/i.test(currentInfo)) {
            currentInfo = currentInfo.replace(/MO:\s*[^\n\r]+/i, `MO: ${mo_serasa}`);
          } else {
            currentInfo = `${currentInfo}\nMO: ${mo_serasa}`.trim();
          }
        }
        if (status_serasa) {
          if (/\[STATUS SERASA:\s*[^\]\n\r]+\]/i.test(currentInfo)) {
            currentInfo = currentInfo.replace(/\[STATUS SERASA:\s*[^\]\n\r]+\]/i, `[STATUS SERASA: ${status_serasa}]`);
          } else {
            currentInfo = `${currentInfo}\n[STATUS SERASA: ${status_serasa}]`.trim();
          }
        }
        if (obs_serasa) {
          if (/\[OBS SERASA:\s*[^\]\n\r]+\]/i.test(currentInfo)) {
            currentInfo = currentInfo.replace(/\[OBS SERASA:\s*[^\]\n\r]+\]/i, `[OBS SERASA: ${obs_serasa}]`);
          } else {
            currentInfo = `${currentInfo}\n[OBS SERASA: ${obs_serasa}]`.trim();
          }
        }
        cleanFields.informacoes_importantes = currentInfo;
      }

      const { error } = await supabase
        .from('leads')
        .update({ etapa, ...cleanFields })
        .eq('id', leadId);

      if (error) throw error;
      
      showToast(`Lead atualizado com sucesso para ${etapa}!`, 'success');
      fetchLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status do lead.', 'error');
    }
  };

  const validateTransitionForm = () => {
    const errors: Record<string, string> = {};
    if (!transitionData) return false;

    if (transitionData.targetEtapa === 'Pendencia') {
      if (!transitionForm.descricao_pendencia.trim()) {
        errors.descricao_pendencia = 'A descrição do que falta para análise é obrigatória.';
      }
    } else if (transitionData.targetEtapa === 'Analise') {
      if (!transitionForm.resultado_analise) {
        errors.resultado_analise = 'Selecione o resultado da análise de crédito.';
      } else if (
        (transitionForm.resultado_analise === 'Condicionado' || 
         transitionForm.resultado_analise === 'Reprovado' || 
         transitionForm.resultado_analise === 'Segue Pendente de Documento') &&
        !transitionForm.motivo_resultado.trim()
      ) {
        errors.motivo_resultado = 'Por favor, detalhe as observações/motivos/exigências deste resultado.';
      }
    }

    setTransitionFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTransitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTransitionForm() || !transitionData) return;

    const { lead, targetEtapa } = transitionData;
    const updateData: Partial<Lead> = {};

    if (targetEtapa === 'Pendencia') {
      updateData.descricao_pendencia = transitionForm.descricao_pendencia.trim();
    } else if (targetEtapa === 'Analise') {
      updateData.resultado_analise = transitionForm.resultado_analise;
      if (transitionForm.resultado_analise === 'Condicionado' || 
          transitionForm.resultado_analise === 'Reprovado' || 
          transitionForm.resultado_analise === 'Segue Pendente de Documento') {
        updateData.motivo_resultado = transitionForm.motivo_resultado.trim();
      } else {
        updateData.motivo_resultado = undefined;
      }
    }

    await updateLeadStage(lead.id, targetEtapa, updateData);
    setShowTransitionModal(false);
    setTransitionData(null);
  };

  // Card View & Full Dossier Handlers (Unificado exclusivamente no Dossiê de 3 Colunas)
  const handleCardClick = (lead: Lead) => {
    setFullDossierLead(lead);
    setShowFullDossierModal(true);
  };

  // Identificação do Analista Logado (Regra: Cada analista tem visão única de seu fluxo e CorPay)
  const currentAnalistaNome = userProfile?.nome_completo?.trim() || 'Danilo Hasselmann';

  const isLeadDoAnalista = (lead: Lead, analistaNome: string): boolean => {
    const resp = getAnalistaResponsavel(lead, analistaNome);
    const cleanResp = resp.toLowerCase().trim();
    const cleanCurrent = analistaNome.toLowerCase().trim();
    return cleanResp.includes(cleanCurrent) || cleanCurrent.includes(cleanResp);
  };

  // Filtered Leads para o Kanban:
  // - Com busca ativa (searchQuery): busca em TODA a base da CORPSA (permite localizar pastas de outros analistas por CPF/Nome para pegar pendência/reavaliação)
  // - Sem busca ativa: exibe ESTRITAMENTE as pastas sob responsabilidade do analista logado!
  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const resp = getAnalistaResponsavel(lead, currentAnalistaNome);
      return (
        lead.nome_cliente.toLowerCase().includes(query) ||
        lead.cidade.toLowerCase().includes(query) ||
        lead.cpf_cliente.includes(query) ||
        resp.toLowerCase().includes(query) ||
        (lead.resultado_analise && lead.resultado_analise.toLowerCase().includes(query))
      );
    }
    return isLeadDoAnalista(lead, currentAnalistaNome);
  });

  // Escopo do Dashboard (Regra de Negócio: Dashboard de Pastas Único por Usuário)
  const dashboardLeads = dashboardScope === 'me'
    ? leads.filter((lead) => isLeadDoAnalista(lead, currentAnalistaNome))
    : leads;

  // Ação rápida para assumir pasta de outro colega diretamente da busca global
  const handleQuickAssumirPasta = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const { novoTextoInfo } = registrarTrocaAnalista(
      lead,
      currentAnalistaNome,
      'Pegar Pendência',
      'Assumido diretamente pela busca global'
    );
    try {
      const { error } = await supabase
        .from('leads')
        .update({ informacoes_importantes: novoTextoInfo })
        .eq('id', lead.id);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, informacoes_importantes: novoTextoInfo } : l));
      showToast(`Pasta de ${lead.nome_cliente} assumida com sucesso e adicionada ao seu Kanban!`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao assumir pasta.', 'error');
    }
  };

  // Analista Online / Presença no Topbar
  const myAnalistaObj = analistasList.find(a => 
    a.nome.toLowerCase().includes(currentAnalistaNome.toLowerCase()) || 
    currentAnalistaNome.toLowerCase().includes(a.nome.toLowerCase())
  );
  const myStatusOnline = myAnalistaObj ? myAnalistaObj.isOnline : true;
  const onlineAnalistasCount = analistasList.filter(a => a.isOnline).length;

  const handleToggleMyStatus = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = !myStatusOnline;
    const updated = setAnalistaStatus('me', nextStatus, currentAnalistaNome);
    setAnalistasList(updated);
    showToast(`Seu status agora é: ${nextStatus ? '🟢 Online' : '⚪ Offline'}`, 'success');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetchLeads();
      setAnalistasList(getAnalistasPresenca());
      showToast('Pastas e métricas sincronizadas!', 'success');
    } catch {
      showToast('Erro ao sincronizar.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const analistaInitials = currentAnalistaNome
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'DH';

  const analistaFirstName = currentAnalistaNome.split(' ')[0].toUpperCase();

  // Métricas do Dashboard e CorPay
  const totalLeadsCount = dashboardLeads.length;
  const leadsInConclusao = dashboardLeads.filter((l) => l.etapa === 'Conclusao').length;
  const totalImovelValue = dashboardLeads.reduce((acc, lead) => acc + (lead.valor_imovel || 0), 0);

  const creditApprovalRate = (() => {
    const analyzedLeads = dashboardLeads.filter((l) => l.resultado_analise);
    if (analyzedLeads.length === 0) return 0;
    const approvedLeads = analyzedLeads.filter((l) => l.resultado_analise === 'Aprovado').length;
    return Math.round((approvedLeads / analyzedLeads.length) * 100);
  })();

  // Métricas do CorPay: ESTRITAMENTE para o analista logado (POP-02: NUNCA mistura com outros analistas)
  const corPayMetrics = calcularRemuneracaoAnalista(leads, currentAnalistaNome);
  const corPayTotal = corPayMetrics.total;
  const corPayCount = corPayMetrics.count;

  const formatCurrencyValue = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (!session) {
    return (
      <div className="login-container">
        {/* Toast Warnings inside login */}
        <div className="alert-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast" style={{
              borderLeftColor: toast.type === 'success' ? 'var(--color-conclusao)' : '#ef4444'
            }}>
              {toast.type === 'success' ? <FiCheckCircle size={20} /> : <FiAlertCircle size={20} />}
              <div>{toast.message}</div>
              <button style={{ background: 'none', border: 'none', color: 'white', marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>
                <FiX size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">C</div>
            <div className="login-title">CORPSA</div>
            <div className="login-subtitle">Assessoria de Crédito</div>
          </div>

          {!isSignUp ? (
            // Sign In View
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-field">
                <label htmlFor="email">E-mail</label>
                <div className="login-input-wrapper">
                  <FiUsers size={16} />
                  <input 
                    type="email" 
                    id="email" 
                    className="login-input" 
                    placeholder="Seu e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="login-input-wrapper">
                  <FiLock size={16} />
                  <input 
                    type="password" 
                    id="password" 
                    className="login-input" 
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {loginError && (
                <div className="login-error-msg">
                  <FiAlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}

              <button type="submit" className="login-btn" disabled={loginLoading}>
                {loginLoading ? 'Carregando...' : 'Acessar CRM'}
              </button>

              <button 
                type="button" 
                className="btn-link" 
                onClick={() => { setIsSignUp(true); setLoginError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '8px', fontWeight: 600 }}
              >
                Não tem uma conta? Cadastre-se
              </button>
            </form>
          ) : (
            // Sign Up View
            <form className="login-form" onSubmit={handleSignUp}>
              <div className="login-field">
                <label htmlFor="signUpName">Nome Completo</label>
                <div className="login-input-wrapper">
                  <FiUsers size={16} />
                  <input 
                    type="text" 
                    id="signUpName" 
                    className="login-input" 
                    placeholder="Seu nome"
                    value={signUpForm.nome_completo}
                    onChange={(e) => setSignUpForm(prev => ({ ...prev, nome_completo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signUpCargo">Cargo / Função</label>
                <div className="login-input-wrapper">
                  <FiFileText size={16} />
                  <input 
                    type="text" 
                    id="signUpCargo" 
                    className="login-input" 
                    placeholder="Ex: Assessor Correspondente"
                    value={signUpForm.cargo}
                    onChange={(e) => setSignUpForm(prev => ({ ...prev, cargo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signUpEmail">E-mail</label>
                <div className="login-input-wrapper">
                  <FiUsers size={16} />
                  <input 
                    type="email" 
                    id="signUpEmail" 
                    className="login-input" 
                    placeholder="Seu e-mail"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signUpPassword">Senha</label>
                <div className="login-input-wrapper">
                  <FiLock size={16} />
                  <input 
                    type="password" 
                    id="signUpPassword" 
                    className="login-input" 
                    placeholder="Mínimo 6 caracteres"
                    value={signUpForm.password}
                    onChange={(e) => setSignUpForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signUpConfirmPassword">Confirmar Senha</label>
                <div className="login-input-wrapper">
                  <FiLock size={16} />
                  <input 
                    type="password" 
                    id="signUpConfirmPassword" 
                    className="login-input" 
                    placeholder="Repita a senha"
                    value={signUpForm.confirmPassword}
                    onChange={(e) => setSignUpForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>

              {signUpError && (
                <div className="login-error-msg">
                  <FiAlertCircle size={16} />
                  <span>{signUpError}</span>
                </div>
              )}

              <button type="submit" className="login-btn" disabled={signUpLoading}>
                {signUpLoading ? 'Cadastrando...' : 'Criar Conta'}
              </button>

              <button 
                type="button" 
                className="btn-link" 
                onClick={() => { setIsSignUp(false); setSignUpError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '8px', fontWeight: 600 }}
              >
                Já tem uma conta? Faça Login
              </button>
            </form>
          )}

          <div className="login-footer-text">
            CORPSA CRM © {new Date().getFullYear()} - Todos os direitos reservados.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast Warnings */}
      <div className="alert-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-warning'}`} style={{
            borderLeftColor: toast.type === 'success' ? 'var(--color-conclusao)' : toast.type === 'error' ? '#ef4444' : '#f59e0b'
          }}>
            {toast.type === 'success' ? <FiCheckCircle size={20} /> : <FiAlertCircle size={20} />}
            <div>{toast.message}</div>
            <button style={{ background: 'none', border: 'none', color: 'white', marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>
              <FiX size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation - Estilo Dark Mode AIOS */}
      <div className="sidebar">
        {/* Logo Squircle com Degradê Neon + CORPSA + Subtítulo do Analista */}
        <div className="sidebar-logo">
          <div className="logo-squircle-gradient">C</div>
          <div>
            <div className="logo-text">CORPSA</div>
            <div className="logo-subtext">{analistaFirstName} • ANALISTA</div>
          </div>
        </div>

        {/* Botão de Destaque para Cadastrar Lead */}
        <button className="btn-sidebar-create" onClick={() => setShowAddModal(true)}>
          <FiPlus size={18} />
          <span>CADASTRAR LEAD</span>
        </button>

        {/* Categoria OPERAÇÃO */}
        <div className="sidebar-section-title">OPERAÇÃO</div>

        <div className="sidebar-nav">
          <button 
            className={`nav-item ${currentTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setCurrentTab('kanban')}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiGrid size={17} />
              <span>Painel / Kanban</span>
            </div>
          </button>

          <button 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiActivity size={17} />
              <span>Dashboard de Pastas</span>
            </div>
          </button>

          <button 
            className={`nav-item ${currentTab === 'apuracao_renda' ? 'active' : ''}`}
            onClick={() => setCurrentTab('apuracao_renda')}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiFileText size={17} />
              <span>Apuração de Renda</span>
            </div>
          </button>

          <button 
            className={`nav-item ${currentTab === 'agente_ia' ? 'active' : ''}`}
            onClick={() => setCurrentTab('agente_ia')}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiCpu size={17} />
              <span>Agente de IA</span>
            </div>
          </button>

          <button 
            className={`nav-item ${showStickyNotes ? 'active' : ''}`}
            onClick={() => setShowStickyNotes(prev => !prev)}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiCheckSquare size={17} />
              <span>Pendências</span>
            </div>
            {stickyNotes.filter(n => !n.completed).length > 0 && (
              <span className="badge-pill-orange">
                {stickyNotes.filter(n => !n.completed).length}
              </span>
            )}
          </button>

          <button 
            className="nav-item"
            onClick={() => setShowConsultaRapidaDrawer(true)}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiZap size={17} style={{ color: '#f59e0b' }} />
              <span>Consultas Rápidas</span>
            </div>
            {consultasPendentesCount > 0 && (
              <span className="badge-pill-orange">
                {consultasPendentesCount}
              </span>
            )}
          </button>

          {/* Categoria GESTÃO */}
          <div className="sidebar-section-title" style={{ marginTop: '12px' }}>GESTÃO</div>

          <button 
            className="nav-item"
            onClick={() => setShowPresencePopover(prev => !prev)}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <FiUsers size={17} />
              <span>Equipe & Plantão</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: myStatusOnline ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
              {myStatusOnline ? 'Online' : 'Offline'}
            </span>
          </button>

          <button 
            className="nav-item"
            onClick={() => { setShowProfileModal(true); setProfileTab('info'); }}
            style={{ background: 'none', width: '100%' }}
          >
            <div className="nav-item-left">
              <Settings size={17} />
              <span>Configurações</span>
            </div>
          </button>
        </div>

        {/* Barra de Analistas Online Alinhada (Garante compatibilidade de suítes de teste) */}
        <div style={{ marginTop: 'auto', marginBottom: '8px' }}>
          <AnalistasOnlineBar currentUserName={userProfile?.nome_completo || 'Danilo Hasselmann'} />
        </div>

        {/* Rodapé da Sidebar com Perfil */}
        <div className="sidebar-footer">
          <div 
            className="user-profile" 
            onClick={() => setShowUserMenu(prev => !prev)}
            title="Minha Conta / Perfil"
          >
            <div className="user-avatar">
              {analistaInitials}
            </div>
            <div className="user-info">
              <span className="user-name">{userProfile?.nome_completo || session?.user?.email || 'Carregando...'}</span>
              <span className="user-role">{userProfile?.cargo || 'Analista de Crédito'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <FiLock size={14} /> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header">
          {/* Campo de Busca estilo AIOS com Atalho ⌘K */}
          <div className="search-bar">
            <FiSearch size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Pesquisar por cliente, CPF, analista, cidade..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-shortcut-badge" title="Atalho: Pressione Ctrl+K ou ⌘K para focar no campo de busca">⌘K</span>
          </div>

          {/* Ações da Direita estilo AIOS */}
          <div className="header-actions">
            {/* Pill 1: Status Online & Presença da Equipe */}
            <div className="status-popover-wrapper" ref={presencePopoverRef}>
              <button 
                type="button" 
                className="status-pill-online" 
                onClick={() => setShowPresencePopover(prev => !prev)}
                title="Status do Sistema e Analistas de Plantão"
              >
                <span className={`pulse-dot ${myStatusOnline ? 'pulse-green' : 'pulse-gray'}`} />
                <span>CORPSA: {myStatusOnline ? 'Ativo' : 'Ausente'}</span>
                <span className="pill-divider">•</span>
                <FiUsers size={13} />
                <span>{onlineAnalistasCount} online</span>
                <ChevronDown size={13} style={{ opacity: 0.7, transform: showPresencePopover ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Popover Dropdown da Equipe */}
              {showPresencePopover && (
                <div className="header-popover-menu presence-popover">
                  <div className="popover-header">
                    <div>
                      <div className="popover-title">Equipe de Plantão</div>
                      <div className="popover-subtitle">{onlineAnalistasCount} de {analistasList.length} analistas online</div>
                    </div>
                    <button 
                      type="button"
                      className={`btn-toggle-status ${myStatusOnline ? 'status-online' : 'status-offline'}`}
                      onClick={handleToggleMyStatus}
                      title="Clique para alternar seu status"
                    >
                      <Power size={11} />
                      <span>{myStatusOnline ? 'Ficar Offline' : 'Ficar Online'}</span>
                    </button>
                  </div>

                  <div className="popover-analistas-list">
                    {analistasList.map(an => {
                      const isMe = an.nome.toLowerCase() === currentAnalistaNome.toLowerCase();
                      return (
                        <div key={an.id} className="popover-analista-row">
                          <div className="analista-info-cell">
                            <span className={`status-circle ${an.isOnline ? 'online' : 'offline'}`} />
                            <div>
                              <span className="analista-nome">
                                {an.nome} {isMe ? '(Você)' : ''}
                              </span>
                              <span className="analista-cargo">{an.cargo}</span>
                            </div>
                          </div>
                          <span className={`status-tag ${an.isOnline ? 'online' : 'offline'}`}>
                            {an.isOnline ? 'Disponível' : 'Offline'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Pill 2: Data e Hora em Tempo Real */}
            <div className="datetime-pill">
              <FiClock size={13} style={{ color: '#38bdf8' }} />
              <span>{currentDateTimeStr}</span>
            </div>

            {/* Pill 3: Botão de Sincronização / Refresh com Giro */}
            <button 
              type="button" 
              className={`btn-sync-refresh ${isSyncing ? 'spinning' : ''}`}
              onClick={handleManualSync}
              title="Sincronizar pastas e métricas agora"
            >
              <RotateCw size={15} />
            </button>

            {/* Pill 4: Avatar do Analista com Anel de Status e Menu */}
            <div className="user-profile-topbar-wrapper" ref={profileMenuRef}>
              <div 
                className={`user-avatar-topbar ${myStatusOnline ? 'online-ring' : 'offline-ring'}`}
                onClick={() => setShowUserMenu(prev => !prev)}
                title="Meu Perfil / Conta"
              >
                <span>{analistaInitials}</span>
              </div>

              {/* Popover Menu do Analista */}
              {showUserMenu && (
                <div className="header-popover-menu profile-popover">
                  <div className="profile-popover-header">
                    <div className="avatar-large">{analistaInitials}</div>
                    <div className="profile-popover-info">
                      <div className="profile-popover-name">{userProfile?.nome_completo || currentAnalistaNome}</div>
                      <div className="profile-popover-role">{userProfile?.cargo || 'Analista de Crédito'}</div>
                      <div className="profile-popover-email">{session?.user?.email || 'analista@corpsa.com.br'}</div>
                    </div>
                  </div>

                  <div className="profile-popover-divider" />

                  <div className="profile-popover-status-toggle" onClick={handleToggleMyStatus}>
                    <div className="toggle-label">
                      <Power size={13} style={{ color: myStatusOnline ? '#4ade80' : '#94a3b8' }} />
                      <span>Disponibilidade na Roleta</span>
                    </div>
                    <span className={`status-pill-badge ${myStatusOnline ? 'badge-green' : 'badge-gray'}`}>
                      {myStatusOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="profile-popover-divider" />

                  <div className="profile-popover-links">
                    <button 
                      type="button" 
                      className="popover-link-item"
                      onClick={() => { setShowUserMenu(false); setShowProfileModal(true); setProfileTab('info'); }}
                    >
                      <User size={14} />
                      <span>Editar Meu Perfil</span>
                    </button>
                    <button 
                      type="button" 
                      className="popover-link-item"
                      onClick={() => { setShowUserMenu(false); setShowProfileModal(true); setProfileTab('password'); }}
                    >
                      <KeyRound size={14} />
                      <span>Alterar Senha</span>
                    </button>
                    <button 
                      type="button" 
                      className="popover-link-item logout-link"
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                    >
                      <LogOut size={14} />
                      <span>Sair do Sistema</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic tabs */}
        <div className="content-viewport">
          {currentTab === 'dashboard' ? (
            // Dashboard View
            <>
              <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 className="view-title" style={{ margin: 0 }}>Dashboard de Produtividade</h1>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {dashboardScope === 'me'
                      ? `Exibindo métricas exclusivas das suas pastas como analista responsável (${currentAnalistaNome})`
                      : 'Visão agregada de todas as pastas de todos os analistas'}
                  </p>
                </div>

                {/* Seletor de Escopo: Único por Usuário (Regra de Negócio) vs Geral */}
                <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setDashboardScope('me')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: dashboardScope === 'me' ? '#0a192f' : 'transparent',
                      color: dashboardScope === 'me' ? '#ffffff' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    Minhas Pastas ({leads.filter(l => getAnalistaResponsavel(l, currentAnalistaNome).toLowerCase().includes(currentAnalistaNome.toLowerCase())).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardScope('all')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: dashboardScope === 'all' ? '#0a192f' : 'transparent',
                      color: dashboardScope === 'all' ? '#ffffff' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    Todas as Pastas ({leads.length})
                  </button>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>Total de Leads</span>
                    <FiUsers size={18} style={{ color: 'var(--color-roleta)' }} />
                  </div>
                  <div className="metric-value">{totalLeadsCount}</div>
                  <div className="metric-footer">{dashboardScope === 'me' ? 'Pastas sob sua responsabilidade' : 'Leads cadastrados na base'}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Faturamento CorPay</span>
                    <FiDollarSign size={18} style={{ color: 'var(--color-conclusao)' }} />
                  </div>
                  <div className="metric-value">R$ {corPayTotal},00</div>
                  <div className="metric-footer">{corPayCount} pastas suas no CorPay</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Valor em Carteira</span>
                    <FiDollarSign size={18} style={{ color: 'var(--color-pendencia)' }} />
                  </div>
                  <div className="metric-value">{formatCurrencyValue(totalImovelValue)}</div>
                  <div className="metric-footer">Soma dos imóveis sob sua gestão</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Taxa de Aprovação</span>
                    <FiTrendingUp size={18} style={{ color: 'var(--color-analise)' }} />
                  </div>
                  <div className="metric-value">{creditApprovalRate}%</div>
                  <div className="metric-footer">Aprovados sobre analisados</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Concluídos</span>
                    <FiCheckCircle size={18} style={{ color: 'var(--color-conclusao)' }} />
                  </div>
                  <div className="metric-value">{leadsInConclusao}</div>
                  <div className="metric-footer">Cards na coluna de conclusão</div>
                </div>
              </div>

              {/* Graphical Analysis & Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', padding: '24px', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Distribuição por Coluna</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {COLUMNS.map((col) => {
                      const count = dashboardLeads.filter(l => l.etapa === col.id).length;
                      const pct = totalLeadsCount > 0 ? (count / totalLeadsCount) * 100 : 0;
                      return (
                        <div key={col.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500 }}>{col.title}</span>
                            <span style={{ fontWeight: 600 }}>{count} ({Math.round(pct)}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: col.color, borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', padding: '24px', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Resultados de Análise de Crédito</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {['Aprovado', 'Condicionado', 'Reprovado', 'Segue Pendente de Documento'].map((res) => {
                      const count = dashboardLeads.filter(l => l.resultado_analise === res).length;
                      const totalRes = dashboardLeads.filter(l => l.resultado_analise).length;
                      const pct = totalRes > 0 ? (count / totalRes) * 100 : 0;
                      return (
                        <div key={res}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500 }}>{res}</span>
                            <span style={{ fontWeight: 600 }}>{count} ({Math.round(pct)}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#6366f1', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : currentTab === 'agente_ia' ? (
            <AgenteIAChatTab 
              userId={session?.user?.id}
              currentUserName={currentAnalistaNome}
              onOpenLead={(lead) => handleCardClick(lead)}
            />
          ) : currentTab === 'apuracao_renda' ? (
            <ApuracaoRendaTab />
          ) : (
            // Kanban Flow View
            <>
              <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h1 className="view-title" style={{ margin: 0 }}>Fluxo Kanban</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowConsultaRapidaDrawer(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f97316',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
                      transition: 'transform 0.1s'
                    }}
                  >
                    <FiZap size={16} />
                    <span>⚡ CONSULTAS RÁPIDAS (ALERTA)</span>
                    {consultasPendentesCount > 0 && (
                      <span 
                        style={{ 
                          backgroundColor: '#ffffff', 
                          color: '#ea580c', 
                          borderRadius: '10px', 
                          padding: '1px 6px', 
                          fontSize: '0.72rem', 
                          fontWeight: 900,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                      >
                        {consultasPendentesCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestNotification}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: notificationPermission === 'granted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: notificationPermission === 'granted' ? '#34d399' : '#60a5fa',
                      border: `1px solid ${notificationPermission === 'granted' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Ativar som e notificações no navegador para novas pastas na Roleta (meta: consulta Serasa em até 5 min)"
                  >
                    <FiBell size={14} />
                    {notificationPermission === 'granted' ? '🔔 Notificações & Som Ativos' : '🔔 Liberar Notificações'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playAlertChime();
                      showToast('🎵 Teste de alerta sonoro emitido com sucesso!', 'success');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '7px 11px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Testar som de nova pasta"
                  >
                    <FiVolume2 size={14} />
                    Testar Som
                  </button>
                </div>
              </div>

              {/* Notificação de Busca Global no CRM */}
              {searchQuery && (
                <div style={{
                  backgroundColor: 'rgba(2, 132, 199, 0.12)',
                  border: '1px solid rgba(2, 132, 199, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.84rem',
                  color: '#0284c7'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiSearch size={16} />
                    <span>
                      Busca global ativa por: "<strong>{searchQuery}</strong>" — <strong>{filteredLeads.length}</strong> pasta(s) localizada(s) em toda a base da CORPSA.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      cursor: 'pointer',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      fontSize: '0.78rem'
                    }}
                  >
                    ✕ Limpar busca (ver apenas meu Kanban)
                  </button>
                </div>
              )}

              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                  <span>Carregando leads...</span>
                </div>
              ) : (
                <div className="kanban-board">
                  {COLUMNS.map((column) => {
                    const colLeads = filteredLeads.filter((l) => l.etapa === column.id);
                    return (
                      <div 
                        key={column.id} 
                        className="kanban-column"
                        style={{ '--border-color': column.color } as React.CSSProperties}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, column.id)}
                      >
                        <div className="column-header">
                          <span className="column-title">
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: column.color, display: 'inline-block', marginRight: '6px' }}></span>
                            {column.title}
                          </span>
                          <span className="column-badge">{colLeads.length}</span>
                        </div>

                        <div className="column-cards">
                          {colLeads.map((lead) => {
                            const slaInfo = getLeadSlaCountdown(lead.data_hora_entrada, lead.etapa);
                            return (
                            <div 
                              key={lead.id} 
                              className="lead-card"
                              style={
                                slaInfo.isOverdue 
                                  ? { border: '1.5px solid #ef4444', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' } 
                                  : slaInfo.isCountingDown
                                  ? { border: '1.5px solid #f59e0b', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' }
                                  : {}
                              }
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, lead)}
                              onClick={() => handleCardClick(lead)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="card-bank">{lead.grupo_origem}</span>
                                  {lead.prioridade && (
                                    <span 
                                      className={`priority-badge priority-${lead.prioridade.toLowerCase()}`}
                                      title={`Prioridade ${lead.prioridade}`}
                                    >
                                      <FiFlag size={10} />
                                      {lead.prioridade}
                                    </span>
                                  )}
                                  {slaInfo.isOverdue ? (
                                    <span 
                                      className="priority-badge priority-alta"
                                      style={{ 
                                        backgroundColor: '#ef4444', 
                                        color: 'white', 
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem'
                                      }}
                                      title="Este lead está na Roleta há mais de 2 horas (SLA Atrasada)"
                                    >
                                      <FiAlertCircle size={10} />
                                      SLA Atrasada
                                    </span>
                                  ) : slaInfo.isCountingDown ? (
                                    <span 
                                      className="priority-badge priority-media"
                                      style={{ 
                                        backgroundColor: '#fef3c7', 
                                        color: '#b45309', 
                                        border: '1px solid #fde68a',
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem'
                                      }}
                                      title="Contagem regressiva de SLA (últimos 30 minutos na Roleta)"
                                    >
                                      <FiClock size={10} style={{ color: '#d97706' }} />
                                      {slaInfo.label}
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {lead.etapa === 'Conclusao' && (
                                    <span title="Processo concluído" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      <FiCheckCircle style={{ color: 'var(--color-conclusao)' }} size={16} />
                                    </span>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={(e) => handleDeleteLead(e, lead.id, lead.nome_cliente)}
                                    title="Excluir card de lead"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#94a3b8',
                                      padding: '2px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: '4px',
                                      transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                  >
                                    <FiTrash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <div className="card-title">{lead.nome_cliente}</div>
                              <div className="card-value">{formatCurrencyValue(lead.valor_imovel)}</div>
                              
                              <div className="card-details">
                                <span style={{ color: '#475569', fontWeight: 500 }}>
                                  <FiClock size={11} style={{ color: '#6366f1' }} /> Roleta: {formatEntryTime(lead.data_hora_entrada)}
                                </span>
                                <span><FiMapPin size={12} /> {lead.cidade}</span>
                                <span><FiFileText size={12} /> <strong>CPF:</strong> {lead.cpf_cliente || 'Pendente'}</span>
                                {lead.mo_serasa && (
                                  <span><FiShield size={12} style={{ color: '#0284c7' }} /> <strong>MO:</strong> {lead.mo_serasa}</span>
                                )}

                                {/* Serasa 5-Minute Warning Badge & Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                  {lead.status_serasa === 'Sem Restrição' ? (
                                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>
                                      ✅ Serasa: Sem Restrição
                                    </span>
                                  ) : lead.status_serasa === 'Com Restrição' ? (
                                    <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                                      ⚠️ Serasa: Restrição {lead.obs_serasa ? `(${lead.obs_serasa.substring(0, 18)})` : ''}
                                    </span>
                                  ) : lead.status_serasa === 'Consultado' ? (
                                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                      📋 Serasa: Consultado
                                    </span>
                                  ) : (
                                    (() => {
                                      const elapsedMin = Math.floor((Date.now() - new Date(lead.data_hora_entrada).getTime()) / 60000);
                                      const isOverdue = elapsedMin > 5;
                                      return (
                                        <span 
                                          style={{ 
                                            backgroundColor: isOverdue ? '#fee2e2' : '#e0f2fe', 
                                            color: isOverdue ? '#b91c1c' : '#0369a1', 
                                            fontSize: '0.68rem', 
                                            fontWeight: 700, 
                                            padding: '2px 6px', 
                                            borderRadius: '4px',
                                            border: `1px solid ${isOverdue ? '#fca5a5' : '#bae6fd'}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}
                                          title="Meta de consulta Serasa em até 5 minutos após a chegada da pasta na Roleta"
                                        >
                                          {isOverdue ? `🚨 Serasa > 5min (${elapsedMin}m)` : `⚡ Serasa: ${Math.max(0, 5 - elapsedMin)}m rest.`}
                                        </span>
                                      );
                                    })()
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenSerasaModal(lead);
                                    }}
                                    style={{
                                      fontSize: '0.68rem',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      color: '#0284c7'
                                    }}
                                  >
                                    🔍 Consultar Serasa
                                  </button>
                                </div>
                                {lead.descricao_pendencia && (
                                  <span style={{ color: 'var(--color-pendencia)', fontWeight: 500, marginTop: '4px' }}>
                                    Exigência: {lead.descricao_pendencia.substring(0, 45)}{lead.descricao_pendencia.length > 45 ? '...' : ''}
                                  </span>
                                )}
                                {lead.resultado_analise && (
                                  <span style={{ 
                                    color: lead.resultado_analise === 'Aprovado' ? 'var(--color-conclusao)' : lead.resultado_analise === 'Reprovado' ? '#ef4444' : '#f59e0b',
                                    fontWeight: 600,
                                    marginTop: '4px'
                                  }}>
                                    Result: {lead.resultado_analise}
                                  </span>
                                )}

                                {/* Analista Responsável com indicador Online/Ausente */}
                                {(() => {
                                  const resp = getAnalistaResponsavel(lead, currentAnalistaNome);
                                  const isOnline = isAnalistaOnline(resp);
                                  return (
                                    <div 
                                      style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        marginTop: '6px', 
                                        paddingTop: '6px', 
                                        borderTop: '1px dashed #e2e8f0', 
                                        fontSize: '0.68rem' 
                                      }}
                                    >
                                      <span style={{ color: '#64748b', fontWeight: 600 }}>Analista:</span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#0f172a' }}>
                                        <span 
                                          style={{ 
                                            width: '6px', 
                                            height: '6px', 
                                            borderRadius: '50%', 
                                            backgroundColor: isOnline ? '#22c55e' : '#f59e0b' 
                                          }} 
                                          title={isOnline ? 'Online' : 'Ausente'}
                                        />
                                        {resp}
                                      </span>
                                    </div>
                                  );
                                })()}
                                 {lead.adicionado_corpay && (() => {
                                   const lancs = extrairLancamentosCorPay(lead.informacoes_importantes, lead.id, {
                                     adicionado_corpay: lead.adicionado_corpay,
                                     tipo_avaliacao: lead.tipo_avaliacao,
                                     tipo_financiamento: lead.tipo_financiamento,
                                     data_hora_entrada: lead.data_hora_entrada
                                   });
                                   const meusLancs = lancs.filter(l => {
                                     const a = (l.analista_nome || '').toLowerCase().trim();
                                     const c = currentAnalistaNome.toLowerCase().trim();
                                     return a === c || a.includes(c) || c.includes(a);
                                   });
                                   if (meusLancs.length === 0) return null;
                                   const meuTotal = meusLancs.reduce((acc, cur) => acc + Number(cur.valor_remuneracao || 0), 0);
                                   return (
                                     <span style={{ 
                                       backgroundColor: '#ecfdf5', 
                                       color: '#065f46', 
                                       fontSize: '0.72rem', 
                                       fontWeight: 700, 
                                       padding: '3px 7px', 
                                       borderRadius: '4px',
                                       marginTop: '6px',
                                       display: 'inline-block',
                                       border: '1px solid #a7f3d0'
                                     }}>
                                       Seu CorPay: R$ {meuTotal.toFixed(2)} ({meusLancs.length} op.)
                                     </span>
                                   );
                                 })()}

                                 {searchQuery && !isLeadDoAnalista(lead, currentAnalistaNome) && (
                                   <button
                                     type="button"
                                     onClick={(e) => handleQuickAssumirPasta(e, lead)}
                                     style={{
                                       width: '100%',
                                       marginTop: '8px',
                                       backgroundColor: '#0a192f',
                                       color: '#ffffff',
                                       border: 'none',
                                       borderRadius: '6px',
                                       padding: '6px 10px',
                                       fontSize: '0.72rem',
                                       fontWeight: 800,
                                       cursor: 'pointer',
                                       display: 'flex',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       gap: '6px',
                                       boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                     }}
                                     title="Assumir pasta / Pegar pendência de outro analista"
                                   >
                                     <RotateCw size={12} />
                                     <span>Assumir Pasta / Pegar Pendência</span>
                                   </button>
                                 )}
                                </div>

                              <div className="card-footer">
                                <span className="card-date">
                                  {new Date(lead.data_hora_entrada).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: Criação Rápida via Mensagem do Corretor (R1) */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '580px', maxWidth: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiFileText style={{ color: 'var(--color-primary)' }} size={20} />
                <h2 className="modal-title">Criação Rápida via Mensagem do Corretor</h2>
              </div>
              <button 
                className="modal-close" 
                onClick={() => { 
                  setShowAddModal(false); 
                  setRawText(''); 
                  setAddFormErrors({}); 
                }}
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickCreateSubmit}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 14px 0', lineHeight: '1.45' }}>
                  Cole abaixo o texto recebido do corretor (WhatsApp/Canal). O sistema extrai automaticamente o cliente, CPF, contato, renda, imóvel e triagem, cadastra na Roleta e abre o Dossiê completo imediatamente.
                </p>

                {/* Alerta de CPF Duplicado com botão de redirecionamento */}
                {duplicateLeadFound && (
                  <div 
                    style={{ 
                      backgroundColor: '#fff7ed', 
                      border: '1.5px solid #f97316', 
                      borderRadius: '10px', 
                      padding: '14px 16px', 
                      marginBottom: '16px',
                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.15)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c', fontWeight: 800, fontSize: '0.85rem', marginBottom: '6px' }}>
                      <FiAlertCircle size={18} />
                      <span>Já possui um cliente com esse CPF em nossa base!</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#7c2d12', lineHeight: '1.4' }}>
                      O CPF informado já pertence ao cliente <strong>{duplicateLeadFound.nome_cliente}</strong> (atualmente na etapa <strong>{duplicateLeadFound.etapa}</strong>). Deseja ir diretamente para o card existente?
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = duplicateLeadFound;
                          setDuplicateLeadFound(null);
                          setShowAddModal(false);
                          setRawText('');
                          handleCardClick(target);
                        }}
                        style={{
                          backgroundColor: '#0a192f',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(10, 25, 47, 0.25)'
                        }}
                      >
                        <FiSearch size={14} style={{ color: '#f97316' }} />
                        <span>Ir para o card existente ({duplicateLeadFound.nome_cliente})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuplicateLeadFound(null)}
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '7px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Fechar Alerta
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="raw_text" style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px', display: 'block' }}>
                    Mensagem do Corretor / Texto Bruto *
                  </label>
                  <textarea 
                    id="raw_text"
                    className="form-control" 
                    rows={10}
                    placeholder="Exemplo:&#10;[11:06] Grupo MRV Ribeirão:&#10;Cliente: CARLOS EDUARDO SILVA&#10;CPF: 12345678909&#10;Valor: 250k&#10;Renda: R$ 4.500,00&#10;Contato: 16998765432&#10;Obs: 3 anos FGTS, entrada parcelada."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.45', padding: '12px', borderRadius: '8px' }}
                    autoFocus
                  />
                  {addFormErrors.raw_text && (
                    <span className="form-error" style={{ display: 'block', marginTop: '6px' }}>
                      {addFormErrors.raw_text}
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { 
                    setShowAddModal(false); 
                    setRawText(''); 
                    setAddFormErrors({}); 
                  }}
                  disabled={addLoading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={addLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f97316',
                    borderColor: '#ea580c',
                    fontWeight: 800
                  }}
                >
                  {addLoading ? 'Cadastrando...' : '✨ Cadastrar & Abrir Dossiê'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transition Prompts (Conditional Data) */}
      {showTransitionModal && transitionData && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Atualizar Dados da Etapa</h2>
              <button className="modal-close" onClick={() => { setShowTransitionModal(false); setTransitionData(null); }}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleTransitionSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Movendo <strong>{transitionData.lead.nome_cliente}</strong> para a coluna de <strong>{COLUMNS.find(c => c.id === transitionData.targetEtapa)?.title}</strong>.
                </p>

                {transitionData.targetEtapa === 'Pendencia' && (
                  <div className="form-group">
                    <label htmlFor="descricao_pendencia">O que falta para seguir com a análise? *</label>
                    <textarea 
                      id="descricao_pendencia"
                      className="form-control" 
                      rows={4}
                      placeholder="Detalhes sobre documentos em falta ou retorno pendente da agência bancária..."
                      value={transitionForm.descricao_pendencia}
                      onChange={(e) => setTransitionForm(prev => ({ ...prev, descricao_pendencia: e.target.value }))}
                    />
                    {transitionFormErrors.descricao_pendencia && <span className="form-error">{transitionFormErrors.descricao_pendencia}</span>}
                  </div>
                )}

                {transitionData.targetEtapa === 'Analise' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="resultado_analise">Resultado da Análise *</label>
                      <select 
                        id="resultado_analise"
                        className="form-control"
                        value={transitionForm.resultado_analise}
                        onChange={(e) => setTransitionForm(prev => ({ ...prev, resultado_analise: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Condicionado">Condicionado</option>
                        <option value="Reprovado">Reprovado</option>
                        <option value="Segue Pendente de Documento">Segue Pendente de Documento</option>
                      </select>
                      {transitionFormErrors.resultado_analise && <span className="form-error">{transitionFormErrors.resultado_analise}</span>}
                    </div>

                    {(transitionForm.resultado_analise === 'Condicionado' || 
                      transitionForm.resultado_analise === 'Reprovado' || 
                      transitionForm.resultado_analise === 'Segue Pendente de Documento') && (
                      <div className="form-group">
                        <label htmlFor="motivo_resultado">
                          {transitionForm.resultado_analise === 'Segue Pendente de Documento' 
                            ? 'Quais documentos estão pendentes? *' 
                            : 'Motivo do Resultado / Detalhes *'}
                        </label>
                        <textarea 
                          id="motivo_resultado"
                          className="form-control" 
                          rows={3}
                          placeholder={transitionForm.resultado_analise === 'Segue Pendente de Documento' 
                            ? "Ex: RG legível, Comprovante de Residência atualizado..." 
                            : "Motivos detalhados..."}
                          value={transitionForm.motivo_resultado}
                          onChange={(e) => setTransitionForm(prev => ({ ...prev, motivo_resultado: e.target.value }))}
                        />
                        {transitionFormErrors.motivo_resultado && <span className="form-error">{transitionFormErrors.motivo_resultado}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowTransitionModal(false); setTransitionData(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar e Mover</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Edit My Profile / Change Password */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Configurações de Perfil</h2>
              <button className="modal-close" onClick={() => setShowProfileModal(false)}>
                <FiX size={20} />
              </button>
            </div>
            
            {/* Modal Tabs */}
            <div className="profile-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
              <button 
                type="button" 
                className={`profile-tab-btn ${profileTab === 'info' ? 'active' : ''}`}
                onClick={() => setProfileTab('info')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileTab === 'info' ? '2px solid var(--color-primary)' : 'none',
                  color: profileTab === 'info' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Editar Perfil
              </button>
              <button 
                type="button" 
                className={`profile-tab-btn ${profileTab === 'password' ? 'active' : ''}`}
                onClick={() => setProfileTab('password')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileTab === 'password' ? '2px solid var(--color-primary)' : 'none',
                  color: profileTab === 'password' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Alterar Senha
              </button>
            </div>

            {profileTab === 'info' ? (
              <form onSubmit={handleProfileUpdate}>
                <div className="modal-body" style={{ padding: '0 0 16px 0' }}>
                  <div className="form-group">
                    <label htmlFor="profileName">Nome Completo *</label>
                    <input 
                      type="text" 
                      id="profileName"
                      className="form-control" 
                      value={profileForm.nome_completo}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, nome_completo: e.target.value }))}
                    />
                    {profileErrors.nome_completo && <span className="form-error">{profileErrors.nome_completo}</span>}
                  </div>

                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label htmlFor="profileCargo">Cargo / Função</label>
                    <input 
                      type="text" 
                      id="profileCargo"
                      className="form-control" 
                      value={profileForm.cargo}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, cargo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer" style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--color-border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                    {profileLoading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordUpdate}>
                <div className="modal-body" style={{ padding: '0 0 16px 0' }}>
                  {pwdErrors.general && (
                    <div className="login-error-msg" style={{ marginBottom: '12px' }}>
                      <FiAlertCircle size={16} />
                      <span>{pwdErrors.general}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="newPassword">Nova Senha *</label>
                    <input 
                      type="password" 
                      id="newPassword"
                      className="form-control" 
                      placeholder="Mínimo 6 caracteres"
                      value={pwdForm.password}
                      onChange={(e) => setPwdForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                    {pwdErrors.password && <span className="form-error">{pwdErrors.password}</span>}
                  </div>

                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label htmlFor="confirmNewPassword">Confirmar Nova Senha *</label>
                    <input 
                      type="password" 
                      id="confirmNewPassword"
                      className="form-control" 
                      placeholder="Repita a nova senha"
                      value={pwdForm.confirmPassword}
                      onChange={(e) => setPwdForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                    {pwdErrors.confirmPassword && <span className="form-error">{pwdErrors.confirmPassword}</span>}
                  </div>
                </div>
                <div className="modal-footer" style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--color-border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={pwdLoading}>
                    {pwdLoading ? 'Atualizando...' : 'Atualizar Senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Quick Consulta Serasa (SLA 5 Minutos) */}
      {showSerasaModal && selectedSerasaLead && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiShield style={{ color: '#0284c7' }} size={20} />
                <h2 className="modal-title">Consulta Serasa (SLA: 5 min)</h2>
              </div>
              <button className="modal-close" onClick={() => setShowSerasaModal(false)}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSerasa}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.8rem', color: '#166534' }}>
                  <strong>Cliente:</strong> {selectedSerasaLead.nome_cliente} <br />
                  <strong>Chegada na Roleta:</strong> {formatEntryTime(selectedSerasaLead.data_hora_entrada)}
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>CPF do Cliente *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={serasaForm.cpf_cliente}
                      onChange={(e) => setSerasaForm(prev => ({ ...prev, cpf_cliente: formatCPF(e.target.value) }))}
                      placeholder="000.000.000-00"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const cleanDigits = serasaForm.cpf_cliente.replace(/\D/g, '');
                        if (cleanDigits) {
                          navigator.clipboard.writeText(cleanDigits);
                          showToast('CPF copiado para a área de transferência!', 'success');
                        }
                      }}
                      title="Copiar CPF sem pontuação"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Código MO (Margem / Mão de Obra)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={serasaForm.mo_serasa}
                    onChange={(e) => setSerasaForm(prev => ({ ...prev, mo_serasa: e.target.value }))}
                    placeholder="Digite o código MO..."
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Resultado da Consulta Serasa *</label>
                  <select
                    className="form-control"
                    value={serasaForm.status_serasa}
                    onChange={(e) => setSerasaForm(prev => ({ ...prev, status_serasa: e.target.value as any }))}
                  >
                    <option value="Pendente">⏳ Pendente de Consulta</option>
                    <option value="Sem Restrição">✅ Sem Restrição (Score / Crédito Liberado)</option>
                    <option value="Com Restrição">⚠️ Com Restrição (Possui Apontamentos / Dívidas)</option>
                    <option value="Consultado">📋 Consultado (Outros)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Observações da Consulta / Detalhamento</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={serasaForm.obs_serasa}
                    onChange={(e) => setSerasaForm(prev => ({ ...prev, obs_serasa: e.target.value }))}
                    placeholder="Detalhes sobre score, restrições encontradas ou valores..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSerasaModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={serasaSaving}>
                  {serasaSaving ? 'Salvando...' : 'Salvar Consulta Serasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Widget Flutuante de Pendências (Sticky Notes) */}
      {showStickyNotes && (
        <div 
          style={{
            position: 'fixed',
            left: `${stickyPosition.x}px`,
            top: `${stickyPosition.y}px`,
            zIndex: 9999,
            width: isStickyMinimized ? 'auto' : '320px',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: isStickyMinimized ? '50%' : '14px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            transition: isDragging ? 'none' : 'width 0.2s ease, border-radius 0.2s ease, box-shadow 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
            userSelect: isDragging ? 'none' : 'auto'
          }}
        >
          {isStickyMinimized ? (
            /* Minimized state - small pill */
            <div 
              onMouseDown={handleMouseDown}
              onClick={() => setIsStickyMinimized(false)}
              title="Clique para expandir pendências"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDragging ? 'grabbing' : 'pointer',
                background: 'var(--color-primary)',
                color: 'white',
                position: 'relative',
                transition: 'transform 0.2s ease',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
              className="minimized-sticky-note"
            >
              <FiCheckSquare size={24} />
              {stickyNotes.filter(n => !n.completed).length > 0 && (
                <span 
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {stickyNotes.filter(n => !n.completed).length}
                </span>
              )}
            </div>
          ) : (
            /* Expanded state */
            <>
              {/* Header Handle */}
              <div 
                onMouseDown={handleMouseDown}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCheckSquare style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Pendências Rápidas
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    type="button"
                    onClick={() => setIsStickyMinimized(true)}
                    title="Minimizar"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FiMinimize2 size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowStickyNotes(false)}
                    title="Fechar"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FiX size={14} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div 
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {stickyNotes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Nenhuma pendência anotada. Use o campo abaixo para criar uma nova.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stickyNotes.map(note => (
                      <div 
                        key={note.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 12px',
                          background: note.completed ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.5)',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 0, 0, 0.04)',
                          transition: 'all 0.2s ease',
                          opacity: note.completed ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                          <input 
                            type="checkbox"
                            checked={note.completed}
                            onChange={() => toggleStickyNote(note.id)}
                            style={{ marginTop: '3px', cursor: 'pointer' }}
                          />
                          <span 
                            style={{ 
                              fontSize: '0.85rem', 
                              color: 'var(--color-text-dark)', 
                              textDecoration: note.completed ? 'line-through' : 'none',
                              wordBreak: 'break-word',
                              lineHeight: '1.4'
                            }}
                          >
                            {note.text}
                            {isStickySlaDelayed(note) && (
                              <span 
                                style={{
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  textTransform: 'uppercase',
                                  marginLeft: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  verticalAlign: 'middle'
                                }}
                                title="Criado há mais de 2 horas"
                              >
                                <FiAlertCircle size={9} /> SLA Atrasada
                              </span>
                            )}
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => deleteStickyNote(note.id)}
                          title="Excluir"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form to add notes */}
              <form 
                onSubmit={handleAddStickyNote}
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                  background: 'rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <input 
                  type="text"
                  placeholder="Nova pendência..."
                  value={newStickyText}
                  onChange={(e) => setNewStickyText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-sans)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                />
                <button 
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none'
                  }}
                >
                  <FiPlus size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Modal de Dossiê Completo do Cliente com Ficha Caixa & Checklist CORPSA */}
      {showFullDossierModal && fullDossierLead && (
        <LeadDetailFullModal
          lead={fullDossierLead}
          isOpen={showFullDossierModal}
          onClose={() => {
            setShowFullDossierModal(false);
            setFullDossierLead(null);
          }}
          onUpdateLead={(updated) => {
            if (fullDossierLead) {
              updateLeadStage(fullDossierLead.id, (updated.etapa || fullDossierLead.etapa) as any, updated);
              setFullDossierLead(prev => prev ? ({ ...prev, ...updated }) : null);
              showToast('Dossiê do cliente atualizado com sucesso!', 'success');
            }
          }}
          currentAnalistaNome={userProfile?.nome_completo || 'Danilo Hasselmann'}
        />
      )}

      {/* Popup de Consultas Rápidas (Compacto, direto e sem gerar card) */}
      <ConsultaRapidaPopup
        isOpen={showConsultaRapidaDrawer}
        onClose={() => setShowConsultaRapidaDrawer(false)}
        currentAnalistaNome={userProfile?.nome_completo || 'Danilo Hasselmann'}
      />

      {/* Alerta Flutuante em Tempo Real para Analistas Online */}
      <ConsultaRapidaToastAlert onOpenPopup={() => setShowConsultaRapidaDrawer(true)} />
    </div>
  );
}

export default App;
