import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
}

/**
 * Extrai GEMINI_API_KEY do process.env ou arquivo .env local
 */
export function getGeminiApiKey(customKey?: string): string {
  if (customKey && customKey.trim()) return customKey.trim();
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }

  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI_API_KEY=')) {
          const val = trimmed.substring('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
          if (val) return val;
        }
      }
    }
  } catch (_e) {
    // Ignore error
  }
  return '';
}

/**
 * Lê prompt-agentcrm.md (System Prompt)
 */
export function getAgentPromptCrm(): string {
  try {
    const rootPath = path.resolve(__dirname, '..', 'prompt-agentcrm.md');
    if (fs.existsSync(rootPath)) {
      return fs.readFileSync(rootPath, 'utf-8').trim();
    }
    const skillPath = path.resolve(__dirname, '..', 'skills', 'prompt-agentcrm.md');
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, 'utf-8').trim();
    }
  } catch (_e) {
    // Ignore error
  }
  return '';
}

/**
 * Lê skills/constituicao.md (Manual de Boas Práticas - Ferramenta)
 */
export function getAgentConstitution(): string {
  try {
    const skillPath = path.resolve(__dirname, '..', 'skills', 'constituicao.md');
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, 'utf-8').trim();
    }
  } catch (_e) {
    // Ignore error
  }
  return '';
}

/**
 * Ferramenta oficial: Consulta o Manual de Boas Práticas / Constituição da CORPSA
 */
export function executarFerramentaConstituicao(topico?: string): string {
  const manual = getAgentConstitution();
  if (!manual) {
    return 'Manual de Boas Práticas não encontrado no momento.';
  }

  if (!topico || topico.trim() === '' || topico.toLowerCase() === 'geral') {
    return manual;
  }

  return `[MANUAL DE BOAS PRÁTICAS CORPSA - Consulta sobre "${topico}"]:\n${manual}`;
}

import { executarCriarCardKanban, executarSolicitarConsultaRapida, getRegrasAnaliseKanban } from './kanbanTool.js';
import { consultarObsidianNormas } from './obsidianNormasTool.js';
import { consultarDadosClienteCrm } from './crmConsultaTool.js';

/**
 * Declarações de Ferramentas (Function Calling) do Google Gemini
 */
