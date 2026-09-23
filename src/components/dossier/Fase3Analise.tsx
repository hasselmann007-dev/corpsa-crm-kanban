import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Save, 
  Check 
} from 'lucide-react';
import { FichaAprovacaoCaixa } from '../FichaAprovacaoCaixa';
import type { Lead } from '../../App';
import type { FichaCaixaData } from '../../types/consultaRapida';

interface Fase3AnaliseProps {
  lead: Lead;
  onAdvanceToConclusao: () => void;
  onUpdateLead: (updatedLead: Partial<Lead>) => void;
  currentAnalistaNome?: string;
}

export const Fase3Analise: React.FC<Fase3AnaliseProps> = ({
  lead,
  onAdvanceToConclusao,
  onUpdateLead,
  currentAnalistaNome = 'Danilo Hasselmann'
}) => {
  const [resultadoAnalise, setResultadoAnalise] = useState<string>(
    lead.resultado_analise || 'Aprovado'
  );
  const [motivoResultado, setMotivoResultado] = useState<string>(
    lead.motivo_resultado || ''
  );
  const [salvoSuccess, setSalvoSuccess] = useState(false);

  useEffect(() => {
    if (lead.resultado_analise) {
      setResultadoAnalise(lead.resultado_analise);
    }
    if (lead.motivo_resultado) {
      setMotivoResultado(lead.motivo_resultado);
    }
  }, [lead.resultado_analise, lead.motivo_resultado]);

  const handleParecerChange = (novoParecer: string) => {
    setResultadoAnalise(novoParecer);

    const defaultMotivo = novoParecer === 'Condicionado' 
      ? (motivoResultado || 'Condicionado à comprovação de renda complementar ou coobrigado')
      : novoParecer === 'Reprovado'
      ? (motivoResultado || 'Reprovado por restrição cadastral ou score insuficiente')
      : motivoResultado;

    onUpdateLead({
      resultado_analise: novoParecer,
      motivo_resultado: defaultMotivo
    });
  };

  const handleSalvarParecer = () => {
    onUpdateLead({
      resultado_analise: resultadoAnalise,
      motivo_resultado: motivoResultado
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
        boxSizing: 'border-box',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Barra de Parecer do Analista */}
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#0ea5e9' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              Parecer Oficial do Analista de Crédito:
            </span>
          </div>

          <button
            type="button"
            onClick={onAdvanceToConclusao}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
            }}
          >
            <span>Avançar para Conclusão & CorPay</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* 3 Botões de Parecer */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handleParecerChange('Aprovado')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              border: resultadoAnalise === 'Aprovado' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              backgroundColor: resultadoAnalise === 'Aprovado' ? '#dcfce7' : '#ffffff',
              color: resultadoAnalise === 'Aprovado' ? '#15803d' : '#475569',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCircle2 size={16} />
            <span>🟢 Aprovado</span>
          </button>

          <button
            type="button"
            onClick={() => handleParecerChange('Condicionado')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              border: resultadoAnalise === 'Condicionado' ? '2px solid #d97706' : '1px solid #cbd5e1',
              backgroundColor: resultadoAnalise === 'Condicionado' ? '#fef3c7' : '#ffffff',
              color: resultadoAnalise === 'Condicionado' ? '#b45309' : '#475569',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={16} />
            <span>🟡 Condicionado</span>
          </button>

          <button
            type="button"
            onClick={() => handleParecerChange('Reprovado')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              border: resultadoAnalise === 'Reprovado' ? '2px solid #dc2626' : '1px solid #cbd5e1',
              backgroundColor: resultadoAnalise === 'Reprovado' ? '#fee2e2' : '#ffffff',
              color: resultadoAnalise === 'Reprovado' ? '#b91c1c' : '#475569',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <XCircle size={16} />
            <span>🔴 Reprovado</span>
          </button>
        </div>
      </div>

      {/* Se Condicionado ou Reprovado: Campo de Motivo */}
      {(resultadoAnalise === 'Condicionado' || resultadoAnalise === 'Reprovado') && (
        <div 
          style={{ 
            backgroundColor: resultadoAnalise === 'Reprovado' ? '#fef2f2' : '#fffbeb',
            border: `1.5px solid ${resultadoAnalise === 'Reprovado' ? '#fecaca' : '#fde68a'}`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: resultadoAnalise === 'Reprovado' ? '#991b1b' : '#92400e' }}>
              {resultadoAnalise === 'Reprovado' ? 'Motivo da Reprovação:' : 'Condicionantes Exigidas:'} <span style={{ color: '#dc2626' }}>*</span>
            </label>

            <button
              type="button"
              onClick={handleSalvarParecer}
              style={{
                background: '#0a192f',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {salvoSuccess ? <Check size={12} /> : <Save size={12} />}
              <span>{salvoSuccess ? 'Salvo!' : 'Salvar Motivo'}</span>
            </button>
          </div>

          <textarea 
            rows={3}
            value={motivoResultado}
            onChange={(e) => setMotivoResultado(e.target.value)}
            placeholder={resultadoAnalise === 'Reprovado' 
              ? 'Descreva os motivos da reprovação na Caixa (ex: Restrição BACEN/Serasa, score insuficiente, comprometimento acima de 30%)...'
              : 'Descreva as condicionantes para aprovação (ex: Necessário inclusão de coobrigado/cônjuge, entrada complementar de R$ 15k)...'
            }
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.78rem',
              lineHeight: '1.4',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />

          {resultadoAnalise === 'Reprovado' && (
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#991b1b', fontWeight: 600 }}>
              ⚠️ Orientação ao corretor: Instrua o cliente a sanar os apontamentos cadastrais e aguardar o prazo de 180 dias para nova submissão.
            </p>
          )}
        </div>
      )}

      {/* Se Aprovado ou Condicionado: Exibe a Ficha de Simulação Caixa & Checklist CORPSA */}
      {resultadoAnalise !== 'Reprovado' && (() => {
        let savedFicha: any = {};
        const match = (lead.informacoes_importantes || '').match(/\[SIMULACAO_CAIXA:\s*(\{[\s\S]*?\})\s*\]/);
        if (match && match[1]) {
          try { savedFicha = JSON.parse(match[1]); } catch {}
        }
        return (
          <FichaAprovacaoCaixa
            key={`ficha-${lead.id}`}
            initialData={{
              cliente: lead.nome_cliente,
              cpf: lead.cpf_cliente,
              valor_imovel: lead.valor_imovel,
              analista_responsavel: currentAnalistaNome,
              tipo_imovel: 'Planta',
              ...savedFicha
            }}
            onSave={(fichaData: FichaCaixaData) => {
              let baseInfo = lead.informacoes_importantes || '';
              const tagStr = `[SIMULACAO_CAIXA: ${JSON.stringify(fichaData)}]`;
              if (/\[SIMULACAO_CAIXA:\s*\{[\s\S]*?\}\s*\]/.test(baseInfo)) {
                baseInfo = baseInfo.replace(/\[SIMULACAO_CAIXA:\s*\{[\s\S]*?\}\s*\]/, tagStr);
              } else {
                baseInfo = `${baseInfo.trim()}\n${tagStr}`.trim();
              }

              onUpdateLead({
                valor_imovel: fichaData.valor_imovel,
                resultado_analise: resultadoAnalise,
                informacoes_importantes: baseInfo
              });
            }}
          />
        );
      })()}
    </div>
  );
};
