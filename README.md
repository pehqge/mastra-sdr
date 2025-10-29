# 🤖 Mastra SDR Agent

An intelligent Sales Development Representative (SDR) AI agent built with [Mastra AI Framework](https://mastra.ai), capable of analyzing leads from Google Sheets and sending personalized sales emails.

## ✨ Features

- 🔐 **Google OAuth 2.0** - Seamless authentication for Google services
- 📊 **Google Sheets Integration** - Read and analyze lead data automatically
- 📧 **Email Automation** - Send personalized emails via Resend
- 🧠 **Smart Working Memory** - Thread-scoped context for multi-turn conversations
- 🎯 **MVP Ready** - Simple prompts for easy testing, with advanced versions backed up
- 🏗️ **Clean Architecture** - Modular, scalable, and maintainable codebase

## 🚀 Quick Start

### Prerequisites

- Node.js v18 or higher
- pnpm (recommended) or npm
- Google Cloud Project with OAuth credentials
- Resend API key (for email sending)
- OpenAI API key

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
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4111/auth/google/callback
RESEND_API_KEY=your_resend_api_key
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

- **[Agent Specification](./AGENTE_SDR_ESPECIFICACAO.md)** - Complete technical specification (Portuguese)
- **[OAuth Setup Guide](./OAUTH_SETUP_GUIDE.md)** - Step-by-step OAuth configuration
- **[Implementation Plan](./IMPLEMENTATION_PLAN.md)** - Development roadmap and phases

## 🏗️ Architecture

```
src/mastra/
├── agents/
│   ├── sdr-agent.ts              # Main SDR agent configuration
│   └── prompts/
│       ├── sdr-system-prompt.ts  # MVP system prompt
│       └── sdr-working-memory-template.ts
├── auth/
│   └── google-oauth-routes.ts    # OAuth endpoints
├── tools/
│   ├── google-oauth-tool.ts      # OAuth link generator
│   ├── google-sheets-reader.ts   # Sheets data reader
│   └── email-sender.ts           # Email sender (Resend)
└── index.ts                      # Mastra instance configuration
```

## 🔐 OAuth Flow

The agent implements a user-friendly OAuth flow:

1. **First Time**: User requests to access Google Sheets
2. **Agent**: Generates OAuth authorization link
3. **User**: Clicks link, authorizes in Google
4. **Success Page**: Displays access token with copy button
5. **User**: Pastes token back to agent
6. **Automatic**: All subsequent requests use stored token

## 🧪 Testing

### Test the OAuth Flow

```bash
# 1. Start the server
pnpm run dev

# 2. Open Playground
open http://localhost:4111/

# 3. Chat with sdr-agent
"I want to access my Google Sheet"
```

### Test Google Sheets Reading

```
"Read this sheet: [your Google Sheets URL]"
```

### Test Email Sending

```
"Send a test email to test@example.com"
```

## 🛠️ Development

### Project Structure

- **MVP Prompts**: Simple prompts in `src/mastra/agents/prompts/*.ts`
- **Advanced Prompts**: Backed up in `*.advanced.ts.backup` files
- **Documentation**: Comprehensive guides in Markdown files
- **Configuration**: Environment-based configuration for flexibility

### Adding New Tools

1. Create tool in `src/mastra/tools/`
2. Import and add to agent in `src/mastra/agents/sdr-agent.ts`
3. Update system prompt to describe the new tool
4. Test in Playground

### Deployment

The agent can be deployed to various platforms:
- Vercel
- Cloudflare Workers
- AWS Lambda
- Docker containers

See [Mastra Deployment Docs](https://docs.mastra.ai/deployment) for details.

## 📚 Key Technologies

- **[Mastra AI](https://mastra.ai)** - AI agent framework
- **TypeScript** - Type-safe development
- **Google APIs** - Sheets and Gmail integration
- **Resend** - Modern email API
- **LibSQL** - Lightweight database for storage

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Mastra AI Framework](https://mastra.ai)
- OAuth implementation inspired by Google's best practices
- Email sending powered by [Resend](https://resend.com)

## 📬 Contact

- **Repository**: [github.com/techlibs/mastra-sdr](https://github.com/techlibs/mastra-sdr)
- **Issues**: [Report bugs or request features](https://github.com/techlibs/mastra-sdr/issues)

---

Made with ❤️ using Mastra AI

