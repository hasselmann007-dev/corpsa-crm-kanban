# Guia de Configuração e Instalação do NotebookLM MCP CLI (`nlm`)

Este guia detalha os passos para instalar e autenticar a ferramenta `notebooklm-mcp-cli` (`nlm`) para integração automatizada com o módulo de **Apuração de Renda** do **CORPSA CRM**.

---

## 1. Pré-requisitos

- **Python 3.10+**: Certifique-se de ter o Python instalado no sistema.
- **`uv` (Gerenciador de Pacotes Python Recomendado)** ou **pip**: `uv` é a ferramenta recomendada para instalar utilitários CLI globais isolados de forma rápida.

Para verificar se o `uv` está instalado:
```bash
uv --version
```

Caso não possua o `uv`, você pode instalá-lo via PowerShell:
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

## 2. Instalação do `notebooklm-mcp-cli`

### Método Recomendado (via `uv tool`)

Execute o comando abaixo para instalar globalmente o `notebooklm-mcp-cli`:
```bash
uv tool install notebooklm-mcp-cli
```

Isso disponibilizará o executável `nlm` no seu terminal/PATH.

### Método Alternativo (via `pip`)

Caso prefira utilizar o `pip` do Python diretamente:
```bash
pip install notebooklm-mcp-cli
```

### Verificação da Instalação

Confirme se o CLI está acessível executando:
```bash
nlm --help
```
Ou:
```bash
nlm --version
```

---

## 3. Autenticação na Conta do Google NotebookLM (`nlm login`)

Para que o CORPSA CRM possa criar notebooks, enviar documentos e realizar consultas automatizadas no NotebookLM, o CLI precisa estar autenticado com uma conta Google.

### Passo a Passo de Login

1. Abra o terminal (PowerShell ou Command Prompt) e execute:
   ```bash
   nlm login
   ```
2. O utilitário iniciará o fluxo de autenticação (abrindo o navegador para login no Google ou solicitando os cookies/credenciais necessárias).
3. Conclua a autenticação na janela do navegador referente à conta Google onde você deseja gerenciar os cadernos do NotebookLM.
4. Após concluir o login, valide a conexão executando:
   ```bash
   nlm notebook list --json
   ```

#### Respostas Esperadas da Verificação de Status:
- **Autenticado com Sucesso**: Retorna um JSON contendo a lista de cadernos existentes (ou `[]` se não houver cadernos).
- **Não Autenticado**: Retorna a mensagem de erro:
  `Error: Profile 'default' not found. Run 'nlm login' first.`

---

## 4. Integração com a Ponte Backend do CORPSA CRM

O CORPSA CRM utiliza uma ponte backend local em Node.js (`server/index.ts` + `server/nlmBridge.ts`) que intercepta requisições da interface do usuário e invoca o CLI `nlm` no sistema operacional.

### Endpoints Disponíveis:

- **`GET /api/nlm/status`**:
  - Verifica se o CLI `nlm` está instalado no sistema.
  - Verifica se o perfil de autenticação `default` está ativo (`nlm notebook list --json`).
  - Retorna `{ installed: true, authenticated: true }` ou mensagem explicativa orientando o usuário a executar `nlm login`.

- **`POST /api/nlm/analyze`**:
  - Recebe os arquivos anexados pelo corretor e as regras de consideração (`regrasConsiderar` e `regrasDesconsiderar`).
  - Conecta ou cria o notebook central `"Apuração de Renda CORPSA"`.
  - Remove fontes/documentos antigos para evitar contaminação de dados de clientes anteriores.
  - Envia os novos documentos para o NotebookLM (`nlm source add --wait`).
  - Executa o prompt de apuração financeira e retorna o JSON estruturado contendo:
    - Renda Bruta
    - Renda Líquida
    - Descontos Desconsiderados
    - Capacidade de Pagamento (30%)
    - Renda Formal vs Informal
    - Parecer detalhado do auditor AI.

---

## 5. Solução de Problemas Comuns

1. **`nlm` não é reconhecido como comando interno**:
   - Certifique-se de que o diretório de ferramentas do `uv` (`~/.local/bin` ou `%USERPROFILE%\.cargo\bin` / `%LOCALAPPDATA%\uv\tools`) está no seu PATH do sistema.

2. **Erro: Profile 'default' not found**:
   - A sessão de autenticação expirou ou ainda não foi inicializada. Execute `nlm login` no terminal.

3. **Demora/Timeout no Processamento**:
   - A adição de fontes volumosas (PDFs com muitas páginas) exige processamento pelo NotebookLM. O backend do CORPSA CRM possui timeout configurado para suportar até 2 minutos por análise.
