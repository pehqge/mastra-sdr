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
 * OAuth callback - receives code and exchanges for tokens
 * Displays the access token for user to copy
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

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback'
      );
      
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // For MVP, we'll display them to the user to paste into the agent
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const expiryDate = tokens.expiry_date;

      return c.html(`
        <html>
          <head>
            <title>OAuth Success</title>
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
              code { 
                background-color: #f5f5f5; 
                padding: 15px; 
                border-radius: 6px; 
                display: block; 
                margin: 20px 0; 
                word-break: break-all;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                border: 2px solid #ddd;
                color: #333;
                line-height: 1.5;
                max-height: 150px;
                overflow-y: auto;
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
                margin-top: 10px;
              }
              button:hover { 
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
              }
              .copied {
                background: #28a745 !important;
                animation: pulse 0.5s;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Authentication Successful!</h1>
              
              <div class="instructions">
                <strong>📋 Instructions:</strong>
                <p>Copy the tokens below (both access and refresh) and paste them back into the SDR Agent chat when prompted.</p>
              </div>

              <p><strong>Your Tokens (Copy Everything):</strong></p>
              <code id="tokens">Access Token: ${accessToken}
Refresh Token: ${refreshToken || 'N/A'}</code>
              <button id="copyBtn" onclick="copyTokens()">📋 Copy Both Tokens</button>

              <div class="footer">
                🔒 Keep these tokens secure. Valid until: ${expiryDate ? new Date(expiryDate).toLocaleString() : 'N/A'}
              </div>
            </div>
            <script>
              function copyTokens() {
                const tokens = document.getElementById('tokens').innerText;
                const btn = document.getElementById('copyBtn');
                
                navigator.clipboard.writeText(tokens).then(() => {
                  btn.innerText = '✅ Copied!';
                  btn.classList.add('copied');
                  
                  setTimeout(() => {
                    btn.innerText = '📋 Copy Both Tokens';
                    btn.classList.remove('copied');
                  }, 3000);
                }).catch(err => {
                  alert('Failed to copy. Please manually select and copy the tokens above.');
                });
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error);
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
              <h1>Authentication Error</h1>
              <p>${error.message}</p>
              <p>Please check your environment variables and Google Cloud Console settings.</p>
            </div>
          </body>
        </html>
      `);
    }
  },
});