const GEMINI_TOOLS_DECLARATION = [
  {
    functionDeclarations: [
      {
        name: 'consultar_obsidian_normas',
        description: 'Consulta o cofre de conhecimento Obsidian (@Normas) da CORPSA e da Caixa Econômica Federal (normas de benefícios INSS aceitos e vedados, IRPF 2026, limites de comprometimento de renda por rating A/B/C/D, dependentes MCMV, municípios limítrofes para uso do FGTS nas RMs de Ribeirão Preto/Campinas/SP, tabelas de faixas de renda e taxas MCMV/SBPE, custas de engenharia e avaliação, procedimentos de renda informal e motoristas de aplicativo Uber/99/iFood, checklists de documentos e modelos). Você DEVE invocar esta ferramenta sempre que o usuário fizer perguntas técnicas ou operacionais sobre crédito imobiliário para responder com base estrita no acervo documentado.',
        parameters: {
          type: 'OBJECT',
          properties: {
            termo_ou_topico: {
              type: 'STRING',
              description: 'Tópico, dúvida ou palavra-chave para consulta no acervo Obsidian (ex: "benefícios INSS aceitos", "regra IRPF 2026", "rating comprometimento renda", "municipios limitrofes FGTS", "procedimento uber", "checklist documentos", etc.).'
            }
          },
          required: ['termo_ou_topico']
        }
      },
      {
        name: 'consultar_dados_cliente_crm',
        description: 'Consulta os dados cadastrais e operacionais de um cliente/lead diretamente no banco de dados do CRM pelo CPF ou Nome. Retorna com exatidão os 4 blocos operacionais: 1) Observações Operacionais & Dados da Triagem; 2) Descrição e Detalhamento da Pendência; 3) Parecer Oficial do Analista de Crédito; 4) Considerações Finais & Instruções para Contrato.',
        parameters: {
          type: 'OBJECT',
          properties: {
            identificador: {
              type: 'STRING',
              description: 'CPF (apenas números ou formatado) ou Nome do cliente a ser consultado no banco do CRM.'
            }
          },
          required: ['identificador']
        }
      },
      {
        name: 'consultar_manual_constituicao',
        description: 'Consulta o Manual de Boas Práticas e a Constituição da CORPSA (regras de análise, rotina, SLAs de 2h para Construtora e 3h para Imobiliária, checklist, regras de devolução FYP/MRV/Direcional, tetos MCMV Faixa 2/3/4 e tabela de agências das construtoras). Use esta ferramenta SOMENTE quando precisar consultar dados ou regras da empresa.',
        parameters: {
          type: 'OBJECT',
          properties: {
            topico: {
              type: 'STRING',
              description: 'Tema ou tópico a ser consultado (ex: "SLA", "checklist", "Direcional", "MRV", "tetos MCMV", "rotina", etc.).'
            }
          },
          required: ['topico']
        }
      },
      {
        name: 'criar_card_kanban',
        description: 'Cria automaticamente um novo card de lead na coluna "Roleta / Avaliar" do fluxo Kanban da CORPSA quando o corretor envia informações e os documentos necessários para análise de crédito completa. REGRA OBRIGATÓRIA: Quando for solicitada uma avaliação de crédito, você DEVE primeiro perguntar se o cliente é Assalariado (CLT) ou Empresário/Autônomo e enviar a lista oficial de documentos necessários juntos. NUNCA chame esta ferramenta se os documentos obrigatórios ainda não tiverem sido fornecidos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nome_cliente: {
              type: 'STRING',
              description: 'Nome completo do cliente a ser cadastrado na Roleta.'
            },
            cpf_cliente: {
              type: 'STRING',
              description: 'CPF do cliente (11 dígitos, ex: "123.456.789-00" ou "12345678900").'
            },
            valor_imovel: {
              type: 'NUMBER',
              description: 'Valor do imóvel pretendido em reais (ex: 250000). Caso não informado, passe 0.'
            },
            cidade: {
              type: 'STRING',
              description: 'Cidade/UF do cliente ou imóvel (Padrão: "Ribeirão Preto").'
            },
            grupo_origem: {
              type: 'STRING',
              description: 'Grupo, imobiliária ou construtora de origem (ex: "Direcional", "MRV", "ADN", "FYP", "Imobiliária", "Geral").'
            },
            tipo_consulta: {
              type: 'STRING',
              description: 'Tipo de consulta associada: "cpf", "irpf", "imovel", "serasa", "avaliacao" ou "nenhuma".'
            },
            detalhes_solicitacao: {
              type: 'STRING',
              description: 'Observações, renda declarada, holerites enviados ou motivo da análise.'
            }
          },
          required: ['nome_cliente']
        }
      },
      {
        name: 'solicitar_consulta_rapida',
        description: 'Dispara um alerta sonoro e notificação de Consulta Rápida (para IRPF, pesquisa de bens/imóvel, consulta CPF/restrições ou Serasa) para todos os analistas online do sistema. NÃO CRIA UM CARD NO KANBAN, apenas abre um alerta em tempo real para os analistas realizarem a pesquisa e enviarem a devolutiva.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo_consulta: {
              type: 'STRING',
              description: 'Tipo da consulta rápida: "cpf", "irpf", "imovel", "serasa" ou "outros".'
            },
            nome_cliente: {
              type: 'STRING',
              description: 'Nome completo do cliente a ser consultado.'
            },
            cpf_cliente: {
              type: 'STRING',
              description: 'CPF do cliente (11 dígitos).'
            },
            data_nascimento: {
              type: 'STRING',
              description: 'Data de nascimento do cliente (ex: "15/08/1990"), se informada.'
            },
            documento_identificacao: {
              type: 'STRING',
              description: 'Documento de identificação (RG, CNH, Matrícula do imóvel), se informado.'
            },
            detalhes_solicitacao: {
              type: 'STRING',
              description: 'Descrição ou dúvida específica que o corretor precisa consultar com urgência.'
            }
          },
          required: ['tipo_consulta', 'nome_cliente']
        }
      }
    ]
  }
];

/**
 * Executa completion no Google Gemini REST API com suporte a Function Calling e Fallback inteligente
 */
