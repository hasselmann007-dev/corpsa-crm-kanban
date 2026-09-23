import React, { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiFileText, 
  FiCheck, 
  FiSave,
  FiAward,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiUser
} from 'react-icons/fi';
import type { Lead } from '../../App';
import { 
  extrairLancamentosCorPay, 
  serializarLancamentosCorPay, 
  getValorPadraoCorPay,
  type LancamentoCorPay 
} from '../../utils/corpayStore';

interface Fase4ConclusaoCorPayProps {
  lead: Lead;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
  onAddToCorPay?: (params: {
    tipo_avaliacao: 'Nova Avaliação' | 'Reavaliação';
    tipo_financiamento: 'MCMV' | 'SBPE';
    categoria: string;
  }) => void;
  currentAnalistaNome?: string;
}

export const Fase4ConclusaoCorPay: React.FC<Fase4ConclusaoCorPayProps> = ({
  lead,
  onUpdateLead,
  onAddToCorPay,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  // Estado de lançamentos CorPay extraídos das informações do lead
  const [lancamentos, setLancamentos] = useState<LancamentoCorPay[]>(() => {
    return extrairLancamentosCorPay(lead.informacoes_importantes, lead.id, {
      adicionado_corpay: lead.adicionado_corpay,
      tipo_avaliacao: lead.tipo_avaliacao,
      tipo_financiamento: lead.tipo_financiamento,
      data_hora_entrada: lead.data_hora_entrada
    });
  });

  // Atualiza a lista quando o lead muda
  useEffect(() => {
    setLancamentos(
      extrairLancamentosCorPay(lead.informacoes_importantes, lead.id, {
        adicionado_corpay: lead.adicionado_corpay,
        tipo_avaliacao: lead.tipo_avaliacao,
        tipo_financiamento: lead.tipo_financiamento,
        data_hora_entrada: lead.data_hora_entrada
      })
    );
  }, [lead.id, lead.informacoes_importantes, lead.adicionado_corpay, lead.tipo_avaliacao, lead.tipo_financiamento, lead.data_hora_entrada]);

  // Form State para Novo / Editar Lançamento
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTipoServico, setFormTipoServico] = useState<'Avaliação' | 'Reavaliação'>('Avaliação');
  const [formPrograma, setFormPrograma] = useState<'MCMV' | 'SBPE'>('MCMV');
  const [formTipoImovel, setFormTipoImovel] = useState<'Planta' | 'Usado' | 'Novo' | 'Terreno & Construção' | 'Comercial'>('Planta');
  const [formValor, setFormValor] = useState<number>(12.00);
  const [formResultado, setFormResultado] = useState<'Aprovado' | 'Condicionado' | 'Reprovado' | 'Em Análise'>('Aprovado');
  const [formObservacoes, setFormObservacoes] = useState('');

  // Notas finais / Considerações para Contrato
  const [notasFinais, setNotasFinais] = useState(lead.informacoes_importantes || '');
  const [salvoSuccess, setSalvoSuccess] = useState(false);

  // Atualiza o valor padrão ao alterar o tipo de serviço ou programa
  const handleTipoServicoChange = (tipo: 'Avaliação' | 'Reavaliação') => {
    setFormTipoServico(tipo);
    setFormValor(getValorPadraoCorPay(tipo, formPrograma));
  };

  const handleProgramaChange = (prog: 'MCMV' | 'SBPE') => {
    setFormPrograma(prog);
    setFormValor(getValorPadraoCorPay(formTipoServico, prog));
  };

  // Abrir formulário para novo lançamento
  const handleOpenNovo = () => {
    setEditingId(null);
    setFormTipoServico('Avaliação');
    setFormPrograma('MCMV');
    setFormTipoImovel('Planta');
    setFormValor(getValorPadraoCorPay('Avaliação', 'MCMV'));
    setFormResultado((lead.resultado_analise as any) || 'Aprovado');
    setFormObservacoes('');
    setShowForm(true);
  };

  // Abrir formulário para edição de lançamento existente
  const handleOpenEditar = (item: LancamentoCorPay) => {
    setEditingId(item.id);
    setFormTipoServico(item.tipo_servico);
    setFormPrograma(item.programa);
    setFormTipoImovel((item.tipo_imovel as any) || 'Planta');
    setFormValor(item.valor_remuneracao);
    setFormResultado((item.resultado as any) || 'Aprovado');
    setFormObservacoes(item.observacoes || '');
    setShowForm(true);
  };

  // Salvar novo ou editar lançamento
  const handleSalvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    const agora = new Date().toISOString();

    let updatedList: LancamentoCorPay[];

    if (editingId) {
      // Edição
      updatedList = lancamentos.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            tipo_servico: formTipoServico,
            programa: formPrograma,
            tipo_imovel: formTipoImovel,
            valor_remuneracao: Number(formValor),
            resultado: formResultado,
            observacoes: formObservacoes.trim()
          };
        }
        return item;
      });
    } else {
      // Novo Lançamento assinado pelo analista ativo
      const novoLanc: LancamentoCorPay = {
        id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        lead_id: lead.id,
        analista_nome: currentAnalistaNome,
        data_hora: agora,
        tipo_imovel: formTipoImovel,
        programa: formPrograma,
        tipo_servico: formTipoServico,
        valor_remuneracao: Number(formValor),
        resultado: formResultado,
        observacoes: formObservacoes.trim()
      };
      updatedList = [...lancamentos, novoLanc];
    }

    setLancamentos(updatedList);
    setShowForm(false);
    setEditingId(null);

    // Persiste atualizando informacoes_importantes no Supabase
    const novoTextoInfo = serializarLancamentosCorPay(lead.informacoes_importantes || '', updatedList);

    const ultimoLanc = updatedList[updatedList.length - 1];
    onUpdateLead({
      informacoes_importantes: novoTextoInfo,
      adicionado_corpay: true,
      tipo_avaliacao: ultimoLanc.tipo_servico === 'Reavaliação' ? 'Reavaliação' : 'Nova Avaliação',
      tipo_financiamento: ultimoLanc.programa,
      categoria: ultimoLanc.tipo_imovel
    });

    if (onAddToCorPay && ultimoLanc) {
      onAddToCorPay({
        tipo_avaliacao: ultimoLanc.tipo_servico === 'Reavaliação' ? 'Reavaliação' : 'Nova Avaliação',
        tipo_financiamento: ultimoLanc.programa,
        categoria: ultimoLanc.tipo_imovel
      });
    }
  };

  // Excluir lançamento
  const handleExcluirLancamento = (idParaExcluir: string) => {
    if (!confirm('Deseja realmente remover este lançamento do CORPSA Pay?')) return;

    const updatedList = lancamentos.filter(item => item.id !== idParaExcluir);
    setLancamentos(updatedList);

    const novoTextoInfo = serializarLancamentosCorPay(lead.informacoes_importantes || '', updatedList);
    const temLancamentos = updatedList.length > 0;

    onUpdateLead({
      informacoes_importantes: novoTextoInfo,
      adicionado_corpay: temLancamentos
    });
  };

  const handleSalvarConsideracoes = () => {
    onUpdateLead({
      informacoes_importantes: notasFinais
    });
    setSalvoSuccess(true);
    setTimeout(() => setSalvoSuccess(false), 2000);
  };

  // Totais faturados neste cliente
  const totalFaturadoCliente = lancamentos.reduce((acc, cur) => acc + Number(cur.valor_remuneracao || 0), 0);
  const meusLancamentos = lancamentos.filter(l => {
    const a = (l.analista_nome || '').toLowerCase().trim();
    const c = currentAnalistaNome.toLowerCase().trim();
    return a === c || a.includes(c) || c.includes(a);
  });
  const totalMeuNesteCliente = meusLancamentos.reduce((acc, cur) => acc + Number(cur.valor_remuneracao || 0), 0);

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Banner da Fase 4 */}
      <div 
        style={{ 
          backgroundColor: '#ecfdf5', 
          border: '1.5px solid #a7f3d0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              backgroundColor: '#10b981', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FiAward size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#065f46' }}>
              Fase 4 — Conclusão & CORPSA Pay
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#047857' }}>
              Gestão de faturamento individual por analista, avaliação inicial e múltiplas reavaliações do cliente.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            style={{ 
              backgroundColor: lancamentos.length > 0 ? '#059669' : '#64748b', 
              color: '#ffffff', 
              padding: '4px 10px', 
              borderRadius: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            {lancamentos.length > 0 ? `${lancamentos.length} Lançamento(s)` : 'Sem Lançamentos'}
          </span>
        </div>
      </div>

      {/* Painel do Módulo CORPSA Pay */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1.5px solid #0f172a', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >
        {/* Header CORPSA Pay */}
        <div 
          style={{ 
            backgroundColor: '#0a192f', 
            color: '#ffffff', 
            padding: '12px 18px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '3px solid #f97316'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiDollarSign size={18} style={{ color: '#f97316' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.5px' }}>
              CORPSA PAY — Honorários do Cliente
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span 
              style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: '#e2e8f0', 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                padding: '3px 10px', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <FiUser size={12} style={{ color: '#38bdf8' }} />
              Analista: <strong style={{ color: '#38bdf8' }}>{currentAnalistaNome}</strong>
            </span>

            <button
              type="button"
              onClick={handleOpenNovo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f97316',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)'
              }}
            >
              <FiPlus size={14} />
              <span>+ Novo Lançamento</span>
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Métricas Resumidas desta Pasta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block' }}>
                  Total Faturado no Lead:
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  R$ {totalFaturadoCliente.toFixed(2)}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {lancamentos.length} operação(ões)
              </span>
            </div>

            <div 
              style={{ 
                backgroundColor: '#f0fdf4', 
                border: '1.5px solid #86efac', 
                borderRadius: '8px', 
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, display: 'block' }}>
                  Sua Remuneração Nesta Pasta:
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                  R$ {totalMeuNesteCliente.toFixed(2)}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 700 }}>
                {meusLancamentos.length} lançamento(s) seu(s)
              </span>
            </div>
          </div>

          {/* Lista de Lançamentos */}
          {lancamentos.length === 0 ? (
            <div 
              style={{ 
                backgroundColor: '#f8fafc', 
                border: '1.5px dashed #cbd5e1', 
                borderRadius: '8px', 
                padding: '24px', 
                textAlign: 'center' 
              }}
            >
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                Nenhum lançamento registrado no CORPSA Pay para esta pasta.
              </p>
              <button
                type="button"
                onClick={handleOpenNovo}
                style={{
                  marginTop: '10px',
                  backgroundColor: '#0a192f',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                + Faturar Avaliação Inicial ou Reavaliação
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lancamentos.map((item, index) => {
                const dataFormatada = item.data_hora 
                  ? new Date(item.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
                    new Date(item.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : 'N/D';

                const isMeu = (item.analista_nome || '').toLowerCase().includes(currentAnalistaNome.toLowerCase());

                return (
                  <div 
                    key={item.id || index}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                      <span 
                        style={{
                          backgroundColor: item.tipo_servico === 'Reavaliação' ? '#fef3c7' : '#e0f2fe',
                          color: item.tipo_servico === 'Reavaliação' ? '#92400e' : '#0369a1',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}
                      >
                        {item.tipo_servico}
                      </span>

                      <span 
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}
                      >
                        {item.programa}
                      </span>

                      <span 
                        style={{
                          fontSize: '0.75rem',
                          color: '#475569',
                          fontWeight: 600
                        }}
                      >
                        {item.tipo_imovel}
                      </span>

                      <span 
                        style={{
                          fontSize: '0.72rem',
                          color: isMeu ? '#0284c7' : '#64748b',
                          fontWeight: isMeu ? 800 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <FiUser size={11} />
                        {item.analista_nome || 'Danilo Hasselmann'}
                      </span>

                      <span 
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <FiClock size={11} />
                        {dataFormatada}
                      </span>

                      {item.observacoes && (
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            color: '#64748b',
                            fontStyle: 'italic',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={item.observacoes}
                        >
                          "{item.observacoes}"
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span 
                        style={{
                          fontSize: '1rem',
                          fontWeight: 900,
                          color: '#15803d'
                        }}
                      >
                        R$ {Number(item.valor_remuneracao).toFixed(2)}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditar(item)}
                          title="Editar lançamento"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirLancamento(item.id)}
                          title="Excluir lançamento"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal / Formulário de Inclusão e Edição */}
          {showForm && (
            <div 
              style={{
                backgroundColor: '#f8fafc',
                border: '1.5px solid #38bdf8',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingId ? '✏️ Editar Lançamento CorPay' : '➕ Novo Lançamento no CorPay'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Analista: <strong>{currentAnalistaNome}</strong>
                </span>
              </div>

              <form onSubmit={handleSalvarLancamento} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  
                  {/* Tipo de Serviço */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Serviço:
                    </label>
                    <select
                      value={formTipoServico}
                      onChange={(e) => handleTipoServicoChange(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="Avaliação">Avaliação (Inicial)</option>
                      <option value="Reavaliação">Reavaliação (R$ 7,00)</option>
                    </select>
                  </div>

                  {/* Programa */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Programa:
                    </label>
                    <select
                      value={formPrograma}
                      onChange={(e) => handleProgramaChange(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="MCMV">MCMV (Minha Casa Minha Vida)</option>
                      <option value="SBPE">SBPE (Poupança/Mercado)</option>
                    </select>
                  </div>

                  {/* Tipo do Imóvel */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Imóvel:
                    </label>
                    <select
                      value={formTipoImovel}
                      onChange={(e) => setFormTipoImovel(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="Planta">Planta</option>
                      <option value="Usado">Usado</option>
                      <option value="Novo">Novo</option>
                      <option value="Terreno & Construção">Terreno & Constr.</option>
                      <option value="Comercial">Comercial</option>
                    </select>
                  </div>

                  {/* Valor da Remuneração */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Honorários (R$):
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={formValor}
                      onChange={(e) => setFormValor(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: '#15803d',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                  {/* Resultado da Pasta */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Resultado:
                    </label>
                    <select
                      value={formResultado}
                      onChange={(e) => setFormResultado(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="Aprovado">Aprovado</option>
                      <option value="Condicionado">Condicionado</option>
                      <option value="Reprovado">Reprovado</option>
                      <option value="Em Análise">Em Análise</option>
                    </select>
                  </div>

                  {/* Observações */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                      Notas / Detalhes do Lançamento:
                    </label>
                    <input
                      type="text"
                      value={formObservacoes}
                      onChange={(e) => setFormObservacoes(e.target.value)}
                      placeholder="Ex: Reavaliação solicitada pelo corretor após inclusão de cônjuge"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.76rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#0a192f',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <FiCheck size={13} />
                    <span>Salvar no CORPSA Pay</span>
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Considerações Finais do Crédito */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiFileText size={16} style={{ color: '#0284c7' }} />
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
              Considerações Finais & Instruções para Contrato:
            </label>
          </div>

          <button
            type="button"
            onClick={handleSalvarConsideracoes}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: salvoSuccess ? '#16a34a' : '#0284c7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {salvoSuccess ? <FiCheck size={12} /> : <FiSave size={12} />}
            <span>{salvoSuccess ? 'Salvo!' : 'Salvar Considerações'}</span>
          </button>
        </div>

        <textarea 
          rows={4}
          value={notasFinais}
          onChange={(e) => setNotasFinais(e.target.value)}
          placeholder="Instruções para a agência Caixa, dados da conta do proponente para débito da prestação, data prevista de assinatura do contrato..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.78rem',
            lineHeight: '1.4',
            boxSizing: 'border-box'
          }}
        />
      </div>
    </div>
  );
};
