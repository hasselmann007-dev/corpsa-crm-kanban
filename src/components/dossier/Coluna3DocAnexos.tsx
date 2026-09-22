import React, { useState, useEffect, useRef } from 'react';
import { 
  FiPaperclip, 
  FiUploadCloud, 
  FiFile, 
  FiTrash2, 
  FiDownload, 
  FiImage
} from 'react-icons/fi';
import type { Lead } from '../../App';

export interface DossierDocument {
  id: string;
  leadId: string;
  nome: string;
  tamanho: string;
  tipo: 'PDF' | 'Imagem' | 'DOC' | 'Outro';
  categoria: 'SICAQ' | 'Holerite' | 'Extrato' | 'IRPF' | 'RG/CPF' | 'Residência' | 'Geral';
  data: string;
  url?: string;
  fileData?: string; // Base64 Data URL com bytes reais do arquivo
}

interface Coluna3DocAnexosProps {
  lead: Lead;
  onSicaqSelected?: (file: File | { name: string; url?: string }) => void;
}

const CATEGORY_TAGS = ['SICAQ', 'Holerite', 'Extrato', 'IRPF', 'RG/CPF'] as const;

export const Coluna3DocAnexos: React.FC<Coluna3DocAnexosProps> = ({
  lead,
  onSicaqSelected
}) => {
  const [documentos, setDocumentos] = useState<DossierDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DossierDocument['categoria']>('Geral');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageKey = `corpsa_lead_docs_${lead.id}`;

  // Carrega documentos reais do LocalStorage para o lead ativo
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtra arquivos legados com nomes fictícios para garantir apenas arquivos reais
          const filteredReal = parsed.filter(d => 
            !['Simulacao_SICAQ_Aprovada.pdf', 'RG_CPF_Cliente.pdf', 'Holerite_Ultimo_Mes.pdf', 'Comprovante_Residencia.jpg'].includes(d.nome) ||
            Boolean(d.fileData)
          );
          setDocumentos(filteredReal);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar documentos do storage:', e);
    }

    // Não cria documentos fictícios — inicia vazio até o corretor/analista anexar arquivos reais
    setDocumentos([]);
  }, [lead.id, storageKey]);

  // Persiste no LocalStorage sempre que a lista mudar
  const saveDocsToStorage = (updatedDocs: DossierDocument[]) => {
    setDocumentos(updatedDocs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedDocs));
    } catch (e) {
      console.warn('Erro ao salvar documentos no storage:', e);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const detectDocType = (filename: string): DossierDocument['tipo'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'Imagem';
    if (['doc', 'docx'].includes(ext || '')) return 'DOC';
    return 'Outro';
  };

  // Leitura assíncrona do arquivo real em Base64 Data URL para permitir download e visualização genuínos
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    const newDocsPromises = fileArr.map(async (file, idx) => {
      const docType = detectDocType(file.name);
      const fileData = await readFileAsDataUrl(file);

      return {
        id: `doc_${Date.now()}_${idx}`,
        leadId: lead.id,
        nome: file.name,
        tamanho: formatFileSize(file.size),
        tipo: docType,
        categoria: selectedCategory,
        data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fileData
      };
    });

    const newDocs = await Promise.all(newDocsPromises);
    const updated = [...newDocs, ...documentos];
    saveDocsToStorage(updated);

    // Se o arquivo for SICAQ, notifica callback externo para extração automática
    const sicaqFile = fileArr.find(f => f.name.toLowerCase().includes('sicaq') || selectedCategory === 'SICAQ');
    if (sicaqFile && onSicaqSelected) {
      onSicaqSelected(sicaqFile);
    }
  };

  const handleDeleteDoc = (docId: string) => {
    const filtered = documentos.filter(d => d.id !== docId);
    saveDocsToStorage(filtered);
  };

  // Download real: converte Data URL Base64 para Blob binário com o mimeType exato
  const handleDownloadDoc = async (doc: DossierDocument) => {
    if (doc.fileData && doc.fileData.startsWith('data:')) {
      try {
        const res = await fetch(doc.fileData);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      } catch (err) {
        console.error('Erro ao converter Data URL para Blob:', err);
      }
    }

    if (doc.url && doc.url.startsWith('http')) {
      window.open(doc.url, '_blank');
      return;
    }

    alert(`O arquivo "${doc.nome}" foi registrado sem conteúdo binário. Por favor, anexe o documento original novamente.`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      e.target.value = ''; // Permite selecionar o mesmo arquivo novamente
    }
  };

  const getCategoryColor = (cat: DossierDocument['categoria']) => {
    switch (cat) {
      case 'SICAQ': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'Holerite': return { bg: '#dcfce7', text: '#15803d' };
      case 'Extrato': return { bg: '#fef3c7', text: '#b45309' };
      case 'IRPF': return { bg: '#f3e8ff', text: '#7e22ce' };
      case 'RG/CPF': return { bg: '#ffe4e6', text: '#be123c' };
      case 'Residência': return { bg: '#ffedd5', text: '#c2410c' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <aside 
      aria-label="Documentos e Anexos"
      style={{
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header da Coluna 3 */}
      <div 
        style={{
          padding: '16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafafa'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiPaperclip size={18} style={{ color: '#f97316' }} />
          <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
            DOC E ANEXOS ({documentos.length})
          </h3>
        </div>
        <span 
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: '#ffedd5',
            color: '#c2410c'
          }}
        >
          Pasta Ativa
        </span>
      </div>

      {/* Seletor de Categoria Rápida */}
      <div style={{ padding: '12px 16px 6px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
          Marcar categoria ao anexar:
        </span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {CATEGORY_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedCategory(tag === selectedCategory ? 'Geral' : tag)}
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                border: selectedCategory === tag ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                backgroundColor: selectedCategory === tag ? '#eff6ff' : '#f8fafc',
                color: selectedCategory === tag ? '#0369a1' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.1s ease'
              }}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Área de Upload Drag-and-Drop */}
      <div style={{ padding: '12px 16px' }}>
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          style={{ display: 'none' }}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed #0284c7' : '1.5px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '16px 12px',
            textAlign: 'center',
            backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FiUploadCloud size={24} style={{ color: isDragging ? '#0284c7' : '#64748b' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
            Arraste ou Clique para Anexar
          </span>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            PDF, Imagens, Holerites, SICAQ até 50MB
          </span>
        </div>
      </div>

      {/* Lista de Documentos Anexados */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {documentos.length === 0 ? (
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '30px 10px', 
              color: '#94a3b8', 
              fontSize: '0.76rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #e2e8f0'
            }}
          >
            <FiPaperclip size={24} style={{ marginBottom: '6px', opacity: 0.4 }} />
            <p style={{ margin: 0, fontWeight: 700, color: '#64748b' }}>Nenhum documento anexado ainda.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem' }}>Anexe os arquivos reais enviados pelo cliente/corretor.</p>
          </div>
        ) : (
          documentos.map((doc) => {
            const catStyle = getCategoryColor(doc.categoria);
            return (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                  {doc.tipo === 'Imagem' ? (
                    <FiImage size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                  ) : (
                    <FiFile size={18} style={{ color: '#0284c7', flexShrink: 0 }} />
                  )}

                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <span 
                      style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: 700, 
                        color: '#0f172a', 
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={doc.nome}
                    >
                      {doc.nome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {doc.tamanho} • {doc.data}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: catStyle.bg,
                      color: catStyle.text,
                      flexShrink: 0
                    }}
                  >
                    {doc.categoria}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(doc)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Baixar arquivo original"
                  >
                    <FiDownload size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Remover anexo"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
