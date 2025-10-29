import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Resend } from 'resend';

/**
 * Email Sender Tool (Resend)
 * 
 * Sends emails using the Resend API.
 * Simple, reliable email delivery for the MVP.
 */

export const emailSenderTool = createTool({
  id: 'email-sender',
  description: 'Sends an email using Resend API. Supports plain text and HTML content. Rate limit: 100/day (free tier).',
  
  inputSchema: z.object({
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content (plain text or HTML)'),
    from: z.string().optional().describe('Sender email (defaults to configured from address)'),
    html: z.boolean().optional().describe('Whether body is HTML (default: false for plain text)'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional().describe('Resend message ID if successful'),
    error: z.string().optional(),
  }),
  
  execute: async ({ context }) => {
    try {
      const { to, subject, body, from, html } = context;
      
      // Check if API key is configured
      if (!process.env.RESEND_API_KEY) {
        return {
          success: false,
          error: 'RESEND_API_KEY not configured in environment variables',
        };
      }
      
      // Initialize Resend client
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      // Prepare email payload
      const emailPayload: any = {
        from: from || 'SDR Agent <onboarding@resend.dev>', // Default Resend testing address
        to: [to],
        subject,
      };
      
      // Add body as HTML or text
      if (html) {
        emailPayload.html = body;
      } else {
        emailPayload.text = body;
      }
      
      // Send the email
      const { data, error } = await resend.emails.send(emailPayload);
      
      if (error) {
        console.error('Resend API Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }
      
      return {
        success: true,
        messageId: data?.id,
      };
      
    } catch (error: any) {
      console.error('Email Sender Error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  },
});


