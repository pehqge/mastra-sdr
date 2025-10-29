# Especificação Técnica: Agente SDR Inteligente

## Visão Geral do Sistema

Este documento detalha a arquitetura e implementação de um agente SDR (Sales Development Representative) inteligente construído com Mastra Framework. O agente é capaz de analisar leads em massa, pesquisar informações sobre cada cliente, avaliar fit de mercado e gerar mensagens personalizadas de prospecção.

---

## 1. Arquitetura Geral

### 1.1 Componentes Principais

O sistema é composto por três camadas principais:

#### **Camada de Agentes**
- **SDR Agent Principal**: Agente orquestrador que gerencia todo o fluxo de interação
- Utiliza working memory thread-scoped para manter contexto da empresa/produto do cliente
- Responsável pela comunicação com o usuário e tomada de decisões estratégicas

#### **Camada de Workflows**
- **Lead Analysis Workflow**: Workflow principal que processa a tabela de leads
- Gerencia paralelização de pesquisas
- Coordena integração com Google Sheets
- Orquestra disparo de emails em massa

#### **Camada de Tools**
- **Google Sheets Tool**: Leitura e escrita em planilhas
- **Web Search Tool (Tavily MCP)**: Pesquisa web semântica
- **Email Sender Tool**: Disparo via Gmail ou Resend
- **Lead Analyzer Tool**: Análise e scoring de leads
- **Message Generator Tool**: Geração de mensagens personalizadas

---

## 2. Agente SDR Principal

### 2.1 Propósito e Características

O agente SDR é o ponto central de interação com o usuário. Suas responsabilidades incluem:

- Conduzir conversação inicial para entender a empresa do cliente
- Coletar informações sobre o produto/serviço a ser oferecido
- Gerenciar autenticação com serviços externos (Google, Resend)
- Orquestrar execução do workflow de análise de leads
- Apresentar planos de pesquisa para aprovação do usuário
- Sugerir e aplicar filtros para disparo de emails

### 2.2 Working Memory (Thread-Scoped)

A working memory do agente utiliza **thread-scope** (não resource-scope), pois:
- Cada conversa representa uma empresa/produto diferente
- O usuário pode criar múltiplas conversas para diferentes contextos
- Informações de uma empresa não devem vazar para outra

**Estrutura da Working Memory:**

A memória deve armazenar em formato Markdown template:
- Nome da empresa do cliente
- Segmento/indústria de atuação
- Porte da empresa (pequena, média, grande)
- Produto/serviço a ser oferecido
- Descrição detalhada do produto
- Público-alvo ideal
- Proposta de valor principal
- Tom de comunicação preferido (formal, casual, técnico)
- Diferenciais competitivos

**Atualização da Working Memory:**

A cada nova conversa, o agente deve:
1. Perguntar se o usuário deseja usar as mesmas informações da última vez
2. Se "sim", manter working memory intacta
3. Se "não", perguntar especificamente o que deseja alterar
4. Atualizar apenas os campos solicitados
5. Validar que informações essenciais (empresa, produto) estão presentes

### 2.3 Fluxo de Interação

**Fase 1: Onboarding Inicial**
1. Verificar se existe working memory com informações anteriores
2. Se sim, confirmar com usuário se deseja manter ou alterar
3. Se não, iniciar questionário sobre a empresa:
   - "Qual é o nome da sua empresa?"
   - "Em qual segmento sua empresa atua?"
   - "Qual o porte da empresa?"
   - "Me conte sobre o produto/serviço que você quer oferecer"
   - "Quem é seu cliente ideal?"
   - "Qual o tom de comunicação você prefere?"

**Fase 2: Configuração de Envio**
1. Perguntar qual método de envio preferido:
   - Gmail (até 500 emails/dia, gratuito)
   - Resend (100/dia grátis, $20/mês para 50k)
2. Se Gmail: gerar link OAuth do Google
   - Explicar que o usuário receberá um link
   - O link permite acesso a Gmail e Sheets
   - Uma única autorização serve para tudo
