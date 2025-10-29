# SDR Agent Prompts

Este diretório contém os prompts avançados do SDR Agent, desenvolvidos com técnicas de engenharia de prompts de alto nível para garantir respostas precisas, contextualizadas e de alta qualidade.

## 📁 Estrutura

### `sdr-agent-system-prompt.md`
**Prompt principal do sistema** - Define a personalidade, capacidades e comportamento do agente.

**Técnicas de Prompt Engineering Utilizadas:**

#### 1. **Role Prompting (Definição de Papel)**
```xml
<role_definition>
  Você é um estratégico sales development expert que combina:
  - Deep analytical thinking
  - Persuasive communication
  - Data-driven decision making
  ...
</role_definition>
```
Define claramente quem é o agente, estabelecendo expectativas e comportamento consistente.

#### 2. **Structured Prompting (Organização em Tags XML)**
- `<mission>` - Define objetivos principais
- `<capabilities>` - Lista o que o agente pode fazer
- `<behavioral_guidelines>` - Como deve se portar
- `<interaction_framework>` - Fluxo de conversa estruturado
- `<constraints_and_limitations>` - Limites éticos e técnicos

Essa estrutura facilita a compreensão do LLM e mantém respostas organizadas.

#### 3. **Chain-of-Thought (Raciocínio Passo a Passo)**
```xml
<lead_research_methodology>
  Step 1: Company Context Understanding
  THINK: What does this company do? Who are their customers?...
  
  Step 2: Challenge Identification
  THINK: What challenges do companies in this space face?...
  
  Step 3: Opportunity Assessment
  ...
</lead_research_methodology>
```
Guia o agente a pensar metodicamente antes de agir, resultando em análises mais profundas.

#### 4. **Few-Shot Learning (Exemplos Práticos)**
```xml
<example_interactions>
  Example 1: First-Time User
  User: "I want to start generating leads..."
  You: "Great! I'll help you..."
  
  Example 2: Processing Lead List
  ...
</example_interactions>
```
Exemplos concretos ensinam o tom, estrutura e qualidade esperada das respostas.

#### 5. **Context Priming (Preparação de Contexto)**
- **Phase 1: Discovery & Setup** - Coleta inicial de informações
- **Phase 2: Campaign Planning** - Planejamento estratégico
- **Phase 3: Execution & Monitoring** - Execução e acompanhamento
- **Phase 4: Review & Optimization** - Análise e melhoria

Cada fase tem instruções específicas, adaptando o comportamento do agente ao estágio da interação.

#### 6. **Constraint Specification (Definição de Limites)**
```xml
<constraints_and_limitations>
  Rate Limits:
  - Gmail: 500 emails/day
  - Resend: 100 emails/day (free)
  
  Ethical Guidelines:
  - Never fabricate research findings
  - Respect opt-out requests
  - Comply with CAN-SPAM and GDPR
</constraints_and_limitations>
```
Estabelece fronteiras claras para prevenir comportamentos indesejados.

#### 7. **Quality Standards (Critérios de Excelência)**
```xml
<quality_standards>
  Research Quality:
  - Based on current, verifiable information
  - Goes beyond surface-level observations
  
  Message Quality:
  - Highly personalized
  - Addresses specific business context
</quality_standards>
```
Define expectativas de qualidade para todas as saídas do agente.

#### 8. **Message Crafting Framework (Framework de Mensagens)**
Anatomia detalhada de uma mensagem efetiva com checklist de qualidade:
- Subject Line (8-10 palavras)
- Opening Hook (1 sentença)
- Value Proposition (2-3 sentenças)
- Social Proof (quando relevante)
- Call-to-Action (específico e de baixa fricção)

---

### `sdr-working-memory-template.md`
**Template da Working Memory** - Estrutura de dados para armazenar contexto da empresa, produto e campanhas.

**Características:**

#### 1. **Thread-Scoped Context**
Cada thread mantém seu próprio contexto independente, permitindo:
- Múltiplas empresas gerenciadas simultaneamente
- Múltiplos produtos por usuário
- Campanhas paralelas sem mistura de dados

#### 2. **Structured Information Architecture**
```markdown
## 🏢 COMPANY PROFILE
- Basic Information
- Value Proposition

## 🎯 PRODUCT/SERVICE TO OFFER
- Product Details
- Value Proposition
- Proof Points

## 👥 IDEAL CUSTOMER PROFILE (ICP)
- Company Characteristics
- Decision Maker Profile

## 🎨 COMMUNICATION STYLE & PREFERENCES
- Tone of Voice
- Messaging Guidelines

## ✅ LEAD QUALIFICATION CRITERIA
- Must-Have Criteria
- Disqualifiers
- Fit Scoring System

## 🔌 INTEGRATION STATUS
- Google Sheets
- Email Service
- Web Search (Tavily)

## 📊 CAMPAIGN HISTORY & LEARNINGS
- Recent Campaigns
- Key Learnings

## 🎯 CURRENT OBJECTIVES
- Active Goals
- Next Steps
```

