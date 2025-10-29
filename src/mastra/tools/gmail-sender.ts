import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';

/**
 * Gmail Sender Tool
 * 
 * Sends emails using Gmail API with OAuth 2.0 authentication.
 * Rate limit: 500 emails/day for free Gmail accounts.
 */

export const gmailSenderTool = createTool({
  id: 'gmail-sender',
  description: 'Sends an email using Gmail API. Requires OAuth access token. Supports plain text and HTML content. Rate limit: 500/day.',
  
  inputSchema: z.object({
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content (plain text or HTML)'),
    accessToken: z.string().describe('OAuth access token from Google authentication'),
    html: z.boolean().optional().describe('Whether body is HTML (default: false for plain text)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional().describe('Gmail message ID if successful'),
    error: z.string().optional(),
  }),
  
  execute: async ({ context }) => {
    try {
      const { to, subject, body, accessToken, html } = context;
      
      // Setup OAuth2 client with access token
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
      });
      
      // Initialize Gmail API
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Create email message in RFC 2822 format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/' + (html ? 'html' : 'plain') + '; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      
      const message = messageParts.join('\n');
      
      // Encode the message in base64url format
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      // Send the email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      
      return {
        success: true,
        messageId: response.data.id || undefined,
      };
      
    } catch (error: any) {
      console.error('Gmail Sender Error:', error);
      
      // Check for specific OAuth errors
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Access token expired or invalid. Please authenticate again.',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to send email via Gmail',
      };
    }
  },
});