3. Se Resend: instruir sobre API key
   - Explicar como logar no Resend
   - Onde encontrar a API key
   - Pedir para enviar a key

**Fase 3: Teste de Conexão**
1. Após autenticação, testar conexão com Gmail/Resend
2. Testar conexão com Google Sheets
3. Informar sucesso ou falha de cada conexão
4. Se falha, orientar troubleshooting

**Fase 4: Link do Google Sheets**
1. Pedir o link da planilha com os leads
2. Validar formato do link
3. Explorar estrutura da planilha:
   - Identificar colunas existentes
   - Verificar dados disponíveis
   - Confirmar com usuário as colunas relevantes

**Fase 5: Planejamento de Pesquisa**
1. Analisar colunas disponíveis (nome empresa, email, etc)
2. Criar plano de pesquisa para cada lead:
   - O que pesquisar (site, LinkedIn, notícias)
   - Que informações buscar
   - Estratégia de análise
3. **MOSTRAR o plano ao usuário** antes de executar
4. Aguardar aprovação do usuário

**Fase 6: Execução de Pesquisas**
1. Executar workflow de análise de leads
2. Processar leads em paralelo (concorrência configurável)
3. Popular planilha com:
   - Coluna "Resumo do Lead" (análise detalhada)
   - Coluna "Possível Cliente" (sim/não + justificativa)
   - Coluna "Mensagem Personalizada" (texto pronto para envio)
4. Informar progresso ao usuário

**Fase 7: Filtros e Disparo**
1. Informar conclusão da análise
2. Sugerir filtros inteligentes:
   - "Apenas possíveis clientes"
   - "Empresas de porte médio/grande"
   - "Setores específicos"
3. Perguntar se usuário quer aplicar filtros customizados
4. Confirmar quantidade de emails a serem enviados
5. Executar disparo em massa
6. Informar conclusão

---

## 3. Tools Customizadas

### 3.1 Google Sheets Tool

**Propósito:** Integração completa com Google Sheets para leitura e escrita de dados.

**Tecnologia:** API oficial do Google Sheets (não MCP).

**Funcionalidades:**

**Read Operations:**
- Ler todas as linhas da planilha
- Identificar colunas automaticamente (headers)
- Retornar dados em formato estruturado (array de objetos)
- Suportar múltiplas abas (sheets)

**Write Operations:**
- Adicionar novas colunas à planilha
- Escrever dados linha por linha
- Fazer batch updates (múltiplas linhas de uma vez)
- Suportar diferentes tipos de dados (texto, número, fórmula)

**Schema da Tool:**

Input:
- `operation`: "read" | "write" | "addColumn"
- `spreadsheetId`: extraído do URL da planilha
- `range`: (opcional) range específico, ex: "A1:Z1000"
- `sheetName`: (opcional) nome da aba específica
- `data`: (para write) dados a serem escritos
- `columnName`: (para addColumn) nome da nova coluna

Output:
- `success`: boolean
- `data`: (para read) array de objetos com dados
- `columns`: array com nomes das colunas
- `rowCount`: número de linhas processadas
- `error`: mensagem de erro se houver

**Autenticação:**

Utilizar OAuth 2.0 do Google:
- Scopes necessários: `spreadsheets`, `gmail.send`
- Configuração no `.env`:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- Fluxo OAuth gera link que usuário clica
- Tokens armazenados no Mastra storage para reuso

### 3.2 Web Search Tool (Tavily MCP)

**Propósito:** Realizar pesquisas web semânticas para coletar informações sobre leads.

**Tecnologia:** Tavily MCP Server (via remote MCP).

**Configuração:**

URL do MCP remoto no `.env`:
```
TAVILY_MCP_URL=https://mcp.tavily.com/mcp/?tavilyApiKey=<TAVILY_API_KEY>
```

**Como Integrar:**

