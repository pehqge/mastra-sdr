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
 */
export const googleOAuthCallbackRoute = registerApiRoute('/auth/google/callback', {
  method: 'GET',
  handler: async (c) => {
    try {
      const code = c.req.query('code');
      const state = c.req.query('state'); // Can be used to pass threadId
      
      if (!code) {
        return c.html(`
          <html>
            <body>
              <h1>Error</h1>
              <p>No authorization code received</p>
            </body>
          </html>
        `);
      }
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback'
      );
      
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // Store tokens in a way that can be retrieved by threadId
      // For MVP, we'll display them to the user to paste into the agent
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const expiryDate = tokens.expiry_date;
      
      // Return success page with instructions
      return c.html(`
        <html>
          <head>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
              }
              .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              h1 {
                color: #4CAF50;
                margin-bottom: 10px;
              }
              .token-box {
                background: #f9f9f9;
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
              }
              .success-icon {
                font-size: 48px;
                text-align: center;
                margin-bottom: 20px;
              }
              .instruction {
                background: #e3f2fd;
                padding: 15px;
                border-left: 4px solid #2196F3;
                margin: 20px 0;
              }
              button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
              }
              button:hover {
                background: #45a049;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Authentication Successful!</h1>
              <p>Your Google account has been successfully connected.</p>
              
              <div class="instruction">
                <strong>Next Step:</strong> Copy the access token below and send it to the agent in your conversation:
                <br><br>
                <em>"My access token is: [paste token here]"</em>
              </div>
              
              <div>
                <strong>Access Token:</strong>
                <div class="token-box" id="accessToken">${accessToken}</div>
                <button onclick="copyToken()">Copy to Clipboard</button>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                ℹ️ This token will be stored securely in your conversation context and used automatically for Google Sheets and Gmail operations.
              </p>
              
              ${refreshToken ? `
                <p style="color: #888; font-size: 12px; margin-top: 20px;">
                  ⚙️ Advanced: Refresh token available for long-term access (expires: ${new Date(expiryDate || 0).toLocaleString()})
                </p>
              ` : ''}
            </div>
            
            <script>
              function copyToken() {
                const tokenText = document.getElementById('accessToken').innerText;
                navigator.clipboard.writeText(tokenText).then(() => {
                  alert('Token copied to clipboard!');
                });
              }
            </script>
          </body>
        </html>
      `);
      
    } catch (error: any) {
      console.error('OAuth Callback Error:', error);
      
      return c.html(`
        <html>
          <body>
            <h1>Authentication Error</h1>
            <p>${error.message}</p>
            <a href="/">Go back to home</a>
          </body>
        </html>
      `);
    }
  },
});

