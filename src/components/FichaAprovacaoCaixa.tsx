import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  CheckSquare, 
  Copy, 
  Save, 
  Check, 
  UploadCloud, 
  Edit3, 
  Download, 
  Cpu, 
  Loader2,
  Home,
  User,
  CreditCard,
  Clock,
  BarChart2,
  Percent,
  Calendar,
  DollarSign
} from 'lucide-react';
import { exportarSimulacaoCaixaDoc } from '../utils/sicaqDocExporter';
import { exportarSimulacaoCaixaPdf, formatTaxa2Decimais } from '../utils/sicaqPdfExporter';
import { extrairSicaqComGemini36 } from '../utils/sicaqExtractor';
import type { FichaCaixaData } from '../types/consultaRapida';

interface FichaAprovacaoCaixaProps {
  initialData?: Partial<FichaCaixaData>;
  onSave?: (data: FichaCaixaData) => void;
  readonly?: boolean;
}

export const FichaAprovacaoCaixa: React.FC<FichaAprovacaoCaixaProps> = ({
  initialData,
  onSave,
  readonly = false
}) => {
  const [formData, setFormData] = useState<FichaCaixaData>({
    cliente: initialData?.cliente || '',
    cpf: initialData?.cpf || '',
    programa: initialData?.programa || (initialData?.tipo_imovel?.includes('SBPE') ? 'SBPE' : 'MCMV'),
    tipo_imovel: initialData?.tipo_imovel || 'Planta',
    modalidade_imovel: initialData?.modalidade_imovel || 'Planta',
    valor_imovel: initialData?.valor_imovel || 0,
    valor_financiamento: initialData?.valor_financiamento || 0,
    valor_entrada: initialData?.valor_entrada || 0,
    prazo_meses: initialData?.prazo_meses || 420,
    sistema_amortizacao: initialData?.sistema_amortizacao || 'PRICE',
    taxa_juros_nominal: initialData?.taxa_juros_nominal || '5.50',
    taxa_juros_efetiva: initialData?.taxa_juros_efetiva || '5.64',
    primeira_prestacao: initialData?.primeira_prestacao || 0,
    fator_social_aplicado: initialData?.fator_social_aplicado ?? true,
    fgts_36_meses_comprovado: initialData?.fgts_36_meses_comprovado ?? true,
    restricoes_externas_limpas: initialData?.restricoes_externas_limpas ?? true,
    possui_imovel_pesquisas: initialData?.possui_imovel_pesquisas ?? false,
    irpf_apresentado: initialData?.irpf_apresentado ?? false,
    pendencias_checklist: initialData?.pendencias_checklist || {
      fator_social: '',
      fgts_36_meses: '',
      restricoes_externas: '',
      possui_imovel_pesquisas: '',
      irpf_apresentado: ''
    },
    validade_avaliacao: initialData?.validade_avaliacao || new Date(Date.now() + 90 * 86400000).toLocaleDateString('pt-BR'),
    analista_responsavel: initialData?.analista_responsavel || 'Danilo Hasselmann'
  });

  const [sicaqFile, setSicaqFile] = useState<File | null>(null);
  const [isProcessingSicaq, setIsProcessingSicaq] = useState(false);
  const [sicaqSuccessMsg, setSicaqSuccessMsg] = useState('');
  const [valorImovelAjuste, setValorImovelAjuste] = useState<string>(
    initialData?.valor_imovel ? initialData.valor_imovel.toString() : ''
  );
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isManualEditMode, setIsManualEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedKeyRef = useRef<string>('');

  useEffect(() => {
    const currentKey = `${initialData?.cliente || ''}-${initialData?.cpf || ''}-${initialData?.valor_imovel || 0}`;
    if (initialData && hasInitializedKeyRef.current !== currentKey) {
      hasInitializedKeyRef.current = currentKey;
      setFormData(prev => ({
        ...prev,
        cliente: initialData.cliente || prev.cliente,
        cpf: initialData.cpf || prev.cpf,
        valor_imovel: (prev.valor_imovel && prev.valor_imovel > 0) ? prev.valor_imovel : (initialData.valor_imovel ?? prev.valor_imovel),
        analista_responsavel: initialData.analista_responsavel || prev.analista_responsavel
      }));
      if (initialData.valor_imovel && (!formData.valor_imovel || formData.valor_imovel === 0)) {
        setValorImovelAjuste(initialData.valor_imovel.toString());
      }
    }
  }, [initialData?.cliente, initialData?.cpf, initialData?.valor_imovel, initialData?.analista_responsavel, formData.valor_imovel]);

  // Recalcula Entrada e Financiamento ao ajustar valor do imóvel
  const handleAjustarValorImovel = (novoValorStr: string) => {
    setValorImovelAjuste(novoValorStr);
    const novoValor = parseFloat(novoValorStr) || 0;
    
    setFormData(prev => {
      let novoFinanc = prev.valor_financiamento;
      let novaEntrada = prev.valor_entrada;

      if (novoValor > 0) {
        if (novoFinanc === 0) {
          novoFinanc = Math.round(novoValor * 0.8);
          novaEntrada = novoValor - novoFinanc;
        } else {
          novaEntrada = Math.max(0, novoValor - novoFinanc);
        }
      }

      return {
        ...prev,
        valor_imovel: novoValor,
        valor_financiamento: novoFinanc,
        valor_entrada: novaEntrada
      };
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.split(',')[1] || res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Upload e leitura do SICAQ via Gemini 3.6
  const handleSicaqFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSicaqFile(file);
    setIsProcessingSicaq(true);
    setSicaqSuccessMsg('');

    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      let extracted: any = null;

      // 1. Tenta via backend /api/sicaq/extrair-pdf
      try {
        const backendRes = await fetch('/api/sicaq/extrair-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: base64Data,
            mimeType,
            filename: file.name
          })
        });

        if (backendRes.ok) {
          const bJson = await backendRes.json();
          if (bJson.success && bJson.data) {
            extracted = bJson.data;
          }
        }
      } catch (_backendErr) {
        console.warn('Backend SICAQ endpoint indisponível, usando extração direta...');
      }

      // 2. Fallback direto no navegador usando extrairSicaqComGemini36
      if (!extracted) {
        extracted = await extrairSicaqComGemini36(base64Data, mimeType);
      }

      if (extracted) {
        const vImovel = extracted.valor_imovel || formData.valor_imovel;
        const vFinanc = extracted.valor_financiamento || formData.valor_financiamento;
        const vEntrada = extracted.valor_entrada || (vImovel > vFinanc ? vImovel - vFinanc : formData.valor_entrada);

        const updatedData: FichaCaixaData = {
          ...formData,
          cliente: extracted.cliente || formData.cliente,
          cpf: extracted.cpf || formData.cpf,
          programa: extracted.programa || (extracted.tipo_imovel?.includes('SBPE') ? 'SBPE' : 'MCMV'),
          tipo_imovel: (extracted.tipo_imovel || formData.tipo_imovel || 'Planta') as any,
          modalidade_imovel: extracted.tipo_imovel || formData.tipo_imovel || 'Planta',
          valor_imovel: vImovel,
          valor_financiamento: vFinanc,
          valor_entrada: Math.max(0, vEntrada),
          prazo_meses: extracted.prazo_meses || formData.prazo_meses,
          sistema_amortizacao: (extracted.sistema_amortizacao === 'SAC' ? 'SAC' : 'PRICE') as 'SAC' | 'PRICE',
          taxa_juros_nominal: extracted.taxa_juros_nominal || formData.taxa_juros_nominal,
          taxa_juros_efetiva: extracted.taxa_juros_efetiva || formData.taxa_juros_efetiva,
          primeira_prestacao: extracted.primeira_prestacao || formData.primeira_prestacao,
          cidade: extracted.cidade || formData.cidade,
          validade_avaliacao: extracted.validade_avaliacao || formData.validade_avaliacao,
          fator_social_aplicado: extracted.fator_social_aplicado ?? true,
          fgts_36_meses_comprovado: extracted.fgts_36_meses_comprovado ?? true,
          restricoes_externas_limpas: true,
          possui_imovel_pesquisas: false
        };

        setFormData(updatedData);

        if (vImovel > 0) {
          setValorImovelAjuste(vImovel.toString());
        }

        setSicaqSuccessMsg(
          `✨ Simulação preenchida com sucesso via Gemini 3.6! Imóvel: R$ ${vImovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Financiamento: R$ ${vFinanc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        );

        onSave?.(updatedData);
        setIsProcessingSicaq(false);
        return;
      }
    } catch (err: any) {
      console.warn('Falha na extração SICAQ:', err.message);
      setSicaqSuccessMsg(`⚠️ Erro na leitura automática: ${err.message}. Você pode ajustar os campos abaixo.`);
    } finally {
      setIsProcessingSicaq(false);
    }
  };

  const handleCopySummary = () => {
    const summary = `🏢 *CORPSA ASSESSORIA IMOBILIÁRIA — SIMULAÇÃO CAIXA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${formData.cliente}
🪪 *CPF:* ${formData.cpf}
🏷️ *Programa / Modalidade:* ${formData.programa} - ${formData.tipo_imovel}
🏠 *Valor do Imóvel:* R$ ${formData.valor_imovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
🏛️ *Valor Financiamento:* R$ ${formData.valor_financiamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
💵 *Entrada:* R$ ${formData.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
⏱️ *Prazo:* ${formData.prazo_meses} meses (${formData.sistema_amortizacao})
📈 *Taxa de Juros:* ${formatTaxa2Decimais(formData.taxa_juros_nominal)}% a.a. (Nominal) | ${formatTaxa2Decimais(formData.taxa_juros_efetiva)}% a.a. (Efetiva)
💰 *1ª Prestação:* R$ ${formData.primeira_prestacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *CHECKLIST INTERNO DE ANÁLISE (CORPSA):*
${formData.fator_social_aplicado ? '✅' : '❌'} Fator Social Aplicado
${formData.fgts_36_meses_comprovado ? '✅' : '❌'} 36 Meses FGTS Comprovado
${formData.restricoes_externas_limpas ? '✅' : '❌'} Pesquisa de Restrições Limpa
${formData.possui_imovel_pesquisas ? '⚠️ Possui Imóvel' : '✅ Sem Imóvel nas Pesquisas'}
${formData.irpf_apresentado ? '✅' : '❌'} Imposto de Renda Apresentado
📅 *Validade da Avaliação:* ${formData.validade_avaliacao}
👤 *Analista Responsável:* ${formData.analista_responsavel}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleDownloadDoc = () => {
    exportarSimulacaoCaixaDoc(formData);
  };

  const updatePendencia = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      pendencias_checklist: {
        ...(prev.pendencias_checklist || {}),
        [key]: value
      }
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', fontFamily: "'Inter', sans-serif" }}>
      
      {/* 🚀 ÁREA SIMPLIFICADA: ENVIO SICAQ PDF VIA GEMINI + AJUSTE DO VALOR DO IMÓVEL */}
      <div 
        style={{ 
          backgroundColor: '#f0f9ff', 
          border: '1.5px solid #bae6fd', 
          borderRadius: '10px', 
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 800, fontSize: '0.84rem' }}>
            <Cpu size={18} style={{ color: '#0284c7' }} />
            <span>Extração Inteligente SICAQ (Google Gemini API)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsManualEditMode(!isManualEditMode)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Edit3 size={12} />
            {isManualEditMode ? 'Ocultar Ajustes' : 'Ajustes Finos'}
          </button>
        </div>

        {/* Upload + Ajuste de Valor Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".pdf,image/*,.txt" 
              style={{ display: 'none' }} 
              onChange={handleSicaqFileUpload} 
            />
            <button
              type="button"
              disabled={isProcessingSicaq}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#ffffff',
                border: '1.5px dashed #0284c7',
                borderRadius: '8px',
                color: '#0369a1',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: isProcessingSicaq ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isProcessingSicaq ? (
                <>
                  <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Lendo PDF com Gemini...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  <span>{sicaqFile ? `📄 ${sicaqFile.name.slice(0, 18)}...` : '📄 Anexar SICAQ (PDF/Img)'}</span>
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #93c5fd', borderRadius: '8px', padding: '0 10px', backgroundColor: '#ffffff', height: '38px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginRight: '6px' }}>Imóvel R$:</span>
            <input 
              type="number" 
              value={valorImovelAjuste}
              onChange={(e) => handleAjustarValorImovel(e.target.value)}
              placeholder="250000"
              style={{ flex: 1, border: 'none', fontSize: '0.85rem', fontWeight: 800, outline: 'none', color: '#0f172a' }}
            />
          </div>
        </div>

        {sicaqSuccessMsg && (
          <div style={{ fontSize: '0.75rem', color: '#15803d', backgroundColor: '#dcfce7', padding: '6px 10px', borderRadius: '6px', fontWeight: 600 }}>
            {sicaqSuccessMsg}
          </div>
        )}
      </div>

      {/* Edição Fina Opcional */}
      {isManualEditMode && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Programa:</label>
            <select
              value={formData.programa || 'MCMV'}
              onChange={(e) => setFormData({ ...formData, programa: e.target.value })}
              style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}
            >
              <option value="MCMV">MCMV (Minha Casa Minha Vida)</option>
              <option value="SBPE">SBPE (Poupança/Mercado)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Modalidade:</label>
            <select
              value={formData.tipo_imovel || 'Planta'}
              onChange={(e) => setFormData({ ...formData, tipo_imovel: e.target.value, modalidade_imovel: e.target.value })}
              style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}
            >
              <option value="Planta">Planta</option>
              <option value="Novo">Novo</option>
              <option value="Usado">Usado</option>
              <option value="Terreno e Construção">Terreno e Construção</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Financiamento (R$):</label>
            <input 
              type="number" 
              value={formData.valor_financiamento || ''} 
              onChange={(e) => setFormData({ ...formData, valor_financiamento: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Entrada (R$):</label>
            <input 
              type="number" 
              value={formData.valor_entrada || ''} 
              onChange={(e) => setFormData({ ...formData, valor_entrada: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => exportarSimulacaoCaixaPdf(formData)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#f97316',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)'
          }}
          title="Baixar PDF Oficial da Simulação (100% idêntico ao modelo Caixa/CORPSA)"
        >
          <Download size={14} />
          <span>📥 Baixar PDF da Simulação</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadDoc}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0369a1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
          title="Baixar a simulação e o checklist no modelo DOC/Word"
        >
          <Download size={14} />
          <span>Baixar DOC Modelo</span>
        </button>

        <button
          type="button"
          onClick={handleCopySummary}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
          title="Copiar texto formatado da simulação"
        >
          {copied ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
          <span>{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
        </button>

        {!readonly && (
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: savedSuccess ? '#16a34a' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {savedSuccess ? <Check size={14} /> : <Save size={14} />}
            {savedSuccess ? 'Salvo!' : 'Salvar Ficha'}
          </button>
        )}
      </div>

      {/* 🏢 FICHA OFICIAL CORPSA / CAIXA (100% Idêntica ao Anexo 3) */}
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #071224',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {/* Header Institucional Anexo 3 */}
        <div 
          style={{ 
            backgroundColor: '#071224', 
            padding: '16px 20px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '4px solid #f97316'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '2px solid #f97316',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle, #1e293b 0%, #071224 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
                <span style={{ width: '3px', height: '8px', backgroundColor: '#f97316', borderRadius: '1px' }}></span>
                <span style={{ width: '3px', height: '13px', backgroundColor: '#f97316', borderRadius: '1px' }}></span>
                <span style={{ width: '3px', height: '16px', backgroundColor: '#ffffff', borderRadius: '1px' }}></span>
                <span style={{ width: '3px', height: '11px', backgroundColor: '#ffffff', borderRadius: '1px' }}></span>
              </div>
              <span style={{ fontSize: '0.45rem', color: '#ffffff', fontWeight: 900, marginTop: '2px', letterSpacing: '0.5px' }}>
                CORPSA
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '1px', lineHeight: 1 }}>
                CORP<span style={{ color: '#f97316' }}>SA</span>
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>
                Crédito Imobiliário
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '1.5px', display: 'block', lineHeight: 1 }}>
              CORPSA
            </span>
            <span style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '3px', display: 'block' }}>
              Assessoria Imobiliária
            </span>
          </div>
        </div>

        {/* Subheader: SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA */}
        <div style={{ padding: '10px 18px', backgroundColor: '#ffffff', borderBottom: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: '#071224' }} />
          <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#071224', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA
          </span>
        </div>

        {/* Linhas Formatadas da Simulação */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* CLIENTE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={13} /> CLIENTE:
            </span>
            <input 
              type="text"
              value={formData.cliente}
              disabled={readonly}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value.toUpperCase() })}
              placeholder="Nome completo do proponente"
              style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.82rem', fontWeight: 800, outline: 'none' }}
            />
          </div>

          {/* CPF */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={13} /> CPF:
            </span>
            <input 
              type="text"
              value={formData.cpf}
              disabled={readonly}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
              style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.82rem', fontWeight: 700, outline: 'none' }}
            />
          </div>

          {/* PROGRAMA & MODALIDADE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Home size={13} /> MODALIDADE:
            </span>
            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
              <select
                value={formData.programa || 'MCMV'}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, programa: e.target.value })}
                style={{ width: '120px', height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 8px', fontSize: '0.8rem', fontWeight: 800, color: '#0284c7' }}
              >
                <option value="MCMV">MCMV</option>
                <option value="SBPE">SBPE</option>
              </select>

              <select
                value={formData.tipo_imovel || 'Planta'}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, tipo_imovel: e.target.value, modalidade_imovel: e.target.value })}
                style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 8px', fontSize: '0.8rem', fontWeight: 800 }}
              >
                <option value="Planta">Planta</option>
                <option value="Novo">Novo</option>
                <option value="Usado">Usado</option>
                <option value="Terreno e Construção">Terreno e Construção</option>
              </select>
            </div>
          </div>

          {/* VALOR DO IMÓVEL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Home size={13} /> VALOR DO IMÓVEL:
            </span>
            <div style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>R$</span>
              <input 
                type="number"
                value={formData.valor_imovel || ''}
                disabled={readonly}
                onChange={(e) => handleAjustarValorImovel(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontWeight: 800 }}
              />
            </div>
          </div>

          {/* VALOR DO FINANCIAMENTO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={13} /> VALOR FINANCIAMENTO:
            </span>
            <div style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', display: 'flex', alignItems: 'center', backgroundColor: '#f0f9ff' }}>
              <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 800, marginRight: '4px' }}>R$</span>
              <input 
                type="number"
                value={formData.valor_financiamento || ''}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, valor_financiamento: parseFloat(e.target.value) || 0 })}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.88rem', fontWeight: 900, color: '#0284c7', backgroundColor: 'transparent' }}
              />
            </div>
          </div>

          {/* VALOR DA ENTRADA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={13} /> VALOR DA ENTRADA:
            </span>
            <div style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>R$</span>
              <input 
                type="number"
                value={formData.valor_entrada || ''}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, valor_entrada: parseFloat(e.target.value) || 0 })}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontWeight: 800 }}
              />
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: '#cbd5e1', margin: '4px 0' }}></div>

          {/* PRAZO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} /> PRAZO:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="number"
                value={formData.prazo_meses || ''}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, prazo_meses: parseInt(e.target.value) || 0 })}
                style={{ width: '100px', height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.82rem', fontWeight: 800, outline: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>meses</span>
            </div>
          </div>

          {/* SISTEMA DE AMORTIZAÇÃO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart2 size={13} /> SISTEMA AMORTIZAÇÃO:
            </span>
            <select
              value={formData.sistema_amortizacao}
              disabled={readonly}
              onChange={(e) => setFormData({ ...formData, sistema_amortizacao: e.target.value as 'SAC' | 'PRICE' })}
              style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.82rem', fontWeight: 800, outline: 'none' }}
            >
              <option value="PRICE">PRICE (Parcelas Fixas)</option>
              <option value="SAC">SAC (Parcelas Decrescentes)</option>
            </select>
          </div>

          {/* TAXA DE JUROS (COM APENAS 2 NÚMEROS APÓS A VÍRGULA) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Percent size={13} /> TAXA DE JUROS:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input 
                type="text"
                value={formatTaxa2Decimais(formData.taxa_juros_nominal)}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, taxa_juros_nominal: e.target.value })}
                style={{ width: '80px', height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 8px', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>% a.a. (Nominal) |</span>
              
              <input 
                type="text"
                value={formatTaxa2Decimais(formData.taxa_juros_efetiva)}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, taxa_juros_efetiva: e.target.value })}
                style={{ width: '80px', height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 8px', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>% a.a. (Efetiva)</span>
            </div>
          </div>

          {/* 1ª PRESTAÇÃO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '160px', fontWeight: 900, fontSize: '0.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💰 1ª PRESTAÇÃO:
            </span>
            <div style={{ flex: 1, height: '34px', border: '1.5px solid #16a34a', borderRadius: '6px', padding: '0 10px', display: 'flex', alignItems: 'center', backgroundColor: '#f0fdf4' }}>
              <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 900, marginRight: '4px' }}>R$</span>
              <input 
                type="number"
                value={formData.primeira_prestacao || ''}
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, primeira_prestacao: parseFloat(e.target.value) || 0 })}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.92rem', fontWeight: 900, color: '#16a34a', backgroundColor: 'transparent' }}
              />
            </div>
          </div>

          {/* 4. TABELA: CHECKLIST INTERNO DE ANÁLISE (CORPSA) - IDÊNTICO AO ANEXO 2 E 3 */}
          <div style={{ marginTop: '10px', border: '1.5px solid #071224', borderRadius: '8px', overflow: 'hidden' }}>
            <div 
              style={{ 
                backgroundColor: '#071224', 
                color: '#ffffff', 
                padding: '8px 14px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontWeight: 900,
                fontSize: '0.82rem',
                letterSpacing: '0.5px'
              }}
            >
              <CheckSquare size={16} style={{ color: '#f97316' }} />
              <span>CHECKLIST INTERNO DE ANÁLISE (CORPSA)</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {/* Item 1: Fator Social */}
                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                  <td style={{ width: '55%', padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: readonly ? 'default' : 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={formData.fator_social_aplicado}
                        disabled={readonly}
                        onChange={(e) => setFormData({ ...formData, fator_social_aplicado: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: '#071224' }}
                      />
                      <span>[ {formData.fator_social_aplicado ? 'X' : ' '} ] ( {formData.fator_social_aplicado ? 'SIM' : 'NÃO'} ) Fator Social Aplicado?</span>
                    </label>
                  </td>
                  <td style={{ width: '45%', padding: '6px 10px', borderLeft: '1.5px solid #071224', backgroundColor: '#f8fafc' }}>
                    <input 
                      type="text"
                      disabled={readonly}
                      placeholder="Observação ou pendência documental..."
                      value={formData.pendencias_checklist?.fator_social || ''}
                      onChange={(e) => updatePendencia('fator_social', e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ffffff', outline: 'none' }}
                    />
                  </td>
                </tr>

                {/* Item 2: 36 Meses FGTS */}
                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#fcfcfd' }}>
                  <td style={{ width: '55%', padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: readonly ? 'default' : 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={formData.fgts_36_meses_comprovado}
                        disabled={readonly}
                        onChange={(e) => setFormData({ ...formData, fgts_36_meses_comprovado: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: '#071224' }}
                      />
                      <span>[ {formData.fgts_36_meses_comprovado ? 'X' : ' '} ] ( {formData.fgts_36_meses_comprovado ? 'SIM' : 'NÃO'} ) Possui 36 meses de FGTS comprovados?</span>
                    </label>
                  </td>
                  <td style={{ width: '45%', padding: '6px 10px', borderLeft: '1.5px solid #071224', backgroundColor: '#f8fafc' }}>
                    <input 
                      type="text"
                      disabled={readonly}
                      placeholder="Observação ou pendência documental..."
                      value={formData.pendencias_checklist?.fgts_36_meses || ''}
                      onChange={(e) => updatePendencia('fgts_36_meses', e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ffffff', outline: 'none' }}
                    />
                  </td>
                </tr>

                {/* Item 3: Restrições Externas */}
                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                  <td style={{ width: '55%', padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: readonly ? 'default' : 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={formData.restricoes_externas_limpas}
                        disabled={readonly}
                        onChange={(e) => setFormData({ ...formData, restricoes_externas_limpas: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: '#071224' }}
                      />
                      <span>[ {formData.restricoes_externas_limpas ? 'X' : ' '} ] ( {formData.restricoes_externas_limpas ? 'SIM' : 'NÃO'} ) Pesquisa de restrições externas limpa?</span>
                    </label>
                  </td>
                  <td style={{ width: '45%', padding: '6px 10px', borderLeft: '1.5px solid #071224', backgroundColor: '#f8fafc' }}>
                    <input 
                      type="text"
                      disabled={readonly}
                      placeholder="Observação ou pendência documental..."
                      value={formData.pendencias_checklist?.restricoes_externas || ''}
                      onChange={(e) => updatePendencia('restricoes_externas', e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ffffff', outline: 'none' }}
                    />
                  </td>
                </tr>

                {/* Item 4: Possui imóvel nas pesquisas? (SUBSTITUINDO AVALIAÇÃO ENGENHEIRO CONFORME ANEXO 2) */}
                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#fcfcfd' }}>
                  <td style={{ width: '55%', padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: readonly ? 'default' : 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={formData.possui_imovel_pesquisas}
                        disabled={readonly}
                        onChange={(e) => setFormData({ ...formData, possui_imovel_pesquisas: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: '#071224' }}
                      />
                      <span>[ {formData.possui_imovel_pesquisas ? 'X' : ' '} ] ( {formData.possui_imovel_pesquisas ? 'SIM' : 'NÃO'} ) Possui imóvel nas pesquisas?</span>
                    </label>
                  </td>
                  <td style={{ width: '45%', padding: '6px 10px', borderLeft: '1.5px solid #071224', backgroundColor: '#f8fafc' }}>
                    <input 
                      type="text"
                      disabled={readonly}
                      placeholder="Observação ou pendência documental..."
                      value={formData.pendencias_checklist?.possui_imovel_pesquisas || ''}
                      onChange={(e) => updatePendencia('possui_imovel_pesquisas', e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ffffff', outline: 'none' }}
                    />
                  </td>
                </tr>

                {/* Item 5: Imposto de Renda */}
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td style={{ width: '55%', padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: readonly ? 'default' : 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={formData.irpf_apresentado}
                        disabled={readonly}
                        onChange={(e) => setFormData({ ...formData, irpf_apresentado: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: '#071224' }}
                      />
                      <span>[ {formData.irpf_apresentado ? 'X' : ' '} ] ( {formData.irpf_apresentado ? 'SIM' : 'NÃO'} ) Imposto de Renda apresentado?</span>
                    </label>
                  </td>
                  <td style={{ width: '45%', padding: '6px 10px', borderLeft: '1.5px solid #071224', backgroundColor: '#f8fafc' }}>
                    <input 
                      type="text"
                      disabled={readonly}
                      placeholder="Observação ou pendência documental..."
                      value={formData.pendencias_checklist?.irpf_apresentado || ''}
                      onChange={(e) => updatePendencia('irpf_apresentado', e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ffffff', outline: 'none' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. RODAPÉ: VALIDADE E ANALISTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} /> VALIDADE DA AVALIAÇÃO:
              </span>
              <input 
                type="text" 
                value={formData.validade_avaliacao} 
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, validade_avaliacao: e.target.value })}
                placeholder="____/____/________"
                style={{ width: '140px', height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '160px', fontWeight: 800, fontSize: '0.78rem', color: '#071224', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} /> ANALISTA RESPONSÁVEL:
              </span>
              <input 
                type="text" 
                value={formData.analista_responsavel} 
                disabled={readonly}
                onChange={(e) => setFormData({ ...formData, analista_responsavel: e.target.value })}
                style={{ flex: 1, height: '32px', border: '1.5px solid #071224', borderRadius: '6px', padding: '0 10px', fontSize: '0.82rem', fontWeight: 800, outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ height: '6px', background: 'linear-gradient(90deg, #071224 70%, #f97316 100%)', borderRadius: '3px', marginTop: '8px' }}></div>
        </div>
      </div>
    </div>
  );
};