1. Criar `MCPClient` no Mastra
2. Apontar para URL do Tavily MCP
3. Usar `getTools()` para obter ferramentas do Tavily
4. Disponibilizar tools para o workflow

**Funcionalidades do Tavily:**

- **tavily-search**: Pesquisa web com contexto semântico
- **tavily-extract**: Extração de dados de páginas específicas
- **tavily-map**: Mapear estrutura de website
- **tavily-crawl**: Crawler para sites

**Estratégia de Pesquisa:**

Para cada lead, executar:
1. Pesquisa principal: "informações sobre [empresa] [segmento]"
2. Pesquisa secundária: "notícias recentes [empresa]"
3. Pesquisa específica: "[empresa] clientes casos de sucesso"

Combinar resultados das 3 pesquisas para formar resumo completo.

**Schema da Tool Wrapper:**

Input:
- `companyName`: nome da empresa a pesquisar
- `additionalContext`: contexto adicional (segmento, localização)
- `maxResults`: número máximo de resultados por pesquisa

Output:
- `summary`: resumo consolidado das pesquisas
- `sources`: array de URLs consultados
- `keyFindings`: array de descobertas principais
- `confidence`: score de confiança (0-1)

### 3.3 Email Sender Tool

**Propósito:** Enviar emails via Gmail API ou Resend API.

**Tecnologia:** Gmail API ou Resend API (escolha do usuário).

**Configuração Dual:**

A tool deve suportar ambos os provedores:

**Gmail:**
- Usar mesma autenticação OAuth do Sheets
- API endpoint: Gmail API `messages.send`
- Limite: ~500 emails/dia
- Vantagem: Gratuito, integração nativa

**Resend:**
- Autenticação via API Key
- API endpoint: Resend `/emails`
- Limite free: 100 emails/dia
- Limite pago: 50k emails/mês ($20/mês)
- Vantagem: Maior volume, melhor deliverability

**Schema da Tool:**

Input:
- `provider`: "gmail" | "resend"
- `to`: email destinatário
- `subject`: assunto do email
- `body`: corpo do email (HTML ou texto)
- `fromName`: nome do remetente (para Resend)
- `replyTo`: email para resposta

Output:
- `success`: boolean
- `messageId`: ID da mensagem enviada
- `error`: mensagem de erro se houver

**Rate Limiting:**

Implementar controle de taxa:
- Tracking de emails enviados por dia
- Delay entre envios (1-2 segundos)
- Batch processing com retry logic
- Alertar usuário quando próximo do limite

### 3.4 Lead Analyzer Tool

**Propósito:** Analisar informações coletadas e determinar fit do lead.

**Implementação:** Tool customizada com LLM.

**Lógica de Análise:**

Recebe:
- Informações da working memory (empresa cliente, produto)
- Dados do lead (nome, empresa, setor)
- Resumo das pesquisas web sobre o lead

Executa:
1. Comparar setor do lead com público-alvo do cliente
2. Avaliar tamanho/maturidade da empresa do lead
3. Identificar sinais de buying intent (contratando, expansão, funding)
4. Verificar fit de produto (lead precisa do que estamos oferecendo?)
5. Calcular score de prioridade (0-100)

**Schema da Tool:**

Input:
- `leadInfo`: objeto com dados do lead
- `webResearch`: resumo das pesquisas
- `clientContext`: dados da working memory

Output:
- `isPossibleClient`: boolean
- `score`: número 0-100
- `reasoning`: justificativa detalhada
- `keyInsights`: array de insights principais
- `redFlags`: array de sinais negativos
- `strengths`: array de pontos positivos

### 3.5 Message Generator Tool

**Propósito:** Gerar mensagens de prospecção personalizadas.

**Implementação:** Tool customizada com LLM.

**Estratégia de Personalização:**

A mensagem deve conter:
1. **Abertura personalizada**: referência a algo específico do lead
2. **Proposta de valor**: como o produto resolve dor específica do lead
3. **Prova social**: caso de uso relevante (se disponível)
4. **Call-to-action**: próximo passo claro e simples

