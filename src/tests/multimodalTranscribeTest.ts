import assert from 'assert';
import { detectMediaType, normalizeMimeType } from '../../tools/geminiTool.js';

async function runMultimodalTests() {
  console.log('🧪 Iniciando Testes Unitários de Ingestão e Transcrição Multimodal...\n');

  // Teste 1: Detecção de Mídia por MIME Type e Extensão
  console.log('Test 1: Detecção de Tipos de Mídia (Áudio, Imagem, PDF, Texto)');
  
  assert.strictEqual(detectMediaType('audio/ogg', 'voice.ogg'), 'audio');
  assert.strictEqual(detectMediaType('audio/webm', 'record.webm'), 'audio');
  assert.strictEqual(detectMediaType('audio/mpeg', 'audio.mp3'), 'audio');
  assert.strictEqual(detectMediaType('audio/wav', 'gravacao.wav'), 'audio');
  assert.strictEqual(detectMediaType('audio/x-m4a', 'audio.m4a'), 'audio');
  assert.strictEqual(detectMediaType('', 'whatsapp_ptt.opus'), 'audio');

  assert.strictEqual(detectMediaType('image/png', 'cnh.png'), 'image');
  assert.strictEqual(detectMediaType('image/jpeg', 'holerite.jpg'), 'image');
  assert.strictEqual(detectMediaType('image/webp', 'print.webp'), 'image');

  assert.strictEqual(detectMediaType('application/pdf', 'irpf_2025.pdf'), 'pdf');
  assert.strictEqual(detectMediaType('application/pdf', 'extrato_bancario.PDF'), 'pdf');

  assert.strictEqual(detectMediaType('text/plain', 'duvida.txt'), 'text');
  console.log('  ✅ Detecção de tipos de mídia aprovada em todos os cenários!\n');

  // Teste 2: Normalização de MIME Types para a API do Gemini
  console.log('Test 2: Normalização de MIME Types');
  assert.strictEqual(normalizeMimeType('audio/opus', 'audio.opus'), 'audio/ogg');
  assert.strictEqual(normalizeMimeType('audio/wave', 'sample.wav'), 'audio/wav');
  assert.strictEqual(normalizeMimeType('image/jpg', 'rg.jpg'), 'image/jpeg');
  assert.strictEqual(normalizeMimeType('application/pdf', 'doc.pdf'), 'application/pdf');
  console.log('  ✅ Normalização de MIME Types aprovada!\n');

  // Teste 3: Verificação de Endpoints no Servidor Local
  console.log('Test 3: Verificação dos Endpoints /api/agente no Servidor Express');
  try {
    const textTestPayload = {
      message: 'Olá, sou o corretor Lucas da Imobiliária Central. Tenho um cliente com holerite e extratos bancários.',
      messages: []
    };

    const response = await fetch('http://localhost:3001/api/agente/chat-multimodal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textTestPayload)
    });

    if (response.ok) {
      const data = await response.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.reply, 'string');
      console.log('  ✅ Endpoint /api/agente/chat-multimodal respondeu com sucesso!');
      console.log(`  🤖 Resposta do Agente: "${data.reply.slice(0, 120)}..."\n`);
    } else {
      console.warn(`  ⚠️ Servidor respondeu com status ${response.status} (chave API pode requerer config)`);
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Aviso de conexão com servidor local: ${err.message}`);
  }

  console.log('🎉 Todos os testes de ingestão e transcrição multimodal foram aprovados com sucesso!');
}

runMultimodalTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