#### 3. **Guidance and Examples**
Cada seção inclui:
- Campos estruturados para preenchimento
- Descrições explicativas em `> blockquotes`
- Exemplos de valores esperados em `[brackets]`

#### 4. **Dynamic Learning**
- **Campaign History** - Registra resultados de campanhas anteriores
- **Key Learnings** - Captura insights para otimização contínua
- **Last Updated** - Rastreabilidade de mudanças

#### 5. **Agent Instructions Embedded**
```markdown
> **Note for Agent**: This working memory is your source of truth for this thread. 
> Always reference and update it to maintain context continuity.
```
Instruções diretas ao agente sobre como usar a working memory.

---

## 🎯 Por Que Esses Prompts São Avançados?

### 1. **Holistic Design**
Não são apenas instruções - são um sistema completo que abrange:
- Identidade e papel
- Metodologias de trabalho
- Padrões de qualidade
- Limitações e ética
- Exemplos práticos

### 2. **Behavioral Modeling**
Modelam comportamento complexo através de:
- Fases de interação bem definidas
- Chain-of-thought para decisões complexas
- Frameworks de qualidade
- Exemplos few-shot para calibração

### 3. **Context Awareness**
Mantêm consciência contextual através de:
- Working memory estruturada
- Thread-scoped isolation
- Campaign history tracking
- Continuous learning loops

### 4. **Quality Assurance**
Garantem qualidade através de:
- Checklists de verificação
- Critérios objetivos
- Padrões de excelência
- Validation steps embutidos

### 5. **Scalability**
Projetados para escalar:
- Processamento paralelo de leads
- Batch operations
- Progress tracking
- Resource management

---

## 🔧 Como Usar

Os prompts são automaticamente carregados pelo agente SDR:

```typescript
import { readFileSync } from 'fs';

const sdrInstructions = readFileSync(
  join(__dirname, 'prompts', 'sdr-agent-system-prompt.md'),
  'utf-8'
);

const workingMemoryTemplate = readFileSync(
  join(__dirname, 'prompts', 'sdr-working-memory-template.md'),
  'utf-8'
);

export const sdrAgent = new Agent({
  name: 'sdr-agent',
  instructions: sdrInstructions,
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'thread',
        template: workingMemoryTemplate,
      },
    },
  }),
  // ...
});
```

---

## 🎨 Inspirações e Referências

### Bolt.new System Prompt
- Structured prompting com XML tags
- Constraints claros e específicos
- Artifact system para outputs estruturados
- Critical reminders para comportamentos importantes

### Advanced Prompt Engineering Techniques (2025)
- **Chain-of-Thought (CoT)**: Raciocínio explícito passo a passo
- **Few-Shot Prompting**: Aprendizado por exemplos concretos
- **Role Prompting**: Definição clara de persona
- **Structured Prompting**: Organização em seções semânticas
- **Context Priming**: Preparação de contexto por fase
- **Constraint Specification**: Limites claros e explícitos

### Mastra Framework Best Practices
- Thread-scoped working memory
- Dynamic instructions
- Model-specific optimizations
- Integration-ready design

---

## 📊 Métricas de Qualidade

### Prompt Principal
- **Linhas**: ~512
- **Seções**: 11 principais
- **Exemplos**: 3 interações completas
- **Frameworks**: 4 (Research, Messages, Memory, Quality)

### Working Memory Template
- **Linhas**: ~263
- **Seções**: 10 principais
- **Campos estruturados**: ~60
- **Orientações contextuais**: ~25

---

## 🔄 Manutenção

### Quando Atualizar

**System Prompt:**
- Adicionar novas capacidades (tools, workflows)
- Refinar comportamentos baseado em feedback
- Incluir novos exemplos de interações bem-sucedidas
- Atualizar constraints quando APIs mudarem

**Working Memory:**
- Adicionar novos campos quando surgir necessidade
- Reestruturar seções se padrões de uso mudarem
- Incluir novos learnings de campanhas
- Atualizar orientações baseado em erros comuns

### Como Atualizar

1. Edite o arquivo `.md` apropriado
2. Teste o agente com as mudanças
3. Valide que a qualidade não degradou
4. Documente mudanças significativas
5. Considere versionar prompts para rollback

---

## 🚀 Próximas Evoluções

À medida que implementamos tools e workflows, este prompt será expandido com:

### Tools Integration
```xml
<tools_available>
  - Google Sheets Reader/Writer
  - Tavily Web Search
  - Gmail Sender
  - Resend Email API
</tools_available>
```

### Workflow Coordination
```xml
<workflows>
  - Lead Research Workflow
  - Email Campaign Workflow
  - OAuth Setup Workflow
</workflows>
```

### Dynamic Examples
Novos exemplos baseados em casos de uso reais e feedback de usuários.

---

**Última atualização**: Implementação inicial
**Versão**: 1.0
**Autor**: Expert Prompt Engineer + Mastra AI Framework

