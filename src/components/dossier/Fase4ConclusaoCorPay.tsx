import React, { useState } from 'react';
import { 
  FiCheckCircle, 
  FiDollarSign, 
  FiFileText, 
  FiCheck, 
  FiSave,
  FiZap,
  FiAward
} from 'react-icons/fi';
import type { Lead } from '../../App';

interface Fase4ConclusaoCorPayProps {
  lead: Lead;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
  onAddToCorPay?: (params: {
    tipo_avaliacao: 'Nova Avaliação' | 'Reavaliação';
    tipo_financiamento: 'MCMV' | 'SBPE';
    categoria: string;
  }) => void;
}

export const Fase4ConclusaoCorPay: React.FC<Fase4ConclusaoCorPayProps> = ({
  lead,
  onUpdateLead,
  onAddToCorPay
}) => {
  const [tipoAvaliacao, setTipoAvaliacao] = useState<'Nova Avaliação' | 'Reavaliação'>(
    lead.tipo_avaliacao || 'Nova Avaliação'
  );
  const [tipoFinanciamento, setTipoFinanciamento] = useState<'MCMV' | 'SBPE'>(
    lead.tipo_financiamento || 'MCMV'
  );
  const [categoria, setCategoria] = useState(lead.categoria || 'Residencial');
  const [outraCategoria, setOutraCategoria] = useState('');
  const [adicionadoCorPay, setAdicionadoCorPay] = useState(lead.adicionado_corpay || false);
  const [notasFinais, setNotasFinais] = useState(lead.informacoes_importantes || '');
  const [salvoSuccess, setSalvoSuccess] = useState(false);

  // Regra Oficial CORPSA de Honorários CorPay
  const calcularHonorarios = (): number => {
    if (tipoAvaliacao === 'Reavaliação') {
      return 7.00;
    }
    if (tipoFinanciamento === 'MCMV') {
      return 12.00;
    }
    if (tipoFinanciamento === 'SBPE') {
      return 13.00;
    }
    return 12.00;
  };

  const valorHonorarios = calcularHonorarios();

  const handleEfetivarCorPay = () => {
    const categoriaFinal = categoria === 'Outro' && outraCategoria.trim() 
      ? outraCategoria.trim() 
      : categoria;

    const payload: Partial<Lead> = {
      adicionado_corpay: true,
      tipo_avaliacao: tipoAvaliacao,
      tipo_financiamento: tipoFinanciamento,
      categoria: categoriaFinal
    };

    onUpdateLead(payload);
    setAdicionadoCorPay(true);

    if (onAddToCorPay) {
      onAddToCorPay({
        tipo_avaliacao: tipoAvaliacao,
        tipo_financiamento: tipoFinanciamento,
        categoria: categoriaFinal
      });
    }
  };

  const handleSalvarConsideracoes = () => {
    onUpdateLead({
      informacoes_importantes: notasFinais
    });
    setSalvoSuccess(true);
    setTimeout(() => setSalvoSuccess(false), 2000);
  };

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
              Fase 4 — Conclusão & CorPay (CorpsaPay)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#047857' }}>
              Fechamento do processo de crédito, emissão de parecer e faturamento da pasta no sistema financeiro CorPay.
            </p>
          </div>
        </div>

        <span 
          style={{ 
            backgroundColor: '#059669', 
            color: '#ffffff', 
            padding: '4px 10px', 
            borderRadius: '6px', 
            fontSize: '0.72rem', 
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}
        >
          {adicionadoCorPay ? 'Faturado no CorPay' : 'Aguardando Lançamento'}
        </span>
      </div>

      {/* Painel do Módulo CorPay */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1.5px solid #0f172a', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >
        {/* Header CorPay */}
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
              PAINEL DE FATURAMENTO — CorPay (CorpsaPay)
            </span>
          </div>

          <span 
            style={{ 
              fontSize: '0.7rem', 
              fontWeight: 800, 
              color: '#f97316', 
              backgroundColor: 'rgba(249, 115, 22, 0.15)', 
              padding: '2px 8px', 
              borderRadius: '4px' 
            }}
          >
            Honorários Automáticos
          </span>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {adicionadoCorPay ? (
            <div 
              style={{ 
                backgroundColor: '#f0fdf4', 
                border: '1.5px solid #86efac', 
                borderRadius: '8px', 
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiCheckCircle size={28} style={{ color: '#16a34a' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#15803d' }}>
                    Lead Efetivado com Sucesso no CorPay!
                  </h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#166534' }}>
                    Tipo: <strong>{tipoAvaliacao}</strong> | Financiamento: <strong>{tipoFinanciamento}</strong> | Categoria: <strong>{categoria}</strong>
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700, display: 'block' }}>Taxa Faturada:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                  R$ {valorHonorarios.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Formulário de Lançamento */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {/* 1. Tipo de Avaliação */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    1. Tipo de Avaliação:
                  </label>
                  <select
                    value={tipoAvaliacao}
                    onChange={(e) => setTipoAvaliacao(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Nova Avaliação">Nova Avaliação</option>
                    <option value="Reavaliação">Reavaliação</option>
                  </select>
                </div>

                {/* 2. Categoria do Imóvel */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    2. Categoria do Imóvel:
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Terreno">Terreno</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* 3. Tipo de Financiamento */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    3. Tipo de Financiamento:
                  </label>
                  <select
                    value={tipoFinanciamento}
                    disabled={tipoAvaliacao === 'Reavaliação'}
                    onChange={(e) => setTipoFinanciamento(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: tipoAvaliacao === 'Reavaliação' ? '#f1f5f9' : '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="MCMV">MCMV (Minha Casa Minha Vida)</option>
                    <option value="SBPE">SBPE (Poupança/Mercado)</option>
                  </select>
                </div>
              </div>

              {categoria === 'Outro' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                    Especifique a Categoria:
                  </label>
                  <input 
                    type="text"
                    value={outraCategoria}
                    onChange={(e) => setOutraCategoria(e.target.value)}
                    placeholder="Ex: Galpão Industrial, Chácara..."
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Card Destaque: Cálculo de Honorários */}
              <div 
                style={{ 
                  backgroundColor: '#f8fafc', 
                  border: '1.5px dashed #0284c7', 
                  borderRadius: '10px', 
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 800, fontSize: '0.84rem' }}>
                    <FiZap size={16} />
                    <span>Honorários de Assessoria Calculados:</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {tipoAvaliacao === 'Reavaliação'
                      ? 'Tarifa Fixa de Reavaliação: R$ 7,00'
                      : tipoFinanciamento === 'MCMV'
                      ? 'Tarifa MCMV (Nova Avaliação): R$ 12,00'
                      : 'Tarifa SBPE (Nova Avaliação): R$ 13,00'
                    }
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                    R$ {valorHonorarios.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botão de Efetivação */}
              <button
                type="button"
                onClick={handleEfetivarCorPay}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#0a192f',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(10, 25, 47, 0.25)',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <FiDollarSign size={18} style={{ color: '#f97316' }} />
                <span>🚀 Efetivar Lançamento no CorPay</span>
              </button>
            </>
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
