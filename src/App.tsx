import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  FiPlus, 
  FiSearch, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiX, 
  FiGrid, 
  FiActivity, 
  FiDollarSign, 
  FiFileText, 
  FiMapPin, 
  FiUsers, 
  FiLock,
  FiTrendingUp,
  FiHelpCircle,
  FiHome
} from 'react-icons/fi';

interface Lead {
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
  const [currentTab, setCurrentTab] = useState<'kanban' | 'dashboard'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');

  // Authentication State
  const [session, setSession] = useState<any>(null);
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

  // Click & Edit Card State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({
    nome_cliente: '',
    cpf_cliente: '',
    valor_imovel: '',
    cidade: '',
    grupo_origem: '',
    informacoes_importantes: '',
    descricao_pendencia: '',
    resultado_analise: '',
    motivo_resultado: '',
    tipo_avaliacao: '',
    tipo_financiamento: '',
    categoria: ''
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Toast / Alert notifications
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'warning' | 'error' | 'success' }[]>([]);

  // Add Lead Form State
  const [newLead, setNewLead] = useState({
    nome_cliente: '',
    cpf_cliente: '',
    valor_imovel: '',
    cidade: '',
    grupo_origem: '',
    informacoes_importantes: ''
  });
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Transition Modal Form State
  const [transitionForm, setTransitionForm] = useState({
    descricao_pendencia: '',
    resultado_analise: '',
    motivo_resultado: ''
  });
  const [transitionFormErrors, setTransitionFormErrors] = useState<Record<string, string>>({});

  // Fetch session and set up auth listener
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

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
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
    } catch (err: any) {
      console.error('Erro ao buscar perfil:', err.message);
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
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
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
        showToast('Cadastro realizado! Se a confirmação de e-mail estiver activa, verifique sua caixa de entrada.', 'success');
        setIsSignUp(false);
      }
    } catch (err: any) {
      setSignUpError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      showToast('Sessão encerrada com sucesso!', 'success');
    } catch (err: any) {
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
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar perfil.', 'error');
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
    } catch (err: any) {
      setPwdErrors({ general: err.message || 'Erro ao atualizar senha.' });
    } finally {
      setPwdLoading(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('data_hora_entrada', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar leads.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
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

  const formatCurrency = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    const numeric = parseFloat(digits) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numeric);
  };

  const parseCurrency = (val: string): number => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return 0;
    return parseFloat(digits) / 100;
  };

  // Validation
  const validateAddForm = () => {
    const errors: Record<string, string> = {};
    if (!newLead.nome_cliente.trim()) errors.nome_cliente = 'Nome do cliente é obrigatório.';
    
    const cpfClean = newLead.cpf_cliente.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      errors.cpf_cliente = 'CPF inválido. Deve possuir 11 dígitos.';
    } else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(newLead.cpf_cliente)) {
      errors.cpf_cliente = 'CPF deve estar no formato 000.000.000-00.';
    }
    
    const value = parseCurrency(newLead.valor_imovel);
    if (!newLead.valor_imovel || value <= 0) {
      errors.valor_imovel = 'Valor do imóvel deve ser maior que R$ 0,00.';
    }
    
    if (!newLead.cidade.trim()) errors.cidade = 'Cidade é obrigatória.';
    if (!newLead.grupo_origem.trim()) errors.grupo_origem = 'Grupo de WhatsApp de origem é obrigatório.';

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    try {
      const { error } = await supabase.from('leads').insert({
        nome_cliente: newLead.nome_cliente.trim(),
        cpf_cliente: newLead.cpf_cliente,
        valor_imovel: parseCurrency(newLead.valor_imovel),
        cidade: newLead.cidade.trim(),
        grupo_origem: newLead.grupo_origem.trim(),
        informacoes_importantes: newLead.informacoes_importantes.trim() || null,
        etapa: 'Roleta'
      });

      if (error) throw error;

      showToast('Lead cadastrado com sucesso!', 'success');
      setShowAddModal(false);
      setNewLead({
        nome_cliente: '',
        cpf_cliente: '',
        valor_imovel: '',
        cidade: '',
        grupo_origem: '',
        informacoes_importantes: ''
      });
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar lead.', 'error');
    }
  };

  // State Transition Constraints Check
  const checkTransitionAllowed = (current: string, target: string): { allowed: boolean; reason?: string } => {
    if (current === target) return { allowed: true };
    
    if (current === 'Roleta') {
      if (target === 'Pendencia' || target === 'Analise') return { allowed: true };
      return { 
        allowed: false, 
        reason: 'A partir de ROLETA / AVALIAR, o lead só pode ir para DEMANDA OPERACIONAL / PENDÊNCIA ou ANÁLISE DE CRÉDITO.' 
      };
    }
    
    if (current === 'Pendencia') {
      if (target === 'Analise') return { allowed: true };
      return { 
        allowed: false, 
        reason: 'A partir de DEMANDA OPERACIONAL / PENDÊNCIA, o lead só pode seguir para ANÁLISE DE CRÉDITO.' 
      };
    }
    
    if (current === 'Analise') {
      if (target === 'Conclusao' || target === 'Pendencia') return { allowed: true };
      return { 
        allowed: false, 
        reason: 'A partir de ANÁLISE DE CRÉDITO, o lead só pode seguir para CONCLUSÃO ou retornar para DEMANDA OPERACIONAL / PENDÊNCIA.' 
      };
    }
    
    if (current === 'Conclusao') {
      // Allow moving back to Analise or Pendencia for re-edits if required,
      // but standard rule blocks arbitrary moves. Let's allow returning to Analise or Pendencia if they need re-evaluation.
      // Wait, let's keep Conclusao transitions blocked unless they edit within the card.
      return { 
        allowed: false, 
        reason: 'Ciclo concluído. Leads na coluna de CONCLUSÃO estão congelados no Kanban.' 
      };
    }

    return { allowed: false, reason: 'Transição não permitida.' };
  };

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    if (lead.etapa === 'Conclusao') {
      e.preventDefault();
      showToast('Cards em Conclusão devem ser editados clicando no card.', 'warning');
      return;
    }
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
      const { error } = await supabase
        .from('leads')
        .update({ etapa, ...fields })
        .eq('id', leadId);

      if (error) throw error;
      
      showToast(`Lead atualizado com sucesso para ${etapa}!`, 'success');
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status do lead.', 'error');
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

  // Card View & Edit Handlers
  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead);
    setEditForm({
      nome_cliente: lead.nome_cliente,
      cpf_cliente: lead.cpf_cliente,
      valor_imovel: formatCurrency((lead.valor_imovel * 100).toFixed(0)),
      cidade: lead.cidade,
      grupo_origem: lead.grupo_origem,
      informacoes_importantes: lead.informacoes_importantes || '',
      descricao_pendencia: lead.descricao_pendencia || '',
      resultado_analise: lead.resultado_analise || '',
      motivo_resultado: lead.motivo_resultado || '',
      tipo_avaliacao: lead.tipo_avaliacao || '',
      tipo_financiamento: lead.tipo_financiamento || '',
      categoria: lead.categoria || ''
    });
    setEditFormErrors({});
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    if (!selectedLead) return false;

    // Only validate client info if the stage is Roleta or Conclusao (since basic fields are only editable there)
    if (selectedLead.etapa === 'Roleta' || selectedLead.etapa === 'Conclusao') {
      if (!editForm.nome_cliente.trim()) errors.nome_cliente = 'Nome do cliente é obrigatório.';
      
      const cpfClean = editForm.cpf_cliente.replace(/\D/g, '');
      if (cpfClean.length !== 11) {
        errors.cpf_cliente = 'CPF inválido. Deve possuir 11 dígitos.';
      } else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(editForm.cpf_cliente)) {
        errors.cpf_cliente = 'CPF deve estar no formato 000.000.000-00.';
      }
      
      const value = parseCurrency(editForm.valor_imovel);
      if (!editForm.valor_imovel || value <= 0) {
        errors.valor_imovel = 'Valor do imóvel deve ser maior que R$ 0,00.';
      }
      
      if (!editForm.cidade.trim()) errors.cidade = 'Cidade é obrigatória.';
      if (!editForm.grupo_origem.trim()) errors.grupo_origem = 'Grupo de WhatsApp de origem é obrigatório.';
    }

    // Only validate Pendencia if current stage is Pendencia or Conclusao (if filled)
    if (selectedLead.etapa === 'Pendencia') {
      if (!editForm.descricao_pendencia.trim()) {
        errors.descricao_pendencia = 'A descrição do que falta para análise é obrigatória.';
      }
    }

    // Only validate Analise if current stage is Analise or Conclusao (if filled)
    if (selectedLead.etapa === 'Analise') {
      if (!editForm.resultado_analise) {
        errors.resultado_analise = 'Selecione o resultado da análise de crédito.';
      } else if (
        (editForm.resultado_analise === 'Condicionado' || 
         editForm.resultado_analise === 'Reprovado' || 
         editForm.resultado_analise === 'Segue Pendente de Documento') &&
        !editForm.motivo_resultado.trim()
      ) {
        errors.motivo_resultado = 'Por favor, detalhe as observações/motivos/exigências deste resultado.';
      }
    }

    // CorPay validation if lead is in Conclusao and trying to add/save with evaluation type selected
    if (selectedLead.etapa === 'Conclusao' && editForm.tipo_avaliacao) {
      if (!editForm.categoria.trim()) {
        errors.categoria = 'A categoria é obrigatória.';
      }
      if (editForm.tipo_avaliacao === 'Nova Avaliação' && !editForm.tipo_financiamento) {
        errors.tipo_financiamento = 'Selecione o tipo de financiamento.';
      }
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (!validateEditForm()) return;

    try {
      const updateData: any = {};

      // If in Roleta or Conclusao, save basic fields
      if (selectedLead.etapa === 'Roleta' || selectedLead.etapa === 'Conclusao') {
        updateData.nome_cliente = editForm.nome_cliente.trim();
        updateData.cpf_cliente = editForm.cpf_cliente;
        updateData.valor_imovel = parseCurrency(editForm.valor_imovel);
        updateData.cidade = editForm.cidade.trim();
        updateData.grupo_origem = editForm.grupo_origem.trim();
        updateData.informacoes_importantes = editForm.informacoes_importantes.trim() || null;
      }

      // If in Pendencia or Conclusao, save pendencia
      if (selectedLead.etapa === 'Pendencia' || selectedLead.etapa === 'Conclusao') {
        updateData.descricao_pendencia = editForm.descricao_pendencia.trim() || null;
      }

      // If in Analise or Conclusao, save credit analysis
      if (selectedLead.etapa === 'Analise' || selectedLead.etapa === 'Conclusao') {
        updateData.resultado_analise = editForm.resultado_analise || null;
        if (editForm.resultado_analise === 'Condicionado' || 
            editForm.resultado_analise === 'Reprovado' || 
            editForm.resultado_analise === 'Segue Pendente de Documento') {
          updateData.motivo_resultado = editForm.motivo_resultado.trim();
        } else {
          updateData.motivo_resultado = null;
        }
      }

      // If in Conclusao, save CorPay details if present
      if (selectedLead.etapa === 'Conclusao') {
        updateData.tipo_avaliacao = editForm.tipo_avaliacao || null;
        updateData.categoria = editForm.categoria.trim() || null;
        updateData.tipo_financiamento = editForm.tipo_avaliacao === 'Nova Avaliação' ? (editForm.tipo_financiamento || null) : null;
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', selectedLead.id);

      if (error) throw error;

      showToast('Lead atualizado com sucesso!', 'success');
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar lead.', 'error');
    }
  };

  const handleAddToCorPay = async () => {
    if (!selectedLead) return;

    const errors: Record<string, string> = {};
    if (!editForm.tipo_avaliacao) {
      errors.tipo_avaliacao = 'Selecione o tipo de avaliação para lançar no CorPay.';
    }
    if (!editForm.categoria.trim()) {
      errors.categoria = 'A categoria é obrigatória para lançar no CorPay.';
    }
    if (editForm.tipo_avaliacao === 'Nova Avaliação' && !editForm.tipo_financiamento) {
      errors.tipo_financiamento = 'Selecione o tipo de financiamento.';
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(prev => ({ ...prev, ...errors }));
      return;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          tipo_avaliacao: editForm.tipo_avaliacao,
          categoria: editForm.categoria.trim(),
          tipo_financiamento: editForm.tipo_avaliacao === 'Reavaliação' ? null : editForm.tipo_financiamento,
          adicionado_corpay: true
        })
        .eq('id', selectedLead.id);

      if (error) throw error;

      showToast('Pasta adicionada ao CorPay com sucesso!', 'success');
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar pasta ao CorPay.', 'error');
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      lead.nome_cliente.toLowerCase().includes(query) ||
      lead.cidade.toLowerCase().includes(query) ||
      lead.cpf_cliente.includes(query) ||
      (lead.resultado_analise && lead.resultado_analise.toLowerCase().includes(query))
    );
  });

  // Productivity Metrics
  const totalLeadsCount = leads.length;
  const totalImovelValue = leads.reduce((acc, lead) => acc + Number(lead.valor_imovel), 0);
  const leadsInConclusao = leads.filter((l) => l.etapa === 'Conclusao').length;
  const creditApprovalRate = (() => {
    const analyzedLeads = leads.filter((l) => l.resultado_analise);
    if (analyzedLeads.length === 0) return 0;
    const approvedLeads = analyzedLeads.filter((l) => l.resultado_analise === 'Aprovado').length;
    return Math.round((approvedLeads / analyzedLeads.length) * 100);
  })();

  // CorPay calculations
  const corPayTotal = leads.reduce((acc, lead) => {
    if (!lead.adicionado_corpay) return acc;
    if (lead.tipo_avaliacao === 'Reavaliação') return acc + 7;
    if (lead.tipo_avaliacao === 'Nova Avaliação') {
      if (lead.tipo_financiamento === 'MCMV') return acc + 12;
      if (lead.tipo_financiamento === 'SBPE') return acc + 13;
    }
    return acc;
  }, 0);

  const corPayCount = leads.filter((l) => l.adicionado_corpay).length;

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

      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">C</div>
          <div>
            <div className="logo-text">CORPSA</div>
            <div className="logo-subtext">Assessoria de Crédito</div>
          </div>
        </div>

        <button className="btn-new-lead" onClick={() => setShowAddModal(true)}>
          <FiPlus size={18} />
          CADASTRAR LEAD
        </button>

        <div className="sidebar-nav">
          <button 
            className={`nav-item ${currentTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setCurrentTab('kanban')}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <FiGrid size={18} />
            Fluxo Kanban
          </button>
          <button 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <FiActivity size={18} />
            Dashboard / Métricas
          </button>
        </div>

        <div className="sidebar-footer">
          <div 
            className="user-profile" 
            onClick={() => setShowProfileModal(true)}
            style={{ cursor: 'pointer', transition: 'var(--transition-fast)' }}
            title="Editar meu perfil / alterar senha"
          >
            <div className="user-avatar">
              {(userProfile?.nome_completo || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{userProfile?.nome_completo || session?.user?.email || 'Carregando...'}</span>
              <span className="user-role">{userProfile?.cargo || 'Assessor'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <FiLock size={14} /> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="header">
          <div className="search-bar">
            <FiSearch size={18} style={{ color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              placeholder="Pesquisar por cliente, CPF, cidade ou resultado..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <div className="action-icon">
              <FiHelpCircle />
            </div>
          </div>
        </div>

        {/* Dynamic tabs */}
        <div className="content-viewport">
          {currentTab === 'dashboard' ? (
            // Dashboard View
            <>
              <div className="view-header">
                <h1 className="view-title">Dashboard de Produtividade</h1>
              </div>

              <div className="dashboard-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>Total de Leads</span>
                    <FiUsers size={18} style={{ color: 'var(--color-roleta)' }} />
                  </div>
                  <div className="metric-value">{totalLeadsCount}</div>
                  <div className="metric-footer">Leads cadastrados na base</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Faturamento CorPay</span>
                    <FiDollarSign size={18} style={{ color: 'var(--color-conclusao)' }} />
                  </div>
                  <div className="metric-value">R$ {corPayTotal},00</div>
                  <div className="metric-footer">{corPayCount} pastas integradas ao CorPay</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Valor em Carteira</span>
                    <FiDollarSign size={18} style={{ color: 'var(--color-pendencia)' }} />
                  </div>
                  <div className="metric-value">{formatCurrencyValue(totalImovelValue)}</div>
                  <div className="metric-footer">Soma dos imóveis sob análise</div>
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
                      const count = leads.filter(l => l.etapa === col.id).length;
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
                      const count = leads.filter(l => l.resultado_analise === res).length;
                      const totalRes = leads.filter(l => l.resultado_analise).length;
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
          ) : (
            // Kanban Flow View
            <>
              <div className="view-header">
                <h1 className="view-title">Fluxo Kanban</h1>
              </div>

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
                          {colLeads.map((lead) => (
                            <div 
                              key={lead.id} 
                              className="lead-card"
                              draggable={lead.etapa !== 'Conclusao'}
                              onDragStart={(e) => handleDragStart(e, lead)}
                              onClick={() => handleCardClick(lead)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="card-bank">{lead.grupo_origem}</span>
                                {lead.etapa === 'Conclusao' && (
                                  <FiCheckCircle style={{ color: 'var(--color-conclusao)' }} title="Processo concluído" />
                                )}
                              </div>
                              <div className="card-title">{lead.nome_cliente}</div>
                              <div className="card-value">{formatCurrencyValue(lead.valor_imovel)}</div>
                              
                              <div className="card-details">
                                <span><FiMapPin size={12} /> {lead.cidade}</span>
                                <span><FiFileText size={12} /> CPF: {lead.cpf_cliente}</span>
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
                                {lead.adicionado_corpay && (
                                  <span style={{ 
                                    backgroundColor: '#ecfdf5', 
                                    color: '#065f46', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    padding: '4px 8px', 
                                    borderRadius: '4px',
                                    marginTop: '6px',
                                    display: 'inline-block',
                                    border: '1px solid #a7f3d0'
                                  }}>
                                    CorPay: {
                                      lead.tipo_avaliacao === 'Reavaliação' ? 'R$ 7,00' :
                                      lead.tipo_financiamento === 'MCMV' ? 'R$ 12,00' : 'R$ 13,00'
                                    } {lead.categoria ? `(${lead.categoria})` : ''}
                                  </span>
                                )}
                              </div>

                              <div className="card-footer">
                                <span className="card-date">
                                  {new Date(lead.data_hora_entrada).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          ))}
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

      {/* Modal: Add Lead */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Cadastrar Novo Lead</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleAddLeadSubmit}>
              <div className="modal-body">
                {/* Informações do Cliente */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                  <FiUsers style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações do Cliente</span>
                </div>

                <div className="form-group">
                  <label htmlFor="nome_cliente">Nome do Cliente *</label>
                  <input 
                    type="text" 
                    id="nome_cliente"
                    className="form-control" 
                    placeholder="Nome completo do proponente"
                    value={newLead.nome_cliente}
                    onChange={(e) => setNewLead(prev => ({ ...prev, nome_cliente: e.target.value }))}
                  />
                  {addFormErrors.nome_cliente && <span className="form-error">{addFormErrors.nome_cliente}</span>}
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label htmlFor="cpf_cliente">CPF do Cliente *</label>
                  <input 
                    type="text" 
                    id="cpf_cliente"
                    className="form-control" 
                    placeholder="000.000.000-00"
                    value={newLead.cpf_cliente}
                    onChange={(e) => setNewLead(prev => ({ ...prev, cpf_cliente: formatCPF(e.target.value) }))}
                  />
                  {addFormErrors.cpf_cliente && <span className="form-error">{addFormErrors.cpf_cliente}</span>}
                </div>

                {/* Informações do Imóvel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '8px' }}>
                  <FiHome style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações do Imóvel</span>
                </div>

                <div className="form-group">
                  <label htmlFor="valor_imovel">Valor do Imóvel *</label>
                  <input 
                    type="text" 
                    id="valor_imovel"
                    className="form-control" 
                    placeholder="R$ 0,00"
                    value={newLead.valor_imovel}
                    onChange={(e) => setNewLead(prev => ({ ...prev, valor_imovel: formatCurrency(e.target.value) }))}
                  />
                  {addFormErrors.valor_imovel && <span className="form-error">{addFormErrors.valor_imovel}</span>}
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label htmlFor="cidade">Cidade *</label>
                  <input 
                    type="text" 
                    id="cidade"
                    className="form-control" 
                    placeholder="Ex: São Paulo"
                    value={newLead.cidade}
                    onChange={(e) => setNewLead(prev => ({ ...prev, cidade: e.target.value }))}
                  />
                  {addFormErrors.cidade && <span className="form-error">{addFormErrors.cidade}</span>}
                </div>

                {/* Origem e Observações */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '8px' }}>
                  <FiFileText style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Origem e Observações</span>
                </div>

                <div className="form-group">
                  <label htmlFor="grupo_origem">Grupo de Origem (WhatsApp/Canal) *</label>
                  <input 
                    type="text" 
                    id="grupo_origem"
                    className="form-control" 
                    placeholder="Ex: WhatsApp ITAU SP"
                    value={newLead.grupo_origem}
                    onChange={(e) => setNewLead(prev => ({ ...prev, grupo_origem: e.target.value }))}
                  />
                  {addFormErrors.grupo_origem && <span className="form-error">{addFormErrors.grupo_origem}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="informacoes_importantes">Informações Importantes (Notas)</label>
                  <textarea 
                    id="informacoes_importantes"
                    className="form-control" 
                    rows={3}
                    placeholder="Observações ou notas relevantes de triagem..."
                    value={newLead.informacoes_importantes}
                    onChange={(e) => setNewLead(prev => ({ ...prev, informacoes_importantes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Cadastrar</button>
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

      {/* Modal: View & Edit Lead Details */}
      {selectedLead && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedLead.etapa === 'Conclusao' ? 'Visualizar Lead (Concluído / Congelado)' : 'Visualizar e Editar Lead'}
              </h2>
              <button className="modal-close" onClick={() => setSelectedLead(null)}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {selectedLead.etapa === 'Conclusao' && (
                  <div style={{ padding: '12px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', border: '1px solid #a7f3d0' }}>
                    <FiCheckCircle size={16} />
                    <span>Este lead está na etapa de Conclusão. Você pode visualizar ou atualizar as informações livremente.</span>
                  </div>
                )}

                {/* If stage is Roleta OR stage is Conclusao: show basic client & property fields */}
                {(selectedLead.etapa === 'Roleta' || selectedLead.etapa === 'Conclusao') && (
                  <>
                    {/* Informações do Cliente */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                      <FiUsers style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações do Cliente</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit_nome_cliente">Nome do Cliente *</label>
                      <input 
                        type="text" 
                        id="edit_nome_cliente"
                        className="form-control" 
                        value={editForm.nome_cliente || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, nome_cliente: e.target.value }))}
                      />
                      {editFormErrors.nome_cliente && <span className="form-error">{editFormErrors.nome_cliente}</span>}
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="edit_cpf_cliente">CPF do Cliente *</label>
                      <input 
                        type="text" 
                        id="edit_cpf_cliente"
                        className="form-control" 
                        value={editForm.cpf_cliente || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, cpf_cliente: formatCPF(e.target.value) }))}
                      />
                      {editFormErrors.cpf_cliente && <span className="form-error">{editFormErrors.cpf_cliente}</span>}
                    </div>

                    {/* Informações do Imóvel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '8px' }}>
                      <FiHome style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações do Imóvel</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit_valor_imovel">Valor do Imóvel *</label>
                      <input 
                        type="text" 
                        id="edit_valor_imovel"
                        className="form-control" 
                        value={editForm.valor_imovel || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, valor_imovel: formatCurrency(e.target.value) }))}
                      />
                      {editFormErrors.valor_imovel && <span className="form-error">{editFormErrors.valor_imovel}</span>}
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="edit_cidade">Cidade *</label>
                      <input 
                        type="text" 
                        id="edit_cidade"
                        className="form-control" 
                        value={editForm.cidade || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, cidade: e.target.value }))}
                      />
                      {editFormErrors.cidade && <span className="form-error">{editFormErrors.cidade}</span>}
                    </div>

                    {/* Origem e Observações */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '8px' }}>
                      <FiFileText style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Origem e Observações</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="edit_grupo_origem">Grupo de Origem (WhatsApp/Canal) *</label>
                      <input 
                        type="text" 
                        id="edit_grupo_origem"
                        className="form-control" 
                        value={editForm.grupo_origem || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, grupo_origem: e.target.value }))}
                      />
                      {editFormErrors.grupo_origem && <span className="form-error">{editFormErrors.grupo_origem}</span>}
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="edit_informacoes_importantes">Informações Importantes (Notas)</label>
                      <textarea 
                        id="edit_informacoes_importantes"
                        className="form-control" 
                        rows={2}
                        value={editForm.informacoes_importantes || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, informacoes_importantes: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {/* If stage is Pendencia OR stage is Conclusao: show Pendencia fields */}
                {(selectedLead.etapa === 'Pendencia' || selectedLead.etapa === 'Conclusao') && (
                  <div style={{ borderTop: (selectedLead.etapa === 'Conclusao') ? '1px dashed var(--color-border)' : 'none', paddingTop: (selectedLead.etapa === 'Conclusao') ? '16px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                      <FiActivity style={{ color: 'var(--color-pendencia)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Demanda Operacional</span>
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="edit_descricao_pendencia">O que falta para seguir com a análise? *</label>
                      <textarea 
                        id="edit_descricao_pendencia"
                        className="form-control" 
                        rows={3}
                        value={editForm.descricao_pendencia || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, descricao_pendencia: e.target.value }))}
                      />
                      {editFormErrors.descricao_pendencia && <span className="form-error">{editFormErrors.descricao_pendencia}</span>}
                    </div>
                  </div>
                )}

                {/* If stage is Analise OR stage is Conclusao: show Analise fields */}
                {(selectedLead.etapa === 'Analise' || selectedLead.etapa === 'Conclusao') && (
                  <div style={{ borderTop: (selectedLead.etapa === 'Conclusao') ? '1px dashed var(--color-border)' : 'none', paddingTop: (selectedLead.etapa === 'Conclusao') ? '16px' : '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                      <FiTrendingUp style={{ color: 'var(--color-analise)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Análise de Crédito</span>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="edit_resultado_analise">Resultado da Análise *</label>
                      <select 
                        id="edit_resultado_analise"
                        className="form-control"
                        value={editForm.resultado_analise || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, resultado_analise: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Condicionado">Condicionado</option>
                        <option value="Reprovado">Reprovado</option>
                        <option value="Segue Pendente de Documento">Segue Pendente de Documento</option>
                      </select>
                      {editFormErrors.resultado_analise && <span className="form-error">{editFormErrors.resultado_analise}</span>}
                    </div>

                    {(editForm.resultado_analise === 'Condicionado' || 
                      editForm.resultado_analise === 'Reprovado' || 
                      editForm.resultado_analise === 'Segue Pendente de Documento') && (
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label htmlFor="edit_motivo_resultado">
                          {editForm.resultado_analise === 'Segue Pendente de Documento' 
                            ? 'Quais documentos estão pendentes? *' 
                            : 'Motivo do Resultado / Detalhes *'}
                        </label>
                        <textarea 
                          id="edit_motivo_resultado"
                          className="form-control" 
                          rows={2}
                          placeholder={editForm.resultado_analise === 'Segue Pendente de Documento' 
                            ? "Ex: RG legível, Comprovante de Residência..." 
                            : "Motivos detalhados..."}
                          value={editForm.motivo_resultado || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, motivo_resultado: e.target.value }))}
                        />
                        {editFormErrors.motivo_resultado && <span className="form-error">{editFormErrors.motivo_resultado}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* CorPay Launch Section (Only in Conclusao stage) */}
                {selectedLead.etapa === 'Conclusao' && (
                  <div style={{ borderTop: '2px solid var(--color-border)', marginTop: '20px', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', marginBottom: '12px' }}>
                      <FiDollarSign style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lançamento no CorPay</span>
                    </div>

                    {selectedLead.adicionado_corpay ? (
                      <div style={{ padding: '12px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #a7f3d0' }}>
                        <FiCheckCircle size={18} />
                        <span>Lançado no CorPay! Taxa: {
                          selectedLead.tipo_avaliacao === 'Reavaliação' ? 'R$ 7,00' :
                          selectedLead.tipo_financiamento === 'MCMV' ? 'R$ 12,00' : 'R$ 13,00'
                        } ({selectedLead.tipo_avaliacao} {selectedLead.tipo_financiamento || ''}) - Categoria: {selectedLead.categoria || 'Não informada'}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="form-group">
                          <label htmlFor="edit_tipo_avaliacao">Tipo de Avaliação *</label>
                          <select
                            id="edit_tipo_avaliacao"
                            className="form-control"
                            value={editForm.tipo_avaliacao}
                            onChange={(e) => setEditForm(prev => ({ ...prev, tipo_avaliacao: e.target.value, tipo_financiamento: e.target.value === 'Reavaliação' ? '' : prev.tipo_financiamento }))}
                          >
                            <option value="">Selecione...</option>
                            <option value="Reavaliação">Reavaliação (R$ 7,00)</option>
                            <option value="Nova Avaliação">Nova Avaliação</option>
                          </select>
                          {editFormErrors.tipo_avaliacao && <span className="form-error">{editFormErrors.tipo_avaliacao}</span>}
                        </div>

                        <div className="form-group">
                          <label htmlFor="edit_categoria">Categoria *</label>
                          <select
                            id="edit_categoria"
                            className="form-control"
                            value={editForm.categoria && !['Residencial', 'Comercial', 'Terreno'].includes(editForm.categoria) ? 'Outro' : editForm.categoria}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditForm(prev => ({ ...prev, categoria: val === 'Outro' ? 'Outro' : val }));
                            }}
                          >
                            <option value="">Selecione...</option>
                            <option value="Residencial">Residencial</option>
                            <option value="Comercial">Comercial</option>
                            <option value="Terreno">Terreno</option>
                            <option value="Outro">Outro (especificar)</option>
                          </select>
                          {editFormErrors.categoria && <span className="form-error">{editFormErrors.categoria}</span>}
                        </div>

                        {(editForm.categoria === 'Outro' || (editForm.categoria && !['Residencial', 'Comercial', 'Terreno'].includes(editForm.categoria))) && (
                          <div className="form-group" style={{ marginTop: '-4px' }}>
                            <label htmlFor="edit_categoria_custom">Especificar Categoria *</label>
                            <input
                              type="text"
                              id="edit_categoria_custom"
                              className="form-control"
                              placeholder="Ex: Misto, Galpão, etc."
                              value={editForm.categoria === 'Outro' ? '' : editForm.categoria}
                              onChange={(e) => setEditForm(prev => ({ ...prev, categoria: e.target.value }))}
                            />
                          </div>
                        )}

                        {editForm.tipo_avaliacao === 'Nova Avaliação' && (
                          <div className="form-group">
                            <label htmlFor="edit_tipo_financiamento">Tipo de Financiamento *</label>
                            <select
                              id="edit_tipo_financiamento"
                              className="form-control"
                              value={editForm.tipo_financiamento}
                              onChange={(e) => setEditForm(prev => ({ ...prev, tipo_financiamento: e.target.value }))}
                            >
                              <option value="">Selecione...</option>
                              <option value="MCMV">MCMV (R$ 12,00)</option>
                              <option value="SBPE">SBPE (R$ 13,00)</option>
                            </select>
                            {editFormErrors.tipo_financiamento && <span className="form-error">{editFormErrors.tipo_financiamento}</span>}
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ alignSelf: 'flex-start', marginTop: '8px', backgroundColor: 'var(--color-conclusao)' }}
                          onClick={handleAddToCorPay}
                        >
                          Adicionar Pasta ao CorPay
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedLead(null)}>
                  Fechar / Cancelar
                </button>
                <button type="submit" className="btn btn-primary">Salvar Alterações</button>
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
                      value={pwdForm.password}
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
    </div>
  );
}

export default App;