**Variações por Tom:**
- **Formal**: linguagem corporativa, estrutura tradicional
- **Casual**: linguagem descontraída, mais direta
- **Técnico**: termos específicos, foco em features

**Schema da Tool:**

Input:
- `leadInfo`: objeto com dados do lead
- `leadInsights`: insights da análise
- `clientContext`: dados da working memory
- `tone`: "formal" | "casual" | "technical"
- `maxLength`: limite de caracteres

Output:
- `subject`: linha de assunto do email
- `message`: corpo completo da mensagem
- `personalizationPoints`: array de elementos personalizados usados
- `callToAction`: CTA incluído

---

## 4. Workflow Principal: Lead Analysis

### 4.1 Estrutura Geral

O workflow segue a arquitetura de **suspend/resume** do Mastra para interação humana.

**Características:**
- Utiliza `createWorkflow` e `createStep`
- Implementa suspend em pontos críticos
- Persiste estado via snapshots no Mastra storage
- Suporta retomada após paradas

### 4.2 Steps do Workflow

#### **Step 1: Validate Sheets Connection**

**Input Schema:**
- `spreadsheetUrl`: URL da planilha
- `authToken`: token OAuth do Google

**Lógica:**
1. Extrair `spreadsheetId` do URL
2. Testar conexão com Google Sheets API
3. Validar permissões de leitura/escrita
4. Retornar status de conexão

**Output Schema:**
- `isConnected`: boolean
- `spreadsheetId`: string
- `error`: mensagem de erro opcional

#### **Step 2: Explore Sheet Structure**

**Input Schema:**
- `spreadsheetId`: ID da planilha

**Lógica:**
1. Ler primeira linha (headers)
2. Ler 5 linhas de exemplo para entender dados
3. Identificar colunas relevantes automaticamente:
   - Email (buscar por "email", "e-mail", "mail")
   - Nome/Empresa (buscar por "name", "company", "empresa")
   - Setor/Industry (buscar por "industry", "sector", "setor")
4. Criar mapeamento de colunas

**Output Schema:**
- `headers`: array de nomes de colunas
- `sampleData`: array com 5 linhas de exemplo
- `columnMapping`: objeto mapeando colunas identificadas
- `rowCount`: número total de linhas

**Suspend Point:**
- Apresentar estrutura ao usuário
- Perguntar se mapeamento está correto
- Permitir ajustes manuais

#### **Step 3: Create Research Plan**

**Input Schema:**
- `sheetStructure`: estrutura da planilha
- `clientContext`: dados da working memory

**Lógica:**
1. Para cada coluna identificada, definir:
   - Quais informações já temos
   - Quais informações precisamos buscar
   - Estratégia de pesquisa
2. Criar plano estruturado:
   - Pesquisa principal (sobre a empresa)
   - Pesquisas secundárias (notícias, casos)
   - Análise de fit
   - Geração de mensagem
3. Estimar tempo de execução (~10-15s por lead)

**Output Schema:**
- `researchPlan`: objeto detalhado do plano
- `estimatedTime`: tempo estimado em segundos
- `leadsToProcess`: número de leads

**Suspend Point:**
- **MOSTRAR plano completo ao usuário**
- Aguardar aprovação explícita
- Permitir ajustes antes de executar

#### **Step 4: Process Leads in Parallel**

**Input Schema:**
- `spreadsheetId`: ID da planilha
- `researchPlan`: plano aprovado
- `concurrency`: número de leads em paralelo (default: 10)

**Lógica:**

Esta é a etapa mais complexa. Utiliza `.foreach()` com concorrência.

Para cada lead:

1. **Extrair dados do lead** da linha da planilha
2. **Executar pesquisas web** (Tavily MCP):
   - Pesquisa principal
   - Pesquisa secundária
   - Consolidar resultados
