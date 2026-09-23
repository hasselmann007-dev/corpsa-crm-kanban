import fs from 'fs';
import path from 'path';

const OBSIDIAN_VAULT_PATH = 'c:\\Users\\User\\Desktop\\Ai agent\\Normas';
const OBSIDIAN_WIKI_PATH = path.join(OBSIDIAN_VAULT_PATH, 'wiki');

export interface ObsidianDocResult {
  titulo: string;
  subpasta: string;
  caminhoRelativo: string;
  conteudo: string;
  relevancia: number;
}

/**
 * Lê recursivamente todos os arquivos markdown da wiki do Obsidian
 */
export function listarArquivosObsidian(): { titulo: string; subpasta: string; caminhoAbsoluto: string }[] {
  const resultados: { titulo: string; subpasta: string; caminhoAbsoluto: string }[] = [];

  const subpastas = ['normas', 'tabelas', 'procedimentos', 'modelos', 'fontes'];

  for (const pasta of subpastas) {
    const dirPath = path.join(OBSIDIAN_WIKI_PATH, pasta);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file.endsWith('.md')) {
          resultados.push({
            titulo: file.replace(/\.md$/, ''),
            subpasta: pasta,
            caminhoAbsoluto: path.join(dirPath, file)
          });
        }
      }
    }
  }

  // Também inclui index.md se existir
  const indexPath = path.join(OBSIDIAN_VAULT_PATH, 'index.md');
  if (fs.existsSync(indexPath)) {
    resultados.push({
      titulo: 'indice-geral',
      subpasta: 'raiz',
      caminhoAbsoluto: indexPath
    });
  }

  return resultados;
}

/**
 * Normaliza texto para busca insensível a acentos e maiúsculas
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Consulta o acervo do Obsidian por tópicos, palavras-chave ou perguntas
 */
export function consultarObsidianNormas(termoOuPergunta: string): string {
  if (!termoOuPergunta || termoOuPergunta.trim() === '') {
    return 'Por favor, forneça um termo ou pergunta técnica para consulta no Obsidian.';
  }

  const queryNorm = normalizar(termoOuPergunta);
  const termos = queryNorm.split(/\s+/).filter(t => t.length > 2);
  const arquivos = listarArquivosObsidian();

  if (arquivos.length === 0) {
    return 'Aviso: Diretório de normas do Obsidian não encontrado ou vazio em ' + OBSIDIAN_WIKI_PATH;
  }

  const matches: ObsidianDocResult[] = [];

  for (const arq of arquivos) {
    try {
      const conteudoRaw = fs.readFileSync(arq.caminhoAbsoluto, 'utf-8');
      const conteudoNorm = normalizar(conteudoRaw);
      const tituloNorm = normalizar(arq.titulo);

      let pontuacao = 0;

      // Correspondência no título tem peso altíssimo
      for (const t of termos) {
        if (tituloNorm.includes(t)) {
          pontuacao += 15;
        }
        if (conteudoNorm.includes(t)) {
          pontuacao += 3;
        }
      }

      // Pontuações específicas para tópicos centrais
      if (queryNorm.includes('inss') && (tituloNorm.includes('inss') || tituloNorm.includes('especies'))) pontuacao += 20;
      if (queryNorm.includes('irpf') && tituloNorm.includes('irpf')) pontuacao += 20;
      if (queryNorm.includes('rating') && tituloNorm.includes('rating')) pontuacao += 20;
      if (queryNorm.includes('mcmv') && (tituloNorm.includes('mcmv') || tituloNorm.includes('faixas'))) pontuacao += 15;
      if (queryNorm.includes('sbpe') && (tituloNorm.includes('sbpe') || tituloNorm.includes('taxas'))) pontuacao += 15;
      if (queryNorm.includes('limitrofe') && tituloNorm.includes('limitrofe')) pontuacao += 20;
      if (queryNorm.includes('fgts') && tituloNorm.includes('fgts')) pontuacao += 15;
      if (queryNorm.includes('repasse') && tituloNorm.includes('repasse')) pontuacao += 20;
      if (queryNorm.includes('resgate') && tituloNorm.includes('resgate')) pontuacao += 20;
      if (queryNorm.includes('uber') || queryNorm.includes('ifood') || queryNorm.includes('motorista')) {
        if (tituloNorm.includes('motoristas') || tituloNorm.includes('entregadores')) pontuacao += 20;
      }
      if (queryNorm.includes('dependente') && tituloNorm.includes('dependente')) pontuacao += 20;
      if (queryNorm.includes('cancelamento') && tituloNorm.includes('cancelamento')) pontuacao += 20;
      if (queryNorm.includes('custo') || queryNorm.includes('taxa') || queryNorm.includes('despesa')) {
        if (tituloNorm.includes('custos') || tituloNorm.includes('despesas')) pontuacao += 20;
      }

      if (pontuacao > 0) {
        matches.push({
          titulo: arq.titulo,
          subpasta: arq.subpasta,
          caminhoRelativo: `${arq.subpasta}/${arq.titulo}.md`,
          conteudo: conteudoRaw,
          relevancia: pontuacao
        });
      }
    } catch (_e) {}
  }

  if (matches.length === 0) {
    // Se não encontrou correspondência direta, retorna o índice para o agente guiar
    const indexPath = path.join(OBSIDIAN_VAULT_PATH, 'index.md');
    if (fs.existsSync(indexPath)) {
      return `[Nenhum documento específico encontrado para "${termoOuPergunta}". Consulte o Índice Geral do Acervo abaixo]:\n\n` +
        fs.readFileSync(indexPath, 'utf-8').slice(0, 3000);
    }
    return `Nenhum documento encontrado no Obsidian para o termo "${termoOuPergunta}".`;
  }

  // Ordena por relevância e pega os melhores (até 3 documentos para não estourar contexto)
  matches.sort((a, b) => b.relevancia - a.relevancia);
  const selecionados = matches.slice(0, 3);

  const respostaFormatada = selecionados.map(doc => {
    return `### 📖 Fonte Obsidian: [${doc.caminhoRelativo}]\n${doc.conteudo.trim()}`;
  }).join('\n\n---\n\n');

  return `[BASE DE CONHECIMENTO OBSIDIAN - CORPSA & CAIXA - Consulta: "${termoOuPergunta}"]:\n\n${respostaFormatada}`;
}
