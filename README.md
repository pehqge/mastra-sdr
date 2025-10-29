# 🤖 Mastra SDR Agent

An intelligent Sales Development Representative (SDR) AI agent built with [Mastra AI Framework](https://mastra.ai), capable of analyzing leads from Google Sheets at scale, performing web research, and sending personalized sales emails.

## ✨ Features

- 🤖 **Conversational SDR Agent** - Natural conversation flow from discovery to email dispatch
- 🔐 **Google OAuth 2.0** - One-time authentication for Sheets + Gmail
- 📊 **Google Sheets Integration** - Read, analyze, and update lead data automatically
- 🔍 **Web Research** - Automated lead research via Tavily MCP
- 🧠 **AI-Powered Lead Scoring** - Intelligent 0-100 scoring based on multiple criteria
- 📧 **Email Automation** - Send personalized emails via Gmail API (500/day)
- 💾 **Smart Working Memory** - Thread-scoped context with persistent session data
- 🔄 **Complete Workflows** - OAuth setup, lead research, and email dispatch orchestration
- ⚡ **Parallel Processing** - 10 leads researched simultaneously, 8 emails sent in parallel
- 📈 **Progress Tracking** - Real-time updates during long-running operations
- 🏗️ **Production Ready** - Clean architecture, comprehensive error handling, detailed documentation

## 🎯 What It Does

The SDR Agent guides users through a complete sales process:

1. **Discovery Phase** - Asks 8 questions about company and product
2. **OAuth Setup** - One-time Google authentication (Sheets + Gmail)
3. **Lead Research** - Analyzes leads from Google Sheets:
   - Web research via Tavily
   - AI-powered scoring (0-100)
   - Personalized message generation
   - Adds 4 columns to sheet: Summary, Score, Possible Client?, Message
4. **Email Dispatch** - Filters and sends emails in bulk:
   - 6 filter types (high score, possible clients, etc.)
   - Parallel sending (8 emails at once)
   - Real-time progress tracking
   - Sheet status updates

## 🚀 Quick Start

### Prerequisites

- Node.js v18 or higher
- pnpm (recommended) or npm
- Google Cloud Project with OAuth credentials
- OpenAI API key
- Tavily API key (for web research)

### Installation

```bash
# Clone the repository
git clone https://github.com/techlibs/mastra-sdr.git
cd mastra-sdr

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Add your credentials to .env
```

### Configuration

1. **Google OAuth Setup** - Follow the detailed guide in [`OAUTH_SETUP_GUIDE.md`](./OAUTH_SETUP_GUIDE.md)
2. **Environment Variables** - Configure your `.env` file:

```env
# AI Model
OPENAI_API_KEY=your_openai_api_key

# Google OAuth (for Sheets + Gmail)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4111/auth/google/callback

# Tavily MCP (for web research)
TAVILY_API_KEY=your_tavily_api_key

# Database
DATABASE_URL=file:./mastra.db
```

### Running the Agent

```bash
# Start the development server
pnpm run dev

# Access the Mastra Playground
open http://localhost:4111/
```

## 📖 Documentation

### **Main Guides**
- **[Agent Specification](./AGENTE_SDR_ESPECIFICACAO.md)** - Complete technical specification (Portuguese)
- **[OAuth Setup Guide](./OAUTH_SETUP_GUIDE.md)** - Step-by-step OAuth configuration
- **[Implementation Plan](./IMPLEMENTATION_PLAN.md)** - Development roadmap and phases

### **Component Documentation**
- **[Tools README](./src/mastra/tools/README.md)** - Complete documentation of all custom tools:
  - Google OAuth Tool (auth URL generation)
  - Google Sheets Reader (4 reading modes)
  - Google Sheets Writer (update/append operations)
  - Gmail Sender (email dispatch with error handling)
- **[Workflows README](./src/mastra/workflows/README.md)** - Detailed workflow documentation:
  - OAuth Setup Workflow (4 steps with suspend/resume)
  - Lead Research Workflow (5 steps with parallel processing)
  - Email Dispatch Workflow (6 steps with filtering)

## 🏗️ Architecture

```
src/mastra/
├── agents/
│   ├── sdr-agent.ts                    # Main SDR agent with tools and memory
│   └── prompts/
│       ├── sdr-system-prompt.ts        # Conversational SDR prompt (280 lines)
│       ├── sdr-working-memory-template.ts  # Session memory template
│       └── README.md                   # Prompt documentation
│
├── workflows/
│   ├── oauth-setup-workflow.ts         # Google OAuth authentication (4 steps)
│   ├── lead-research-workflow.ts       # Lead analysis with AI (5 steps)
│   ├── email-dispatch-workflow.ts      # Email campaign execution (6 steps)
│   └── README.md                       # Workflows documentation (1,050 lines)
│
├── tools/
│   ├── google-oauth-tool.ts            # OAuth URL generator
│   ├── google-sheets-reader.ts         # Sheets reader (4 modes: full, range, row, metadata)
│   ├── google-sheets-writer.ts         # Sheets writer (update/append modes)
│   ├── gmail-sender.ts                 # Gmail API email sender
│   └── README.md                       # Tools documentation (600 lines)
│
├── auth/
│   └── google-oauth-routes.ts          # OAuth callback routes
│
├── mcp/
│   └── tavily-mcp.ts                   # Tavily MCP client configuration
│
└── index.ts                            # Mastra instance with agents, workflows, routes
```

### Architecture Highlights

- **Conversational Agent**: Guides users through 4 phases (Discovery → OAuth → Research → Email)
- **3 Production Workflows**: Fully orchestrated with suspend/resume points
- **4 Custom Tools**: All documented with examples and error handling
- **Working Memory**: Tracks company info, auth status, and campaign results
- **Parallel Processing**: 10 leads + 8 emails processed simultaneously
- **Error Handling**: Retry logic, exponential backoff, detailed error messages

## 🔄 Complete Flow

```
User: "Hi!"
  ↓
[Phase 1: Discovery]
SDR asks 8 questions about company/product
→ Updates working memory after each answer
  ↓
[Phase 2: OAuth Setup Workflow]
1. Generate OAuth URL
2. User authorizes → paste code
3. Test Sheets connection
4. Return tokens
  ↓
User: [provides Google Sheet link]
  ↓
[Phase 3: Lead Research Workflow]
1. Validate connection
2. Explore sheet structure (SUSPEND for confirmation)
3. Create research plan (SUSPEND for approval)
4. Process leads in parallel (10 at a time):
   - Web research via Tavily
   - AI scoring (0-100)
   - Message generation
   - Batch writes
5. Generate summary
  ↓
User: "Send to high score leads"
  ↓
[Phase 4: Email Dispatch Workflow]
1. Load leads
2. Apply filter (6 types available)
3. Preview campaign (SUSPEND for confirmation)
4. Send emails in parallel (8 at a time)
5. Update sheet status
6. Generate report
  ↓
SDR: "✅ Campaign complete! 127 emails sent"
```

## 🛠️ Tools Overview

### 1. **Google OAuth Tool** 🔐
Generates OAuth 2.0 authorization URLs with required scopes.

```typescript
googleOAuthTool.execute({
  redirectUri: "http://localhost:4111/auth/google/callback"
})
// Returns: { authUrl: "https://accounts.google.com/..." }
```

### 2. **Google Sheets Reader** 📊
Reads data with 4 flexible modes.

```typescript
// Mode: full (entire sheet)
googleSheetsReaderTool.execute({
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  mode: "full",
  parseAsObjects: true
})

// Mode: row (single row, perfect for iteration)
googleSheetsReaderTool.execute({
  mode: "row",
  rowNumber: 5,
  parseAsObjects: true
})
```

### 3. **Google Sheets Writer** ✍️
Writes data with update/append modes.

```typescript
// Add column headers
googleSheetsWriterTool.execute({
  range: "D1:F1",
  values: [["Summary", "Score", "Message"]],
  mode: "update"
})

// Update row data
googleSheetsWriterTool.execute({
  range: "D2:F2",
  values: [["Great fit!", 95, "Hi John..."]],
  mode: "update"
})
```

### 4. **Gmail Sender** 📧
Sends emails via Gmail API (500/day limit).

```typescript
gmailSenderTool.execute({
  to: "prospect@company.com",
  from: "john@acme.com",
  subject: "Quick question",
  body: "Hi Sarah, I noticed...",
  accessToken: "ya29..."
})
// Returns: { success: true, messageId: "18c1f2..." }
```

**See [Tools README](./src/mastra/tools/README.md) for complete documentation.**

## 🔄 Workflows Overview

### 1. **OAuth Setup Workflow** 🔐
One-time Google authentication (Sheets + Gmail).

**Steps:**
1. Generate OAuth URL
2. Wait for authorization & exchange code (SUSPEND)
3. Test Sheets connection
4. Generate report with tokens

**Duration:** ~2 minutes

### 2. **Lead Research Workflow** 🔍
Analyzes leads with AI scoring and message generation.

**Steps:**
1. Validate connection
2. Explore sheet structure (SUSPEND)
3. Create research plan (SUSPEND)
4. Process leads in parallel (10x):
   - Web research (Tavily)
   - AI analysis with scoring
   - Personalized message
   - Batch writes (50 rows)
5. Generate summary

**Duration:** ~47 minutes for 234 leads

**Output:** 4 new columns added to sheet:
- SDR Summary
- Score (0-100)
- Possible Client? (YES/NO)
- Personalized Message

### 3. **Email Dispatch Workflow** 📧
Filters and sends emails in bulk.

**Steps:**
1. Load leads from sheet
2. Apply filter (6 types):
   - possibleClients (YES only)
   - highScore (>= 70)
   - largeCompanies
   - techSector
   - custom
   - all
3. Preview campaign (SUSPEND)
4. Send emails in parallel (8x)
5. Update sheet with status
6. Generate report

**Duration:** ~4 minutes for 127 emails

**See [Workflows README](./src/mastra/workflows/README.md) for complete documentation.**

## 🧪 Testing

### Quick Test Flow

```bash
# 1. Start the server
pnpm run dev

# 2. Open Playground
open http://localhost:4111/

# 3. Start conversation with SDR agent
User: "Hi!"

# 4. Answer 8 discovery questions
# Agent updates working memory after each answer

# 5. Confirm lead analysis
User: "Yes, I want to analyze leads"

# 6. Complete OAuth
# Agent runs OAuth Setup Workflow
# Click auth URL → authorize → paste code

# 7. Provide Google Sheet
User: "https://docs.google.com/spreadsheets/d/1ABC..."

# 8. Approve research plan
# Agent runs Lead Research Workflow
# Confirm structure → approve plan → wait for completion

# 9. Dispatch emails
User: "Send to high score leads only"
# Agent runs Email Dispatch Workflow
# Confirm campaign → wait for completion

# 10. Done!
SDR: "✅ Campaign complete! 127 emails sent"
```

### Individual Component Testing

See respective README files:
- [Tools README](./src/mastra/tools/README.md) - Individual tool testing
- [Workflows README](./src/mastra/workflows/README.md) - Workflow testing

## 🛠️ Development

### Project Structure

- **Agents**: SDR agent with conversational prompts
- **Workflows**: 3 production workflows with suspend/resume
- **Tools**: 4 custom tools with comprehensive error handling
- **Documentation**: READMEs in each directory + main guides
- **Configuration**: Environment-based for flexibility

### Adding New Tools

1. Create tool file in `src/mastra/tools/`
2. Define input/output schemas with Zod
3. Implement execute function
4. Import and add to agent in `src/mastra/agents/sdr-agent.ts`
5. Update system prompt to describe the tool
6. Add documentation to `src/mastra/tools/README.md`
7. Test in Playground

### Adding New Workflows

1. Create workflow file in `src/mastra/workflows/`
2. Define steps with `createStep`
3. Chain steps with `.then()`
4. Add suspend points for user interaction
5. Register in `src/mastra/index.ts`
6. Add documentation to `src/mastra/workflows/README.md`
7. Test end-to-end

### Updating Prompts

1. Edit `src/mastra/agents/prompts/sdr-system-prompt.ts`
2. Update working memory template if needed
3. Test conversational flow
4. Document changes

## 🚀 Deployment

The agent can be deployed to various platforms:

- **Vercel** - Recommended for quick deployment
- **Cloudflare Workers** - Edge computing
- **AWS Lambda** - Serverless
- **Docker** - Container deployment

See [Mastra Deployment Docs](https://docs.mastra.ai/deployment) for details.

### Environment Variables for Production

Ensure these are set:
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (update for your domain)
- `TAVILY_API_KEY`
- `DATABASE_URL`

## 📊 Performance Metrics

| Workflow | Duration | Parallel | API Calls | Output |
|----------|----------|----------|-----------|--------|
| OAuth Setup | ~2 min | No | ~5 | Tokens |
| Lead Research (234 leads) | ~47 min | 10x | ~700+ | Analyzed leads |
| Email Dispatch (127 emails) | ~4 min | 8x | ~130 | Campaign results |

### Optimization Features

- ✅ Parallel processing (10 leads, 8 emails)
- ✅ Batch writes (50 rows at once)
- ✅ Retry logic with exponential backoff
- ✅ Rate limiting (Gmail 500/day)
- ✅ Progress tracking
- ✅ Error handling with fallbacks

## 📚 Key Technologies

- **[Mastra AI](https://mastra.ai)** - AI agent framework with workflows
- **TypeScript** - Type-safe development
- **Google APIs** - Sheets and Gmail integration
- **Tavily MCP** - Web research capabilities
- **LibSQL** - Lightweight database for storage
- **OpenAI GPT-4** - Language model for AI agent
- **Zod** - Schema validation

## 🔐 Security Best Practices

- ✅ Tokens stored with thread-scoped memory
- ✅ OAuth 2.0 with refresh tokens
- ✅ Environment variables for credentials
- ✅ Token obfuscation in outputs
- ✅ Rate limiting to prevent abuse
- ✅ Error messages don't expose sensitive data

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code structure
- Add tests for new features
- Update documentation (README files)
- Use TypeScript types
- Handle errors gracefully
- Add progress tracking for long operations

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Mastra AI Framework](https://mastra.ai)
- OAuth implementation following Google's best practices
- Email sending powered by Gmail API
- Web research powered by [Tavily](https://tavily.com)

## 📬 Contact

- **Repository**: [github.com/techlibs/mastra-sdr](https://github.com/techlibs/mastra-sdr)
- **Issues**: [Report bugs or request features](https://github.com/techlibs/mastra-sdr/issues)
- **Documentation**: Check READMEs in `tools/` and `workflows/` directories

---

Made with ❤️ using Mastra AI

**Status:** 🚀 Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-10-29
