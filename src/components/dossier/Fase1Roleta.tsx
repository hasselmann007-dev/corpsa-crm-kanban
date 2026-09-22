import React, { useState, useEffect } from 'react';
import { 
  FiUser, 
  FiDollarSign, 
  FiMapPin, 
  FiShield, 
  FiFileText, 
  FiAlertTriangle, 
  FiArrowRight, 
  FiCheck,
  FiSave,
  FiClock,
  FiCopy,
  FiMessageCircle
} from 'react-icons/fi';
import type { Lead } from '../../App';

interface Fase1RoletaProps {
  lead: Lead;
  onAdvanceToAnalise: () => void;
  onReportPendencia: () => void;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
}

export const Fase1Roleta: React.FC<Fase1RoletaProps> = ({
  lead,
  onAdvanceToAnalise,
  onReportPendencia,
  onUpdateLead
}) => {
  const [nomeCliente, setNomeCliente] = useState(lead.nome_cliente || '');
  const [cpfCliente, setCpfCliente] = useState(lead.cpf_cliente || '');
  const [valorImovel, setValorImovel] = useState(lead.valor_imovel?.toString() || '0');
  const [cidade, setCidade] = useState(lead.cidade || 'Ribeirão Preto');
  const [grupoOrigem, setGrupoOrigem] = useState(lead.grupo_origem || 'WhatsApp');
  const [prioridade, setPrioridade] = useState(lead.prioridade || 'Baixa');
  const [statusSerasa, setStatusSerasa] = useState(lead.status_serasa || 'Pendente');
  const [moSerasa, setMoSerasa] = useState(lead.mo_serasa || '');
  const [infoImportantes, setInfoImportantes] = useState(lead.informacoes_importantes || '');
  
  const [telefone, setTelefone] = useState('');
  const [cpfCopied, setCpfCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setNomeCliente(lead.nome_cliente || '');
    setCpfCliente(lead.cpf_cliente || '');
    setValorImovel(lead.valor_imovel?.toString() || '0');
    setCidade(lead.cidade || 'Ribeirão Preto');
    setGrupoOrigem(lead.grupo_origem || 'WhatsApp');
    setPrioridade(lead.prioridade || 'Baixa');
    setStatusSerasa(lead.status_serasa || 'Pendente');
    setMoSerasa(lead.mo_serasa || '');
    setInfoImportantes(lead.informacoes_importantes || '');

    const phoneMatch = lead.informacoes_importantes?.match(/(?:\(?([1-9]{2})\)?\s*)?(?:9\s*)?([0-9]{4})[-.\s]?([0-9]{4})/);
    if (phoneMatch) {
      setTelefone(phoneMatch[0]);
    } else {
      setTelefone('');
    }
  }, [lead]);

  const handleSalvarTudo = () => {
    onUpdateLead({
      nome_cliente: nomeCliente,
      cpf_cliente: cpfCliente,
      valor_imovel: parseFloat(valorImovel) || 0,
      cidade,
      grupo_origem: grupoOrigem,
      prioridade: prioridade as any,
      status_serasa: statusSerasa as any,
      mo_serasa: moSerasa,
      informacoes_importantes: infoImportantes
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCopyCpf = () => {
    const clean = (cpfCliente || '').replace(/\D/g, '');
    if (!clean) return;
    navigator.clipboard.writeText(clean);
    setCpfCopied(true);
    setTimeout(() => setCpfCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const raw = telefone || infoImportantes || '';
    const digits = raw.replace(/\D/g, '');
    const cleanDigits = digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
    if (cleanDigits) {
      window.open(`https://wa.me/${cleanDigits}`, '_blank', 'noopener,noreferrer');
    } else {
      alert('Telefone não identificado para abertura do WhatsApp.');
    }
  };

  const dataChegada = lead.data_hora_entrada 
    ? new Date(lead.data_hora_entrada).toLocaleString('pt-BR') 
    : 'Data não informada';

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
      {/* 1. Header com Ações da Fase 1 */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0a192f', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Fase 1 — Roleta & Informações do Cliente</span>
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
            Dados cadastrais completos, identificação e triagem do proponente para crédito.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onReportPendencia}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fffbeb',
              color: '#d97706',
              border: '1.5px solid #fde68a',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <FiAlertTriangle size={14} />
            <span>Apontar Pendência Operacional</span>
          </button>

          <button
            type="button"
            onClick={onAdvanceToAnalise}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '0.82rem',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s'
            }}
          >
            <span>Encaminhar para Análise de Crédito</span>
            <FiArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 2. Grid de Informações Completas do Cliente (Visível e Elegante) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Bloco 1: Identificação & Contato */}
        <div 
          style={{ 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '12px', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <FiUser size={16} style={{ color: '#0284c7' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Dados Pessoais & Contato
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Nome Completo do Cliente *:
            </label>
            <input 
              type="text"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                  CPF do Cliente *:
                </label>
                <button
                  type="button"
                  onClick={handleCopyCpf}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cpfCopied ? '#16a34a' : '#0284c7',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  {cpfCopied ? <FiCheck size={10} /> : <FiCopy size={10} />}
                  <span>{cpfCopied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <input 
                type="text"
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="000.000.000-00"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Contato / WhatsApp:
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input 
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Abrir WhatsApp"
                >
                  <FiMessageCircle size={14} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Cidade / UF:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px' }}>
                <FiMapPin size={13} style={{ color: '#94a3b8', marginRight: '4px' }} />
                <input 
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', padding: '8px 0', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Data de Entrada:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.76rem', color: '#64748b', padding: '8px 0' }}>
                <FiClock size={13} style={{ marginRight: '5px', color: '#94a3b8' }} />
                <span>{dataChegada}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 2: Dados da Operação & Imóvel */}
        <div 
          style={{ 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '12px', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <FiDollarSign size={16} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Dados da Operação & Imóvel
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Valor Pretendido do Imóvel (R$):
              </label>
              <input 
                type="number"
                value={valorImovel}
                onChange={(e) => setValorImovel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#15803d',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Prioridade da Fila:
              </label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="Baixa">🟢 Baixa</option>
                <option value="Média">🟡 Média</option>
                <option value="Alta">🔴 Alta</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Canal / Grupo de Origem:
              </label>
              <input 
                type="text"
                value={grupoOrigem}
                onChange={(e) => setGrupoOrigem(e.target.value)}
                placeholder="Ex: WhatsApp, Regional, etc."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Situação Serasa / Restrições:
              </label>
              <select
                value={statusSerasa}
                onChange={(e) => setStatusSerasa(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="Pendente">🟡 Pendente</option>
                <option value="Limpo">🟢 Limpo / Apto</option>
                <option value="Restricao">🔴 Com Restrição</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              Código MO Serasa:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px' }}>
              <FiShield size={13} style={{ color: '#94a3b8', marginRight: '4px' }} />
              <input 
                type="text"
                value={moSerasa}
                onChange={(e) => setMoSerasa(e.target.value)}
                placeholder="Ex: MO-98214"
                style={{ width: '100%', border: 'none', outline: 'none', padding: '8px 0', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bloco Completo de Observações da Triagem & Notas do Corretor */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiFileText size={16} style={{ color: '#0a192f' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              Observações Operacionais & Dados da Triagem
            </span>
          </div>

          <button
            type="button"
            onClick={handleSalvarTudo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0a192f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {savedSuccess ? <FiCheck size={14} /> : <FiSave size={14} />}
            <span>{savedSuccess ? 'Salvo com Sucesso!' : 'Salvar Informações do Cliente'}</span>
          </button>
        </div>

        <textarea 
          rows={5}
          value={infoImportantes}
          onChange={(e) => setInfoImportantes(e.target.value)}
          placeholder="Notas enviadas pelo corretor, histórico da triagem, detalhes de renda e composição familiar..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.82rem',
            lineHeight: '1.5',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>
    </div>
  );
};
