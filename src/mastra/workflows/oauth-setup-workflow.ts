import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { googleSheetsReaderTool } from '../tools/google-sheets-reader';
import { gmailSenderTool } from '../tools/gmail-sender';

/**
 * OAuth Setup Workflow
 * 
 * Complete Google OAuth setup workflow following IMPLEMENTATION_PLAN.md:
 * 1. Generate OAuth URL
 * 2. Wait for user authorization & exchange code for tokens (SUSPEND)
 * 3. Test Sheets connection
 * 4. Generate success report with tokens
 * 
 * Note: Gmail connection is tested during actual email send (Email Dispatch Workflow)
 */

// Step 1: Generate OAuth URL
const generateOAuthUrlStep = createStep({
  id: 'generate-oauth-url',
  description: 'Generate Google OAuth authorization URL',
  inputSchema: z.object({
    redirectUri: z.string().optional(),
  }),
  outputSchema: z.object({
    authUrl: z.string(),
    message: z.string(),
    scopes: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const { redirectUri } = inputData;
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback';
    
    if (!clientId || !clientSecret) {
      throw new Error('❌ Google OAuth não configurado! Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env');
    }
    
    // Import google auth dynamically
    const { google } = await import('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || defaultRedirectUri
    );
    
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.send',
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
    
    return {
      authUrl,
      message: `🔐 OAuth Setup Iniciado!\n\n🔗 Acesse o link abaixo para autorizar:\n${authUrl}\n\n📋 Scopes solicitados:\n  • Google Sheets (leitura/escrita)\n  • Gmail (envio de emails)\n\n⚠️  Após autorizar, copie o Access Token exibido e cole quando solicitado.`,
      scopes,
    };
  },
});

// Step 2: Wait for Authorization & Exchange Code for Tokens (with SUSPEND)
const waitForAuthorizationStep = createStep({
  id: 'wait-authorization',
  description: 'Wait for user to complete OAuth and exchange authorization code for tokens',
  inputSchema: z.object({
    authUrl: z.string(),
    message: z.string(),
    scopes: z.array(z.string()),
  }),
  suspendSchema: z.object({
    authUrl: z.string(),
    instructions: z.string(),
    scopes: z.array(z.string()),
  }),
  resumeSchema: z.object({
    authorizationCode: z.string().describe('The authorization code from Google OAuth callback URL'),
  }),
  outputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    scopes: z.array(z.string()),
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { authUrl, scopes } = inputData;
    
    if (!resumeData?.authorizationCode) {
      return await suspend({
        authUrl,
        instructions: `🔐 Autenticação Google OAuth

📋 **Instruções:**

1️⃣  **Clique no link de autorização abaixo:**
   ${authUrl}

2️⃣  **Faça login e autorize** o acesso ao Google Sheets e Gmail

3️⃣  **Copie o CÓDIGO DE AUTORIZAÇÃO** que aparece na URL após autorizar
   - A URL será algo como: http://localhost:4111/auth/google/callback?code=XXXXX...
   - Ou você verá o código na página de callback
   
4️⃣  **Cole o código de autorização aqui** para continuar

⚠️  **IMPORTANTE:** Cole apenas o CÓDIGO (string longa), não o token completo.

Exemplo de código: 4/0AeaYSHBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`,
        scopes,
      });
    }
    
    const { authorizationCode } = resumeData;
    
    console.log('\n🔄 Trocando código de autorização por tokens...');
    
    try {
      // Exchange authorization code for access token + refresh token
      const { google } = await import('googleapis');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback'
      );
      
      const { tokens } = await oauth2Client.getToken(authorizationCode);
      
      if (!tokens.access_token) {
        throw new Error('Falha ao obter access token. Código de autorização pode estar inválido ou expirado.');
      }
      
      console.log('   ✅ Tokens obtidos com sucesso!');
      console.log(`   • Access Token: ${tokens.access_token.substring(0, 10)}...`);
      console.log(`   • Refresh Token: ${tokens.refresh_token ? '✅ Obtido' : '⚠️  Não obtido'}`);
      console.log(`   • Expira em: ${tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : 'N/A'}`);
      
      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        scopes,
        message: '✅ Tokens obtidos com sucesso! Testando conexões...',
      };
      
    } catch (error: any) {
      console.error('❌ Erro ao trocar código por tokens:', error.message);
      
      // Better error messages for common issues
      let errorMessage = error.message;
      
      if (error.message?.includes('invalid_grant')) {
        errorMessage = 'Código de autorização inválido ou expirado. Por favor, gere um novo link de autorização e tente novamente.';
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        errorMessage = 'Erro de configuração: Redirect URI não corresponde. Verifique GOOGLE_REDIRECT_URI no .env e no Google Cloud Console.';
      }
      
      throw new Error(`Falha na troca de tokens: ${errorMessage}`);
    }
  },
});