export async function chatWithGoogleGemini(
  messages: ChatMessage[],
  customKey?: string,
  customPrompt?: string,
  _customConstitution?: string,
  modelName: string = 'gemini-flash-latest'
): Promise<{ text: string; model: string; latencyMs: number; toolUsed?: boolean; usage?: any }> {
  const token = getGeminiApiKey(customKey);
  if (!token) {
    throw new Error('Chave API do Google Gemini não encontrada. Adicione GEMINI_API_KEY no arquivo .env.');
  }

  // Mapeamento de modelos
  let targetModel = modelName;
  if (modelName === 'gemini-3.6-flash' || modelName === 'google/gemini-3.6-flash') {
    targetModel = 'gemini-flash-latest';
  }

  const modelCandidates = [
    targetModel,
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-pro-latest'
  ];

  // Remove duplicatas mantendo a ordem
  const uniqueModels = Array.from(new Set(modelCandidates));

  // System Prompt estritamente baseado no prompt-agentcrm.md + Regras Customizáveis de Análise
  const promptText = customPrompt !== undefined ? customPrompt : getAgentPromptCrm();
  const customRules = getRegrasAnaliseKanban();
  let systemInstructionText = promptText && promptText.trim()
    ? promptText.trim()
    : 'Você é analista responsável pela triagem de documentos da CORPSA. Trate por você, tom caloroso, mensagens curtas e uma pergunta de cada vez.';

  if (customRules) {
    systemInstructionText += `\n\n[DIRETRIZES E REGRAS DE ANÁLISE / KANBAN (skills/regras-analise-kanban.md)]:\n${customRules}`;
  }

  let lastError: any = null;

  for (const currentModel of uniqueModels) {
    try {
      const contents: any[] = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const payload: any = {
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents,
        tools: GEMINI_TOOLS_DECLARATION,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${token}`;
      const startTime = Date.now();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        let errJson: any;
        try { errJson = JSON.parse(errText); } catch {}
        const msg = errJson?.error?.message || errText || `Erro HTTP ${response.status}`;
        throw new Error(msg);
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const allParts = candidate?.content?.parts || [];
      const fnPart = allParts.find((p: any) => p.functionCall);

      // Caso 1: O modelo invocou a ferramenta (Function Call)
      if (fnPart?.functionCall) {
        const fnCall = fnPart.functionCall;
        let toolResult = '';

        if (fnCall.name === 'consultar_obsidian_normas') {
          const topico = fnCall.args?.termo_ou_topico || fnCall.args?.topico || '';
          toolResult = consultarObsidianNormas(topico);
        } else if (fnCall.name === 'consultar_dados_cliente_crm') {
          const id = fnCall.args?.identificador || fnCall.args?.cpf || fnCall.args?.nome || '';
          const dossie = await consultarDadosClienteCrm(id);
          toolResult = dossie.mensagemFormatada;
        } else if (fnCall.name === 'consultar_manual_constituicao') {
          const topico = fnCall.args?.topico || '';
          toolResult = executarFerramentaConstituicao(topico);
        } else if (fnCall.name === 'criar_card_kanban') {
          const cardResult = await executarCriarCardKanban({
            nome_cliente: fnCall.args?.nome_cliente || '',
            cpf_cliente: fnCall.args?.cpf_cliente || '',
            valor_imovel: typeof fnCall.args?.valor_imovel === 'number' ? fnCall.args.valor_imovel : Number(fnCall.args?.valor_imovel) || 0,
            cidade: fnCall.args?.cidade || 'Ribeirão Preto',
            grupo_origem: fnCall.args?.grupo_origem || 'Geral',
            tipo_consulta: fnCall.args?.tipo_consulta || 'nenhuma',
            detalhes_solicitacao: fnCall.args?.detalhes_solicitacao || ''
          });
          toolResult = JSON.stringify(cardResult);
        } else if (fnCall.name === 'solicitar_consulta_rapida') {
          const consultaResult = await executarSolicitarConsultaRapida({
            tipo_consulta: fnCall.args?.tipo_consulta || 'cpf',
            nome_cliente: fnCall.args?.nome_cliente || '',
            cpf_cliente: fnCall.args?.cpf_cliente || '',
            data_nascimento: fnCall.args?.data_nascimento || '',
            documento_identificacao: fnCall.args?.documento_identificacao || '',
            detalhes_solicitacao: fnCall.args?.detalhes_solicitacao || ''
          });
          toolResult = JSON.stringify(consultaResult);
        } else {
          toolResult = 'Ferramenta não reconhecida.';
        }

        // Segundo turno com a resposta da ferramenta
        contents.push({
          role: 'model',
          parts: allParts
        });

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: fnCall.name,
                response: { result: toolResult }
              }
            }
          ]
        });

        const secondTurnPayload = {
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          contents,
          tools: GEMINI_TOOLS_DECLARATION,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        };

        const secondResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(secondTurnPayload)
        });

        if (!secondResponse.ok) {
          const errText2 = await secondResponse.text();
          let errJson2: any;
          try { errJson2 = JSON.parse(errText2); } catch {}
          throw new Error(errJson2?.error?.message || errText2);
        }

        const secondData = await secondResponse.json();
        const finalCandidate = secondData.candidates?.[0];
        const textParts = finalCandidate?.content?.parts?.filter((p: any) => p.text && !p.thought) || [];
        const finalText = textParts.map((p: any) => p.text).join('\n') || finalCandidate?.content?.parts?.[0]?.text || 'Ação registrada com sucesso na fila de crédito.';

        return {
          text: finalText.trim(),
          model: `Gemini (${currentModel})`,
          latencyMs: Date.now() - startTime,
          toolUsed: true,
          usage: secondData.usageMetadata
        };
      }

      // Caso 2: Resposta direta de texto
      const textParts = allParts.filter((p: any) => p.text && !p.thought);
      let replyText = textParts.map((p: any) => p.text).join('\n') || allParts[0]?.text || '';

      // Caso 2.1: Se o usuário pediu explicitamente para criar um card ou cadastrar um lead
      // mas o modelo respondeu apenas em texto, aciona deterministicamente a ferramenta para garantir o card no Kanban
      const lastUserMsg = messages[messages.length - 1]?.content || '';
      const isCreateCardIntent = /\b(?:cri(?:e|ar)|cadastr(?:e|ar)|adicion(?:e|ar)|novo\s+lead|novo\s+cliente|pasta)\b/i.test(lastUserMsg);
      
      if (isCreateCardIntent && !allParts.some((p: any) => p.functionCall)) {
        // Extrai dados básicos do texto da mensagem
        const cpfMatch = lastUserMsg.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/);
        const valorMatch = lastUserMsg.match(/(?:R\$\s*|im[oó]vel\s*(?:de)?\s*)(\d+[\d.,]*\s*(?:k|mil|milh[oõ]es)?)/i);
        let valorNum = 0;
        if (valorMatch) {
          const rawV = valorMatch[1].toLowerCase();
          if (rawV.includes('k')) valorNum = parseFloat(rawV) * 1000;
          else if (rawV.includes('mil')) valorNum = parseFloat(rawV) * 1000;
          else valorNum = parseFloat(rawV.replace(/\./g, '').replace(',', '.')) || 0;
        }

        const nomeMatch = lastUserMsg.match(/(?:cliente|nome|para)\s*[:=]?\s*([A-ZÀ-Úa-zà-ú\s]{4,35})/i);
        const nomeFinal = nomeMatch ? nomeMatch[1].trim().toUpperCase() : 'NOVO CLIENTE';

        await executarCriarCardKanban({
          nome_cliente: nomeFinal,
          cpf_cliente: cpfMatch ? cpfMatch[1] : undefined,
          valor_imovel: valorNum,
          detalhes_solicitacao: `Criado automaticamente via chat: ${lastUserMsg.slice(0, 150)}`
        });
      }

      if (replyText) {
        return {
          text: replyText.trim(),
          model: currentModel,
          latencyMs: Date.now() - startTime,
          toolUsed: isCreateCardIntent,
          usage: data.usageMetadata
        };
      }

      throw new Error(`Resposta vazia do modelo ${currentModel}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Tool] Modelo ${currentModel} falhou ou com alta demanda: ${err.message}. Tentando próximo fallback...`);
    }
  }

  throw new Error(`Todos os modelos Gemini falharam. Último erro: ${lastError?.message || 'Falha desconhecida'}`);
}

export interface MultimodalInput {
  buffer?: Buffer;
  base64?: string;
  mimeType: string;
  filename?: string;
  customKey?: string;
}

export interface MultimodalTranscribeResult {
  transcribedText: string;
  mediaType: 'audio' | 'image' | 'pdf' | 'text';
  detectedMimeType: string;
  filename?: string;
  latencyMs: number;
}

/**
 * Detecta o tipo de mídia a partir do MIME Type e/ou nome do arquivo
 */
export function detectMediaType(mimeType: string, filename?: string): 'audio' | 'image' | 'pdf' | 'text' {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  if (
    lowerMime.startsWith('audio/') ||
    lowerMime.includes('ogg') ||
    lowerMime.includes('opus') ||
    lowerMime.includes('wav') ||
    lowerMime.includes('webm') ||
    lowerMime.includes('mp3') ||
    lowerMime.includes('m4a') ||
    lowerName.endsWith('.ogg') ||
    lowerName.endsWith('.mp3') ||
    lowerName.endsWith('.wav') ||
    lowerName.endsWith('.webm') ||
    lowerName.endsWith('.m4a') ||
    lowerName.endsWith('.opus')
  ) {
    return 'audio';
  }

  if (
    lowerMime.startsWith('image/') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.bmp') ||
    lowerName.endsWith('.gif')
  ) {
    return 'image';
  }

  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'text';
}

/**
 * Normaliza MIME Types para compatibilidade com a API do Gemini
 */
export function normalizeMimeType(mimeType: string, filename?: string): string {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  if (lowerMime.includes('ogg') || lowerName.endsWith('.ogg')) return 'audio/ogg';
  if (lowerMime.includes('opus') || lowerName.endsWith('.opus')) return 'audio/ogg';
  if (lowerMime.includes('wav') || lowerName.endsWith('.wav')) return 'audio/wav';
  if (lowerMime.includes('mp3') || lowerMime.includes('mpeg') || lowerName.endsWith('.mp3')) return 'audio/mp3';
  if (lowerMime.includes('m4a') || lowerName.endsWith('.m4a')) return 'audio/m4a';
  if (lowerMime.includes('webm') || lowerName.endsWith('.webm')) {
    return lowerMime.includes('audio') ? 'audio/webm' : 'audio/webm';
  }

  if (lowerMime.includes('png') || lowerName.endsWith('.png')) return 'image/png';
  if (lowerMime.includes('jpeg') || lowerMime.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerMime.includes('webp') || lowerName.endsWith('.webp')) return 'image/webp';

  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return 'application/pdf';

  return mimeType || 'application/octet-stream';
}

/**
 * Etapa 1: Transcreve ou extrai o conteúdo de Áudios, Imagens e PDFs usando Gemini Multimodal
 */
export async function transcribeMultimodalContent(
  input: MultimodalInput
): Promise<MultimodalTranscribeResult> {
  const token = getGeminiApiKey(input.customKey);
  if (!token) {
    throw new Error('Chave API do Google Gemini não encontrada. Configure GEMINI_API_KEY no .env.');
  }

  const mediaType = detectMediaType(input.mimeType, input.filename);
  const normalizedMime = normalizeMimeType(input.mimeType, input.filename);

  let base64Data = input.base64 || '';
  if (!base64Data && input.buffer) {
    base64Data = input.buffer.toString('base64');
  }

  if (!base64Data) {
    throw new Error('Nenhum dado binário ou base64 fornecido para transcrição.');
  }

  // Define instrução de transcrição especializada por tipo de mídia
  let promptInstruction = '';
  if (mediaType === 'audio') {
    promptInstruction = 'Transcreva fielmente todo o áudio falado neste arquivo em português do Brasil com máxima precisão. Retorne estritamente o texto falado, sem aspas adicionais, sem preâmbulos, explicações ou notas de áudio.';
  } else if (mediaType === 'image') {
    promptInstruction = 'Analise detalhadamente esta imagem/documento e extraia todo o texto visível, dados cadastrais, nomes de clientes, CPFs, valores monetários, comprovantes de renda ou tabelas. Transcreva com fidelidade o conteúdo do documento para que o analista de crédito possa utilizá-lo na triagem.';
  } else if (mediaType === 'pdf') {
    promptInstruction = 'Leia e extraia fielmente todo o conteúdo deste documento PDF, incluindo textos, dados do cliente, holerites, extratos bancários, valores, declaração de imposto de renda e tabelas financeiras de forma clara e estruturada.';
  } else {
    // Texto em formato bruto
    try {
      const decodedText = Buffer.from(base64Data, 'base64').toString('utf-8');
      return {
        transcribedText: decodedText,
        mediaType: 'text',
        detectedMimeType: normalizedMime,
        filename: input.filename,
        latencyMs: 0
      };
    } catch {
      promptInstruction = 'Extraia o conteúdo textual deste arquivo.';
    }
  }

  const modelCandidates = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-pro-latest'
  ];

  let lastError: any = null;
  const startTime = Date.now();

  for (const currentModel of modelCandidates) {
    try {
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

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${token}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (textOutput) {
        return {
          transcribedText: textOutput,
          mediaType,
          detectedMimeType: normalizedMime,
          filename: input.filename,
          latencyMs: Date.now() - startTime
        };
      }

      throw new Error(`Modelo ${currentModel} retornou resposta vazia.`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Multimodal] Modelo ${currentModel} falhou: ${err.message}. Tentando próximo fallback...`);
    }
  }

  throw new Error(`Falha na transcrição multimodal: ${lastError?.message || 'Erro desconhecido'}`);
}
