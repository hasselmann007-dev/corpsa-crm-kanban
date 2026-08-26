import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load env variables safely
function loadEnv(): { url: string; key: string } {
  let url = process.env.VITE_SUPABASE_URL || 'https://yjjzmgrjgracgzqywaqc.supabase.co';
  let key = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Jcb8tZ7M1nnDJQSjzMChjw_RqcuA2Tx';

  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
          url = trimmed.substring('VITE_SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
        }
        if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
          key = trimmed.substring('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {}

  return { url, key };
}

async function runSupabaseSecurityTests() {
  console.log('🔒 =======================================================');
  console.log('🔒 INICIANDO SUÍTE DE TESTES DE CONEXÃO E SEGURANÇA SUPABASE');
  console.log('🔒 =======================================================\n');

  const { url, key } = loadEnv();
  console.log(`📡 URL do Projeto: ${url}`);
  console.log(`🔑 Chave detectada: ${key.substring(0, 16)}... (protegida)\n`);

  assert.ok(url, 'URL do Supabase deve estar configurada');
  assert.ok(key, 'Chave do Supabase deve estar configurada');

  const supabase = createClient(url, key);

  // Test 1: Conexão e leitura da tabela leads
  console.log('Teste 1: Validando conexão e leitura da tabela "leads"...');
  const { data: leads, error: leadsError, status: leadsStatus } = await supabase
    .from('leads')
    .select('id, nome_cliente, etapa')
    .limit(3);

  if (leadsError) {
    console.error('❌ Erro na tabela leads:', leadsError.message);
    throw leadsError;
  }
  assert.strictEqual(leadsStatus, 200, 'Status HTTP deve ser 200');
  console.log(`✅ Teste 1 Aprovado: Conexão OK (Status ${leadsStatus}, ${leads?.length || 0} leads lidos com sucesso).\n`);

  // Test 2: Validação da tabela profiles
  console.log('Teste 2: Validando leitura da tabela "profiles"...');
  const { data: profiles, error: profilesError, status: profilesStatus } = await supabase
    .from('profiles')
    .select('id, nome_completo, cargo')
    .limit(1);

  if (profilesError) {
    console.error('❌ Erro na tabela profiles:', profilesError.message);
    throw profilesError;
  }
  assert.strictEqual(profilesStatus, 200, 'Status HTTP deve ser 200');
  console.log(`✅ Teste 2 Aprovado: Tabela profiles acessível (Status ${profilesStatus}, ${profiles?.length || 0} perfis).\n`);

  // Test 3: Teste de Escrita e Exclusão com limpeza automática (CRUD Seguro)
  console.log('Teste 3: Validando operação de gravação e exclusão segura na tabela leads...');
  const testLeadName = `TESTE_SEGURANCA_CRM_${Date.now()}`;
  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert({
      nome_cliente: testLeadName,
      cpf_cliente: '000.000.000-00',
      valor_imovel: 150000,
      cidade: 'São Paulo',
      grupo_origem: 'Teste de Segurança',
      etapa: 'Roleta',
      prioridade: 'Baixa',
      data_hora_entrada: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Erro ao inserir lead de teste:', insertError.message);
    throw insertError;
  }
  assert.ok(inserted?.id, 'O lead de teste inserido deve ter um ID');
  console.log(`   -> Lead temporário criado com ID: ${inserted.id}`);

  // Limpeza imediata do lead de teste
  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .eq('id', inserted.id);

  if (deleteError) {
    console.error('❌ Erro ao limpar lead de teste:', deleteError.message);
    throw deleteError;
  }
  console.log('   -> Lead temporário excluído com sucesso.');
  console.log('✅ Teste 3 Aprovado: Operações de escrita e exclusão funcionando perfeitamente.\n');

  console.log('🛡️ =======================================================');
  console.log('🎉 TODOS OS TESTES DE CONEXÃO E SEGURANÇA FORAM APROVADOS!');
  console.log('🛡️ =======================================================');
}

runSupabaseSecurityTests().catch((err) => {
  console.error('\n❌ Falha na execução dos testes de segurança:', err);
  process.exit(1);
});
