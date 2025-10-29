import { registerApiRoute } from '@mastra/core/server';
import { google } from 'googleapis';

/**
 * Google OAuth Routes
 * 
 * Handles OAuth flow with Google:
 * 1. /auth/google/start - Generates auth URL (alternative to using the tool)
 * 2. /auth/google/callback - Receives OAuth code and stores tokens
 */

/**
 * Start OAuth flow - generates authorization URL
 */
export const googleOAuthStartRoute = registerApiRoute('/auth/google/start', {
  method: 'GET',
  handler: async (c) => {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback'
      );
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/gmail.send',
        ],
        prompt: 'consent',
      });
      
      return c.json({
        success: true,
        authUrl,
        message: 'Visit the authUrl to authenticate'
      });
      
    } catch (error: any) {
      console.error('OAuth Start Error:', error);
      return c.json({
        success: false,
        error: error.message
      }, 500);
    }
  },
});

/**
 * OAuth callback - receives authorization code and displays it to user
 * User copies the code and pastes it into the OAuth Setup Workflow
 * The workflow will exchange the code for tokens automatically
 */
export const googleOAuthCallbackRoute = registerApiRoute('/auth/google/callback', {
  method: 'GET',
  handler: async (c) => {
    const code = c.req.query('code');
    
    if (!code) {
      return c.html(`
        <html>
          <head>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8d7da; color: #721c24; text-align: center; }
              .container { padding: 20px; border: 1px solid #f5c6cb; border-radius: 5px; background-color: #f8d7da; max-width: 600px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Authentication Failed</h1>
              <p>No authorization code received from Google.</p>
              <p>Please try the OAuth flow again.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Display the authorization code for user to copy
    return c.html(`
        <html>
          <head>
            <title>OAuth Success - Copy Authorization Code</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
              }
              .container { 
                padding: 40px; 
                border-radius: 12px; 
                background-color: white;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 700px;
                width: 100%;
              }
              h1 { 
                color: #28a745; 
                margin-bottom: 10px;
                font-size: 28px;
              }
              .success-icon {
                font-size: 64px;
                text-align: center;
                margin-bottom: 20px;
              }
              .instructions {
                background-color: #e7f3ff;
                border-left: 4px solid #2196F3;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .instructions ol {
                margin: 10px 0;
                padding-left: 20px;
              }
              .instructions li {
                margin: 8px 0;
                line-height: 1.6;
              }
              code { 
                background-color: #f5f5f5; 
                padding: 15px; 
                border-radius: 6px; 
                display: block; 
                margin: 20px 0; 
                word-break: break-all;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                border: 2px solid #ddd;
                color: #333;
                line-height: 1.5;
              }
              button { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 15px 30px; 
                border: none; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 16px;
                font-weight: 600;
                width: 100%;
                transition: transform 0.2s;
              }
              button:hover { 
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
              }
              button:active {
                transform: translateY(0);
              }
              .copied {
                background: #28a745 !important;
                animation: pulse 0.5s;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              .warning {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                color: #856404;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Google Authentication Successful!</h1>
              
              <div class="instructions">
                <strong>📋 Next Steps:</strong>
                <ol>
                  <li>Click the button below to <strong>copy the authorization code</strong></li>
                  <li>Go back to the <strong>Mastra Playground</strong> (OAuth Setup Workflow)</li>
                  <li><strong>Paste the code</strong> when prompted to resume the workflow</li>
                  <li>The workflow will automatically exchange it for access tokens</li>
                </ol>
              </div>

              <p><strong>Your Authorization Code:</strong></p>
              <code id="authCode">${code}</code>
              
              <button id="copyBtn" onclick="copyCode()">📋 Copy Authorization Code</button>

              <div class="warning">
                <strong>⚠️ Important:</strong> This code expires in 10 minutes. If the workflow fails, you'll need to restart the OAuth process.
              </div>

              <div class="footer">
                🔒 This code is safe to copy. It will be exchanged for secure tokens by the workflow.
              </div>
            </div>
            <script>
              function copyCode() {
                const code = document.getElementById('authCode').innerText;
                const btn = document.getElementById('copyBtn');
                
                navigator.clipboard.writeText(code).then(() => {
                  btn.innerText = '✅ Copied! Paste it in the workflow';
                  btn.classList.add('copied');
                  
                  setTimeout(() => {
                    btn.innerText = '📋 Copy Again';
                    btn.classList.remove('copied');
                  }, 3000);
                }).catch(err => {
                  console.error('Failed to copy: ', err);
                  alert('Failed to copy. Please manually select and copy the code above.');
                });
              }
            </script>
          </body>
        </html>
      `);
  },
});

