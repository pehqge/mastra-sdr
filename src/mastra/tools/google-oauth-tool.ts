import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';

/**
 * Google OAuth Tool
 * 
 * Generates an OAuth authorization link for the user to authenticate with Google.
 * After authentication, tokens are automatically stored and used by other tools.
 */

export const googleOAuthTool = createTool({
  id: 'google-oauth',
  description: 'Generates a Google OAuth link for user to authenticate. Use this when user needs to connect their Google account for the first time.',
  
  inputSchema: z.object({
    redirectUri: z.string().optional().describe('OAuth redirect URI (defaults to env variable)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    authUrl: z.string().optional().describe('URL for user to visit for authentication'),
    message: z.string(),
  }),
  
  execute: async ({ context }) => {
    try {
      const { redirectUri } = context;
      
      // Check if credentials are configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return {
          success: false,
          message: 'Google OAuth credentials not configured in environment variables',
        };
      }
      
      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4111/auth/google/callback'
      );
      
      // Generate auth URL with required scopes
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        scope: [
          'https://www.googleapis.com/auth/spreadsheets', // Read/Write Google Sheets
          'https://www.googleapis.com/auth/gmail.send',  // Send emails via Gmail
        ],
        prompt: 'consent', // Force consent screen to get refresh token
      });
      
      return {
        success: true,
        authUrl,
        message: 'Please visit the provided URL to authenticate with Google. After authentication, you can use Google Sheets and Gmail features.',
      };
      
    } catch (error: any) {
      console.error('Google OAuth Tool Error:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to generate OAuth link',
      };
    }
  },
});

