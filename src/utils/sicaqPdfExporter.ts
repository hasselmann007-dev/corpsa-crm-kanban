import type { FichaCaixaData } from '../types/consultaRapida';

/**
 * Formata taxa com rigorosamente 2 casas decimais após a vírgula (ex: 5,50% ou 5,64%)
 */
export function formatTaxa2Decimais(val?: string | number): string {
  if (!val) return '0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace('%', '').replace(',', '.'));
  if (isNaN(num)) return String(val).replace('%', '').trim();
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Gera e abre para visualização/impressão (Salvar como PDF A4) a Ficha Oficial
 * de Simulação Caixa e Checklist CORPSA 100% idêntica ao modelo do Anexo 3.
 */
export function exportarSimulacaoCaixaPdf(data: FichaCaixaData): void {
  const nomeCliente = data.cliente || '';
  const cpfFormatado = data.cpf || '';
  const programa = data.programa || (data.tipo_imovel?.toLowerCase().includes('sbpe') ? 'SBPE' : 'MCMV');
  const modalidade = data.tipo_imovel || 'Planta';
  
  const valorImovel = data.valor_imovel ? data.valor_imovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const valorFinanciamento = data.valor_financiamento ? data.valor_financiamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const valorEntrada = data.valor_entrada ? data.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const primeiraPrestacao = data.primeira_prestacao ? data.primeira_prestacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const prazoMeses = data.prazo_meses || '';
  const sistemaAmort = data.sistema_amortizacao || 'PRICE';

  const taxaNominal = formatTaxa2Decimais(data.taxa_juros_nominal);
  const taxaEfetiva = formatTaxa2Decimais(data.taxa_juros_efetiva);

  const pendencias = data.pendencias_checklist || {};

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Simulação Caixa - ${nomeCliente || 'CORPSA'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      color: #0a192f;
      background-color: #ffffff;
      font-size: 10pt;
    }
    .page-container {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      border: 2px solid #0a192f;
      border-radius: 12px;
      overflow: hidden;
      background-color: #ffffff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    }

    /* 1. Header Institucional Idêntico ao Anexo 3 */
    .header {
      background-color: #071224;
      color: #ffffff;
      padding: 16px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 4px solid #f97316;
    }
    .header-logo-badge {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-shield {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 2px solid #f97316;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, #1e293b 0%, #071224 100%);
    }
    .logo-bars {
      display: flex;
      align-items: flex-end;
      gap: 2.5px;
      height: 18px;
    }
    .logo-bars span {
      display: inline-block;
      width: 3px;
      border-radius: 1px;
    }
    .logo-shield-text {
      font-size: 5.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #ffffff;
      margin-top: 2px;
    }
    .header-titles {
      display: flex;
      flex-direction: column;
    }
    .header-titles .brand-main {
      font-size: 26pt;
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffffff;
      line-height: 1;
      margin: 0;
    }
    .header-titles .brand-sub {
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #f97316;
      text-transform: uppercase;
      margin-top: 4px;
    }

    /* 2. Subheader: SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA */
    .title-banner {
      padding: 12px 20px;
      background-color: #ffffff;
      border-bottom: 1.5px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title-banner-icon {
      width: 26px;
      height: 26px;
      background-color: #071224;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13pt;
    }
    .title-banner h1 {
      margin: 0;
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #071224;
      text-transform: uppercase;
    }

    /* 3. Grid de Campos da Simulação (Caixas com Cantos Arredondados do Anexo 3) */
    .form-container {
      padding: 14px 22px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .field-label {
      font-size: 8pt;
      font-weight: 800;
      color: #071224;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      min-width: 170px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .field-box {
      flex: 1;
      height: 30px;
      border: 1.5px solid #071224;
      border-radius: 6px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      background-color: #ffffff;
    }
    .field-box-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .divider {
      height: 1px;
      background-color: #cbd5e1;
      margin: 6px 0;
    }

    /* 4. Tabela: CHECKLIST INTERNO DE ANÁLISE (CORPSA) */
    .checklist-section {
      margin: 6px 0;
      border: 1.5px solid #071224;
      border-radius: 8px;
      overflow: hidden;
    }
    .checklist-banner {
      background-color: #071224;
      color: #ffffff;
      padding: 8px 16px;
      font-size: 9.5pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
    }
    .checklist-table {
      width: 100%;
      border-collapse: collapse;
    }
    .checklist-table td {
      padding: 7px 12px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 8.5pt;
    }
    .checklist-table tr:last-child td {
      border-bottom: none;
    }
    .col-item {
      width: 60%;
      font-weight: 700;
      color: #0f172a;
    }
    .col-obs {
      width: 40%;
      border-left: 1.5px solid #071224;
      color: #334155;
      font-weight: 600;
      background-color: #fcfcfd;
    }
    .check-mark {
      font-family: monospace;
      font-weight: 900;
      margin-right: 6px;
    }

    /* 5. Rodapé: Validade e Analista */
    .footer-fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }
    .footer-strip {
      height: 6px;
      background: linear-gradient(90deg, #071224 70%, #f97316 100%);
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="page-container">
    
    <!-- HEADER -->
    <div class="header">
      <div class="header-logo-badge">
        <div class="logo-shield">
          <div class="logo-bars">
            <span style="height: 8px; background: #f97316;"></span>
            <span style="height: 14px; background: #f97316;"></span>
            <span style="height: 18px; background: #ffffff;"></span>
            <span style="height: 12px; background: #ffffff;"></span>
          </div>
          <div class="logo-shield-text">CORPSA</div>
        </div>
        <div style="font-size: 8pt; font-weight: 800; letter-spacing: 0.5px; color: #94a3b8; text-transform: uppercase;">
          Crédito Imobiliário
        </div>
      </div>

      <div class="header-titles" style="text-align: right;">
        <div class="brand-main">CORPSA</div>
        <div class="brand-sub">Assessoria Imobiliária</div>
      </div>
    </div>

    <!-- TÍTULO -->
    <div class="title-banner">
      <div class="title-banner-icon">📄</div>
      <h1>SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA</h1>
    </div>

    <!-- CAMPOS DA SIMULAÇÃO (ANEXO 3) -->
    <div class="form-container">
      <!-- Cliente -->
      <div class="form-row">
        <div class="field-label">👤 CLIENTE:</div>
        <div class="field-box" style="font-weight: 800; text-transform: uppercase;">
          ${nomeCliente || '________________________________________________'}
        </div>
      </div>

      <!-- CPF -->
      <div class="form-row">
        <div class="field-label">🪪 CPF:</div>
        <div class="field-box">
          ${cpfFormatado || '___________________'}
        </div>
      </div>

      <!-- Programa e Modalidade -->
      <div class="form-row">
        <div class="field-label">🏷️ PROGRAMA & MODALIDADE:</div>
        <div class="field-box-inline">
          <div class="field-box" style="flex: 0.8; font-weight: 800; color: #0284c7;">
            ${programa}
          </div>
          <div class="field-box" style="flex: 1.2; font-weight: 800;">
            ${modalidade}
          </div>
        </div>
      </div>

      <!-- Valor do Imóvel -->
      <div class="form-row">
        <div class="field-label">🏠 VALOR DO IMÓVEL:</div>
        <div class="field-box">
          ${valorImovel ? `R$ ${valorImovel}` : 'R$ '}
        </div>
      </div>

      <!-- Valor do Financiamento -->
      <div class="form-row">
        <div class="field-label">🏛️ VALOR DO FINANCIAMENTO:</div>
        <div class="field-box" style="font-weight: 900; color: #0284c7;">
          ${valorFinanciamento ? `R$ ${valorFinanciamento}` : 'R$ '}
        </div>
      </div>

      <!-- Valor da Entrada -->
      <div class="form-row">
        <div class="field-label">💵 VALOR DA ENTRADA:</div>
        <div class="field-box">
          ${valorEntrada ? `R$ ${valorEntrada}` : 'R$ '}
        </div>
      </div>

      <div class="divider"></div>

      <!-- Prazo -->
      <div class="form-row">
        <div class="field-label">⏱️ PRAZO:</div>
        <div class="field-box-inline">
          <div class="field-box" style="width: 140px; flex: none;">
            ${prazoMeses}
          </div>
          <span style="font-size: 8.5pt; font-weight: 700; color: #475569;">meses</span>
        </div>
      </div>

      <!-- Sistema de Amortização -->
      <div class="form-row">
        <div class="field-label">📊 SISTEMA DE AMORTIZAÇÃO:</div>
        <div class="field-box">
          ${sistemaAmort}
        </div>
      </div>

      <!-- Taxa de Juros (Rigorosamente 2 Casas Decimais) -->
      <div class="form-row">
        <div class="field-label">📈 TAXA DE JUROS:</div>
        <div class="field-box-inline">
          <div class="field-box" style="width: 100px; flex: none; text-align: center; justify-content: center;">
            ${taxaNominal}%
          </div>
          <span style="font-size: 8pt; font-weight: 600; color: #64748b;">a.a. (Nominal) &nbsp;|&nbsp;</span>
          <div class="field-box" style="width: 100px; flex: none; text-align: center; justify-content: center;">
            ${taxaEfetiva}%
          </div>
          <span style="font-size: 8pt; font-weight: 600; color: #64748b;">a.a. (Efetiva)</span>
        </div>
      </div>

      <!-- 1ª Prestação -->
      <div class="form-row">
        <div class="field-label">💰 1ª PRESTAÇÃO:</div>
        <div class="field-box" style="font-weight: 900; color: #16a34a; font-size: 10.5pt; background-color: #f0fdf4;">
          ${primeiraPrestacao ? `R$ ${primeiraPrestacao}` : 'R$ '}
        </div>
      </div>

      <!-- CHECKLIST INTERNO DE ANÁLISE (CORPSA) -->
      <div class="checklist-section">
        <div class="checklist-banner">
          <span>📋 CHECKLIST INTERNO DE ANÁLISE (CORPSA)</span>
        </div>
        <table class="checklist-table">
          <tr>
            <td class="col-item">
              <span class="check-mark">[ ${data.fator_social_aplicado ? 'X' : ' '} ] ( ${data.fator_social_aplicado ? 'SIM' : 'NÃO'} )</span>
              Fator Social Aplicado?
            </td>
            <td class="col-obs">
              ${pendencias.fator_social || 'Conforme'}
            </td>
          </tr>
          <tr>
            <td class="col-item">
              <span class="check-mark">[ ${data.fgts_36_meses_comprovado ? 'X' : ' '} ] ( ${data.fgts_36_meses_comprovado ? 'SIM' : 'NÃO'} )</span>
              Possui 36 meses de FGTS comprovados?
            </td>
            <td class="col-obs">
              ${pendencias.fgts_36_meses || 'Conforme'}
            </td>
          </tr>
          <tr>
            <td class="col-item">
              <span class="check-mark">[ ${data.restricoes_externas_limpas ? 'X' : ' '} ] ( ${data.restricoes_externas_limpas ? 'SIM' : 'NÃO'} )</span>
              Pesquisa de restrições externas limpa?
            </td>
            <td class="col-obs">
              ${pendencias.restricoes_externas || 'Conforme'}
            </td>
          </tr>
          <tr>
            <td class="col-item">
              <span class="check-mark">[ ${data.possui_imovel_pesquisas ? 'X' : ' '} ] ( ${data.possui_imovel_pesquisas ? 'SIM' : 'NÃO'} )</span>
              Possui imóvel nas pesquisas?
            </td>
            <td class="col-obs">
              ${pendencias.possui_imovel_pesquisas || (data.possui_imovel_pesquisas ? 'Possui imóvel apontado' : 'Sem imóvel localizado')}
            </td>
          </tr>
          <tr>
            <td class="col-item">
              <span class="check-mark">[ ${data.irpf_apresentado ? 'X' : ' '} ] ( ${data.irpf_apresentado ? 'SIM' : 'NÃO'} )</span>
              Imposto de Renda apresentado?
            </td>
            <td class="col-obs">
              ${pendencias.irpf_apresentado || (data.irpf_apresentado ? 'Conforme' : 'Pendente de envio')}
            </td>
          </tr>
        </table>
      </div>

      <!-- VALIDADE DA AVALIAÇÃO & ANALISTA -->
      <div class="footer-fields">
        <div class="form-row">
          <div class="field-label">📅 VALIDADE DA AVALIAÇÃO:</div>
          <div class="field-box" style="width: 180px; flex: none;">
            ${data.validade_avaliacao || '____/____/________'}
          </div>
        </div>
        <div class="form-row">
          <div class="field-label">👤 ANALISTA RESPONSÁVEL:</div>
          <div class="field-box" style="font-weight: 800;">
            ${data.analista_responsavel || 'Danilo Hasselmann'}
          </div>
        </div>
      </div>

      <div class="footer-strip"></div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert('Por favor, permita popups no navegador para gerar o PDF da Simulação.');
  }
}