3. **Analisar fit do lead** (Lead Analyzer Tool):
   - Calcular score
   - Gerar reasoning
4. **Gerar mensagem personalizada** (Message Generator Tool):
   - Subject
   - Body
5. **Escrever de volta na planilha**:
   - Coluna "Resumo do Lead"
   - Coluna "Possível Cliente" (Sim/Não + Score)
   - Coluna "Mensagem Personalizada"

**Paralelização:**

Usar `foreach` com `concurrency: 10`:
```typescript
.foreach(processLeadStep, { concurrency: 10 })
```

Isso significa:
- 10 leads processados simultaneamente
- Quando um termina, próximo inicia
- Para 1000 leads: ~1000 segundos (~16 minutos) total

**Tratamento de Erros:**

- Se pesquisa web falhar: marcar lead como "Erro - Sem dados"
- Se análise falhar: tentar novamente 1x
- Se escrita na planilha falhar: salvar em cache local, tentar depois
- Continuar processamento mesmo com falhas individuais

**Output Schema:**
- `processedCount`: número de leads processados
- `successCount`: número de sucessos
- `errorCount`: número de erros
- `results`: array com resumo de cada lead
- `errors`: array com erros encontrados

#### **Step 5: Present Results**

**Input Schema:**
- `results`: resultados do processamento

**Lógica:**
1. Gerar estatísticas:
   - Total de leads processados
   - Quantos são possíveis clientes
   - Score médio
   - Distribuição por setor (se disponível)
2. Criar resumo executivo
3. Identificar top 10 leads (maior score)

**Output Schema:**
- `summary`: resumo executivo
- `stats`: objeto com estatísticas
- `topLeads`: array com top 10 leads
- `spreadsheetUrl`: URL da planilha atualizada

**Suspend Point:**
- Apresentar resultados ao usuário
- Perguntar sobre filtros para envio

#### **Step 6: Determine Email Filters**

**Input Schema:**
- `stats`: estatísticas dos leads
- `results`: todos os leads processados

**Lógica:**
1. Sugerir filtros inteligentes:
   - "Apenas possíveis clientes" (isPossibleClient === true)
   - "Score acima de 70"
   - "Setores X, Y, Z"
2. Perguntar ao usuário qual filtro aplicar
3. Permitir customização via linguagem natural:
   - "Apenas empresas de tecnologia"
   - "Leads com mais de 50 colaboradores"

**Output Schema:**
- `selectedFilter`: filtro escolhido
- `filteredLeads`: array de leads que passaram no filtro
- `emailCount`: número de emails a serem enviados

**Suspend Point:**
- Aguardar escolha de filtro do usuário
- Confirmar quantidade de emails antes de enviar

#### **Step 7: Send Emails in Batch**

**Input Schema:**
- `filteredLeads`: leads selecionados para envio
- `emailProvider`: "gmail" | "resend"

**Lógica:**

Envio em batch com controle de taxa:

1. Dividir leads em batches de 50
2. Para cada batch:
   - Enviar emails com delay de 1-2s entre cada
   - Tracking de sucessos/falhas
   - Atualizar planilha com status de envio
3. Implementar retry logic:
   - Se falhar, tentar 1x após 5s
   - Se falhar novamente, marcar como "Erro"
4. Monitorar limite diário:
   - Gmail: parar aos 490 emails
   - Resend free: parar aos 95 emails

**Output Schema:**
- `sentCount`: emails enviados com sucesso
- `failedCount`: emails com falha
- `skippedCount`: emails pulados (limite atingido)
- `sendDetails`: array com status de cada envio

---

## 5. Configuração de Autenticação

### 5.1 Google OAuth 2.0

**Setup no `.env`:**
```
GOOGLE_CLIENT_ID=<obtido do Google Cloud Console>
GOOGLE_CLIENT_SECRET=<obtido do Google Cloud Console>
GOOGLE_REDIRECT_URI=<URL de callback da aplicação>
```

