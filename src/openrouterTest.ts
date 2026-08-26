import assert from 'assert';
import { testOpenRouterMcp } from '../tools/openrouterTool.js';

async function runOpenRouterTests() {
  console.log('🚀 Iniciando Teste de Conexão com OpenRouter MCP (https://mcp.openrouter.ai/mcp)...');

  console.log('\nTeste 1: Verificando handshake com endpoint MCP https://mcp.openrouter.ai/mcp');
  const result = await testOpenRouterMcp();
  console.log('Resultado do Teste 1:', {
    connected: result.connected,
    mcpEndpoint: result.mcpEndpoint,
    mcpStatus: result.mcpStatus,
    modelsAvailable: result.modelsAvailable,
    message: result.message
  });

  assert.strictEqual(result.connected, true, 'Deve conectar ao endpoint OpenRouter MCP com sucesso');
  assert.strictEqual(result.mcpEndpoint, 'https://mcp.openrouter.ai/mcp', 'Endpoint deve ser https://mcp.openrouter.ai/mcp');
  console.log('✅ Teste 1 Aprovado: Endpoint MCP acessível e respondendo ao protocolo JSON-RPC.');

  console.log('\n🎉 Todos os testes de integração com OpenRouter MCP foram executados com sucesso!');
}

runOpenRouterTests().catch((err) => {
  console.error('❌ Falha no teste OpenRouter:', err);
  process.exit(1);
});
