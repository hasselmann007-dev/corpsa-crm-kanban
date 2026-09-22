import type { FichaCaixaData } from '../types/consultaRapida';

/**
 * Gera e dispara o download de um arquivo .doc formatado com a Simulação Caixa e Checklist CORPSA
 */
export function exportarSimulacaoCaixaDoc(data: FichaCaixaData): void {
  const nomeArquivo = `Simulacao_CORPSA_${(data.cliente || 'Cliente').replace(/\s+/g, '_')}.doc`;

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Simulação de Crédito Habitacional - CORPSA</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 20px; line-height: 1.4; }
        .header { background-color: #0a192f; color: #ffffff; padding: 16px 20px; border-bottom: 4px solid #f97316; }
        .logo-title { font-size: 24pt; font-weight: bold; color: #ffffff; margin: 0; }
        .logo-sub { font-size: 9pt; color: #f97316; font-weight: bold; letter-spacing: 1px; }
        .title { font-size: 14pt; font-weight: bold; color: #0284c7; margin: 16px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        table.simulacao { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.simulacao td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11pt; }
        table.simulacao td.label { font-weight: bold; color: #475569; width: 40%; }
        table.simulacao td.value { font-weight: bold; color: #0f172a; width: 60%; text-align: right; }
        .destaque { color: #0284c7 !important; font-size: 12pt; }
        .prestacao { color: #15803d !important; font-size: 13pt; background-color: #f0fdf4; }
        .section-checklist { background-color: #0a192f; color: #ffffff; padding: 8px 14px; font-weight: bold; font-size: 11pt; margin-top: 20px; }
        table.checklist { width: 100%; border-collapse: collapse; }
        table.checklist td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 10pt; }
        table.checklist td.status { font-weight: bold; text-align: right; }
        .conforme { color: #15803d; }
        .pendente { color: #dc2626; }
        .footer-info { margin-top: 20px; font-size: 10pt; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">CORPSA</div>
        <div class="logo-sub">ASSESSORIA IMOBILIÁRIA & CRÉDITO HABITACIONAL</div>
      </div>

      <div class="title">📄 SIMULAÇÃO DE CRÉDITO HABITACIONAL - CAIXA</div>

      <table class="simulacao">
        <tr>
          <td class="label">👤 CLIENTE:</td>
          <td class="value">${data.cliente || 'Não Informado'}</td>
        </tr>
        <tr>
          <td class="label">🪪 CPF:</td>
          <td class="value">${data.cpf || 'Não Informado'}</td>
        </tr>
        <tr>
          <td class="label">🏢 TIPO DO IMÓVEL:</td>
          <td class="value">${data.tipo_imovel || 'Não Informado'}</td>
        </tr>
        <tr>
          <td class="label">🏠 VALOR DO IMÓVEL:</td>
          <td class="value">R$ ${data.valor_imovel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td class="label">🏛️ VALOR DO FINANCIAMENTO:</td>
          <td class="value destaque">R$ ${data.valor_financiamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td class="label">💵 VALOR DA ENTRADA:</td>
          <td class="value">R$ ${data.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td class="label">⏱️ PRAZO:</td>
          <td class="value">${data.prazo_meses} meses</td>
        </tr>
        <tr>
          <td class="label">📊 SISTEMA DE AMORTIZAÇÃO:</td>
          <td class="value">${data.sistema_amortizacao === 'SAC' ? 'SAC (Parcelas Decrescentes)' : 'PRICE (Parcelas Fixas)'}</td>
        </tr>
        <tr>
          <td class="label">📈 TAXA DE JUROS:</td>
          <td class="value">${data.taxa_juros_nominal}% a.a. (Nominal) | ${data.taxa_juros_efetiva}% a.a. (Efetiva)</td>
        </tr>
        <tr class="prestacao">
          <td class="label" style="color: #15803d;">💰 1ª PRESTAÇÃO:</td>
          <td class="value prestacao">R$ ${data.primeira_prestacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>

      <div class="section-checklist">📋 CHECKLIST INTERNO DE ANÁLISE (CORPSA)</div>
      <table class="checklist">
        <tr>
          <td>[ ${data.fator_social_aplicado ? 'X' : ' '} ] ( ${data.fator_social_aplicado ? 'SIM' : 'NÃO'} ) Fator Social Aplicado?</td>
          <td class="status ${data.fator_social_aplicado ? 'conforme' : 'pendente'}">${data.fator_social_aplicado ? 'CONFORME' : 'PENDENTE'}</td>
        </tr>
        <tr>
          <td>[ ${data.fgts_36_meses_comprovado ? 'X' : ' '} ] ( ${data.fgts_36_meses_comprovado ? 'SIM' : 'NÃO'} ) Possui 36 meses de FGTS comprovados?</td>
          <td class="status ${data.fgts_36_meses_comprovado ? 'conforme' : 'pendente'}">${data.fgts_36_meses_comprovado ? 'CONFORME' : 'PENDENTE'}</td>
        </tr>
        <tr>
          <td>[ ${data.restricoes_externas_limpas ? 'X' : ' '} ] ( ${data.restricoes_externas_limpas ? 'SIM' : 'NÃO'} ) Pesquisa de restrições externas limpa?</td>
          <td class="status ${data.restricoes_externas_limpas ? 'conforme' : 'pendente'}">${data.restricoes_externas_limpas ? 'CONFORME' : 'PENDENTE'}</td>
        </tr>
        <tr>
          <td>[ ${data.avaliacao_engenheiro_compativel ? 'X' : ' '} ] ( ${data.avaliacao_engenheiro_compativel ? 'SIM' : 'NÃO'} ) Avaliação do engenheiro/imóvel compatível?</td>
          <td class="status ${data.avaliacao_engenheiro_compativel ? 'conforme' : 'pendente'}">${data.avaliacao_engenheiro_compativel ? 'CONFORME' : 'PENDENTE'}</td>
        </tr>
        <tr>
          <td>[ ${data.irpf_apresentado ? 'X' : ' '} ] ( ${data.irpf_apresentado ? 'SIM' : 'NÃO'} ) Imposto de Renda apresentado?</td>
          <td class="status ${data.irpf_apresentado ? 'conforme' : 'pendente'}">${data.irpf_apresentado ? 'CONFORME' : 'NÃO APRESENTADO'}</td>
        </tr>
      </table>

      <div class="footer-info">
        <div><strong>Validade da Avaliação:</strong> ${data.validade_avaliacao}</div>
        <div><strong>Analista Responsável:</strong> ${data.analista_responsavel}</div>
        <div style="font-size: 8pt; margin-top: 6px;">Documento gerado automaticamente pelo CORPSA CRM em ${new Date().toLocaleString('pt-BR')}.</div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