**Fluxo OAuth:**

1. Mastra gera URL de autorização
2. Usuário clica e autoriza no Google
3. Google redireciona para `GOOGLE_REDIRECT_URI` com `code`
4. Mastra troca `code` por `access_token` e `refresh_token`
5. Tokens salvos no Mastra storage associados ao thread atual
6. Tokens refreshados automaticamente quando expiram

**Scopes Necessários:**
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/gmail.send`

### 5.2 Resend API Key

**Setup no `.env`:**
```
# Não colocar key fixa aqui - usuário fornece
```

**Fluxo:**

1. Agente detecta escolha de Resend
2. Fornece instruções:
   - Acesse resend.com
   - Faça login
   - Vá em API Keys
   - Crie nova key
   - Copie e envie no chat
3. Agente armazena key no Mastra storage (thread-scoped)
4. Key reutilizada em envios subsequentes
5. Key nunca exposta em logs ou outputs

### 5.3 Tavily MCP

**Setup no `.env`:**
```
TAVILY_API_KEY=<key obtida em tavily.com>
TAVILY_MCP_URL=https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}
```

**Configuração no Mastra:**

Criar `MCPClient` apontando para URL remota:
- ID: "tavily-mcp-client"
- Server URL: TAVILY_MCP_URL do .env
- Usar `getTools()` para obter tools
- Tools disponibilizadas automaticamente para workflows

---

## 6. Gerenciamento de Erros e Edge Cases

### 6.1 Erros de Autenticação

**Google OAuth:**
- **Token expirado**: Refresh automático via refresh_token
- **Token revogado**: Pedir reautenticação
- **Scopes insuficientes**: Pedir autorização com scopes corretos

**Resend API:**
- **Key inválida**: Pedir key novamente
- **Key sem permissão**: Verificar configuração no Resend

### 6.2 Erros de API

**Google Sheets:**
- **Rate limit**: Implementar exponential backoff
- **Planilha não encontrada**: Validar URL com usuário
- **Sem permissão**: Verificar se sheet está compartilhado

**Tavily Search:**
- **Rate limit**: Reduzir concorrência temporariamente
- **Sem resultados**: Marcar lead como "Pesquisa inconclusiva"
- **API down**: Pausar workflow, notificar usuário

**Email APIs:**
- **Rate limit diário**: Parar envios, informar limite atingido
- **Email inválido**: Pular lead, marcar erro
- **Bounce/Reject**: Log para análise posterior

### 6.3 Erros de Workflow

**Suspend timeout:**
- Se usuário não responder em X horas, pausar workflow
- Permitir retomada quando usuário voltar
- Snapshot garante estado preservado

**Falha parcial no processamento:**
- Continuar com leads que funcionaram
- Gerar relatório de erros
- Oferecer reprocessamento dos leads com erro

### 6.4 Validações de Entrada

**URL da planilha:**
- Aceitar formatos: `https://docs.google.com/spreadsheets/d/{ID}...`
- Extrair ID corretamente
- Validar existência antes de processar

**Working Memory:**
- Validar que campos essenciais estão preenchidos
- Avisar se faltam informações críticas
- Sugerir exemplos para campos vagos

**Filtros de envio:**
- Validar que filtro resulta em leads > 0
- Avisar se filtro é muito restritivo (< 5 leads)
- Confirmar antes de filtros que eliminam > 90% dos leads

---

## 7. Otimizações de Performance

### 7.1 Paralelização Inteligente

**Concorrência Dinâmica:**
- Começar com concorrência 10
- Se APIs respondem rápido: aumentar para 15
- Se rate limit: reduzir para 5
- Ajustar dinamicamente durante execução

**Batch Processing:**
- Agrupar writes na planilha (batch de 50)
- Não escrever linha por linha
- Reduz chamadas de API

### 7.2 Caching

**Cache de Pesquisas:**
- Se mesmo lead aparece 2x: reusar pesquisa anterior
- Cache válido por 7 dias
- Armazenar em Mastra storage