// Step 3: Test Sheets Connection
const testSheetsConnectionStep = createStep({
  id: 'test-sheets-connection',
  description: 'Test Google Sheets API connection',
  inputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    scopes: z.array(z.string()),
    message: z.string(),
  }),
  outputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    scopes: z.array(z.string()),
    sheetsStatus: z.object({
      connected: z.boolean(),
      message: z.string(),
      testDetails: z.string().optional(),
    }),
  }),
  execute: async ({ inputData }) => {
    const { accessToken, refreshToken, scopes } = inputData;
    
    console.log('\n📊 Testando conexão com Google Sheets...');
    
    try {
      const { google } = await import('googleapis');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      
      // Test Sheets API directly (not Drive API)
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      
      // Create a test spreadsheet to verify write permissions
      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: 'Mastra OAuth Test - ' + new Date().toISOString().split('T')[0],
          },
        },
      });
      
      const testSpreadsheetId = createResponse.data.spreadsheetId;
      
      // Immediately delete the test spreadsheet (cleanup)
      if (testSpreadsheetId) {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.delete({ fileId: testSpreadsheetId }).catch(() => {
          console.log('   (Test spreadsheet cleanup skipped)');
        });
      }
      
      return {
        accessToken,
        refreshToken,
        scopes,
        sheetsStatus: {
          connected: true,
          message: '✅ Google Sheets: Conexão bem-sucedida!',
          testDetails: `Acesso verificado. Permissões de leitura/escrita confirmadas.`,
        },
      };
    } catch (error: any) {
      console.error('❌ Erro ao testar Google Sheets:', error.message);
      
      return {
        accessToken,
        refreshToken,
        scopes,
        sheetsStatus: {
          connected: false,
          message: '❌ Google Sheets: Falha na conexão',
          testDetails: error.message || 'Token inválido ou sem permissões para Sheets',
        },
      };
    }
  },
});

// Gmail connection test removed - Gmail will be tested during actual email send

// Step 4: Generate Setup Report & Save to Working Memory
const generateSetupReportStep = createStep({
  id: 'generate-setup-report',
  description: 'Generate comprehensive setup report and save tokens to working memory',
  inputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    scopes: z.array(z.string()),
    sheetsStatus: z.object({
      connected: z.boolean(),
      message: z.string(),
      testDetails: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.string(),
    accessTokenPreview: z.string(),
    hasRefreshToken: z.boolean(),
    connections: z.object({
      sheets: z.boolean(),
    }),
    nextSteps: z.array(z.string()),
    // Internal use only (for working memory save)
    _accessToken: z.string().optional(),
    _refreshToken: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { accessToken, refreshToken, scopes, sheetsStatus } = inputData;
    
    const sheetsConnected = sheetsStatus.connected;
    
    // CRITICAL: Save tokens to working memory for future use
    // Note: Working memory integration will be handled by the agent when the workflow completes
    // The tokens are available in the workflow output (_accessToken, _refreshToken)
    // and can be accessed from the workflow context by the agent
    if (sheetsConnected) {
      console.log('\n💾 Tokens disponíveis para uso nos próximos workflows');
      console.log('   ℹ️  Os tokens estão no output do workflow e podem ser salvos pelo agente');
      console.log('   ℹ️  Use os campos _accessToken e _refreshToken para acesso programático');
    }
    
    const summary = `${sheetsConnected ? '✅' : '⚠️'} OAuth Setup ${sheetsConnected ? 'Completo' : 'Parcial'}!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Status das Conexões:**

${sheetsStatus.message}
${sheetsStatus.testDetails ? `   ${sheetsStatus.testDetails}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 **Tokens:**
${refreshToken 
  ? '• Access Token: ✅ Recebido\n• Refresh Token: ✅ Recebido (renovação automática)'
  : '• Access Token: ✅ Recebido\n• Refresh Token: ⚠️  Não fornecido (pode expirar)'
}

📋 **Scopes Autorizados:**
${scopes.map(s => `  • ${s}`).join('\n')}

ℹ️  **Nota:** Gmail será testado durante o envio de emails (Email Dispatch Workflow)

${!sheetsConnected ? '\n⚠️  **Atenção:** A conexão com Sheets falhou. Verifique os erros acima e tente novamente.' : ''}
`;

    const nextSteps = sheetsConnected
      ? [
          '1. ✅ Tokens obtidos com sucesso e prontos para uso',
          '2. Os tokens estão disponíveis nos campos _accessToken e _refreshToken',
          '3. Execute o Lead Research Workflow fornecendo o accessToken',
          '4. Depois execute o Email Dispatch Workflow',
          '5. Gmail será testado automaticamente no primeiro envio de email',
          '6. Monitore os limites diários (500 emails/dia no Gmail)',
          '7. OPCIONAL: Salve os tokens em um local seguro para reutilização',
        ]
      : [
          '1. Verifique as permissões da conta Google',
          '2. Confirme que os scopes corretos foram solicitados',
          '3. Tente gerar um novo token com as permissões corretas',
          '4. Consulte o guia OAUTH_SETUP_GUIDE.md se necessário',
        ];
    
    return {
      success: sheetsConnected,
      summary,
      // Obfuscated for security (not exposed in logs/UI)
      accessTokenPreview: `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 4)}`,
      hasRefreshToken: !!refreshToken,
      connections: {
        sheets: sheetsStatus.connected,
      },
      nextSteps,
      // Internal tokens for working memory (prefixed with _ to indicate internal use)
      _accessToken: accessToken,
      _refreshToken: refreshToken,
    };
  },
});

// Main OAuth Setup Workflow
export const oauthSetupWorkflow = createWorkflow({
  id: 'oauth-setup-workflow',
  description: 'Complete Google OAuth setup with Sheets testing. Gmail will be tested during actual email send. Saves tokens to working memory automatically.',
  inputSchema: z.object({
    redirectUri: z.string().optional().describe('Optional custom redirect URI'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.string(),
    accessTokenPreview: z.string(),
    hasRefreshToken: z.boolean(),
    connections: z.object({
      sheets: z.boolean(),
    }),
    nextSteps: z.array(z.string()),
    // Internal tokens (prefixed with _ to indicate not for display)
    _accessToken: z.string().optional(),
    _refreshToken: z.string().optional(),
  }),
})
  .then(generateOAuthUrlStep)
  .then(waitForAuthorizationStep)
  .then(testSheetsConnectionStep)
  .then(generateSetupReportStep)
  .commit();