**Cache de Análises:**
- Se empresa já foi analisada: reusar análise
- Verificar por nome normalizado (lowercase, trim)

### 7.3 Monitoramento de Progresso

**Feedback em Tempo Real:**
- A cada 10 leads processados: update ao usuário
- Mostrar: "15/100 leads processados (15%)"
- Estimar tempo restante

**Snapshot Frequente:**
- Salvar snapshot a cada 50 leads
- Permite retomada sem perder muito progresso
- Configurar `shouldPersistSnapshot` no workflow

---

## 8. Estrutura de Dados

### 8.1 Working Memory Template

```markdown
# Informações da Empresa Cliente

## Dados Básicos
- **Nome da Empresa**: 
- **Segmento/Indústria**: 
- **Porte**: [Pequena/Média/Grande]

## Produto/Serviço Oferecido
- **Nome do Produto**: 
- **Descrição**: 
- **Proposta de Valor**: 
- **Diferenciais**: 

## Público-Alvo Ideal
- **Perfil de Cliente**: 
- **Setores Prioritários**: 
- **Porte de Empresa**: 
- **Sinais de Fit**: 

## Comunicação
- **Tom Preferido**: [Formal/Casual/Técnico]
- **Pontos a Enfatizar**: 
- **Evitar Mencionar**: 
```

### 8.2 Schema do Lead na Planilha

**Colunas Originais (lidas):**
- Nome do Lead / Empresa
- Email
- Telefone (opcional)
- Cargo (opcional)
- Setor (opcional)
- Website (opcional)

**Colunas Adicionadas (escritas):**
- **Resumo do Lead**: texto longo com insights da pesquisa
- **Possível Cliente**: "Sim (Score: 85)" ou "Não (Score: 30)"
- **Justificativa**: raciocínio sobre o fit
- **Mensagem Personalizada**: email pronto para envio
- **Status Envio**: "Enviado", "Erro", "Pendente", "Não enviado"
- **Data Processamento**: timestamp

---

## 9. Fluxo de Dados Completo

### 9.1 Diagrama de Fluxo

```
[Usuário] 
    ↓
[Conversa com SDR Agent]
    ↓
[Working Memory atualizada]
    ↓
[Autenticação Google OAuth]
    ↓
[Link Google Sheets fornecido]
    ↓
[Workflow: Lead Analysis]
    ├── [Step 1: Validate Connection]
    ├── [Step 2: Explore Structure] → [SUSPEND: Confirmar estrutura]
    ├── [Step 3: Create Plan] → [SUSPEND: Aprovar plano]
    ├── [Step 4: Process Leads]
    │       ├── [Para cada lead em paralelo:]
    │       │     ├── [Web Search Tool (Tavily MCP)]
    │       │     ├── [Lead Analyzer Tool]
    │       │     ├── [Message Generator Tool]
    │       │     └── [Google Sheets Write]
    │       └── [Repeat com concurrency=10]
    ├── [Step 5: Present Results]
    ├── [Step 6: Determine Filters] → [SUSPEND: Escolher filtro]
    └── [Step 7: Send Emails]
            ├── [Email Sender Tool (Gmail/Resend)]
            └── [Update Status na Planilha]
    ↓
[Usuário] ← [Relatório final]
```

### 9.2 Persistência de Estado

**Durante Suspensão:**
- Snapshot completo salvo no Mastra storage
- Inclui:
  - Working memory state
  - Workflow progress
  - Dados parciais processados
  - Tokens de autenticação
  - Resumo de erros

**Durante Retomada:**
- Snapshot recuperado do storage
- Estado restaurado exatamente
- Workflow continua do ponto de parada
- Usuário não perde contexto

---

## 10. Considerações de Segurança

### 10.1 Proteção de Credenciais

**Tokens OAuth:**
- Nunca logar tokens em plaintext
- Armazenar encrypted no Mastra storage
- Refresh tokens com rotação
- Expiração automática após inatividade

**API Keys:**
- Resend key nunca em logs
- Não retornar em outputs de tools
- Validar formato antes de armazenar

### 10.2 Dados Sensíveis

**Informações de Leads:**
- Não compartilhar entre threads
- Thread-scoped garante isolamento
- Não cachear emails/telefones
- LGPD compliance: direito ao esquecimento

**Working Memory:**
- Dados da empresa cliente são sensíveis
- Não expor em traces/logs
- Permitir limpeza manual

### 10.3 Rate Limiting

**Proteção de APIs:**
- Limites respeitados rigorosamente
- Tracking de uso diário
- Alertas antes de atingir limite
- Graceful degradation quando próximo

---

## 11. Testes e Validação

### 11.1 Testes de Unidade

**Tools:**
- Mock Google Sheets API
- Mock Tavily responses
- Validar schemas de input/output
- Testar error handling

**Workflow Steps:**
- Testar cada step isoladamente
- Mock dependências
- Validar transformação de dados
- Testar suspend/resume

### 11.2 Testes de Integração

**Fluxo Completo:**
- Planilha de teste com 10 leads
- Executar workflow end-to-end
- Validar todas as colunas criadas
- Verificar conteúdo das mensagens

**Autenticação:**
- Testar OAuth flow completo
- Validar refresh de tokens
- Testar erro de token inválido

### 11.3 Testes de Performance

**Paralelização:**
- Medir tempo com 100 leads
- Validar concurrency funciona
- Verificar não há race conditions

**Rate Limits:**
- Simular approach do limite
- Validar parada preventiva
- Testar retry logic

---

## 12. Melhorias Futuras (Fora de Escopo Inicial)

### 12.1 Funcionalidades Adicionais

- **Follow-up Automático**: emails de follow-up após X dias
- **Dashboard de Métricas**: taxas de abertura, resposta
- **Integração CRM**: sincronizar leads com HubSpot, Salesforce
- **A/B Testing**: testar diferentes mensagens
- **Lead Scoring ML**: modelo treinado para scoring

### 12.2 Otimizações

- **Cache Distribuído**: Redis para cache compartilhado
- **Queue System**: RabbitMQ para processamento assíncrono
- **Webhook de Progresso**: notificar external system
- **Suporte Multi-idioma**: mensagens em EN, ES, PT

---

## 13. Dependências e Versões

### 13.1 Pacotes Principais

**Core:**
- `@mastra/core@latest`
- `@mastra/mcp@latest`
- `@mastra/memory@latest`
- `@mastra/libsql@latest` (storage)

**APIs:**
- `googleapis` (Google Sheets & Gmail)
- `resend` (Resend email)
- `zod` (schema validation)

**Tavily:**
- Não requer instalação (MCP remoto)
- Apenas configuração de URL no .env

### 13.2 Configuração do `.env`

```env
# LLM API Keys
OPENAI_API_KEY=<key-openai>
ANTHROPIC_API_KEY=<key-anthropic-opcional>

# Google OAuth
GOOGLE_CLIENT_ID=<google-cloud-console>
GOOGLE_CLIENT_SECRET=<google-cloud-console>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Tavily MCP
TAVILY_API_KEY=<key-tavily>
TAVILY_MCP_URL=https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}

# Database (para storage)
DATABASE_URL=file:./mastra.db
```

---

## 14. Conclusão

Este documento especifica a arquitetura completa do Agente SDR Inteligente. A implementação deve seguir estas diretrizes, mantendo foco em:

1. **Qualidade sobre velocidade**: Fazer bem feito
2. **Uma coisa por vez**: Implementar incrementalmente
3. **Consultar documentação**: Sempre usar MCP do Mastra
4. **Testes contínuos**: Validar cada componente

A próxima fase é a implementação gradual de cada componente, começando pelo SDR Agent e sua working memory, depois as tools básicas, e finalmente o workflow completo.

