import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';

/**
 * Google Sheets Reader Tool
 * 
 * Reads data from a Google Sheet using OAuth 2.0 authentication.
 * Users must authenticate via OAuth before using this tool.
 */

export const googleSheetsReaderTool = createTool({
  id: 'google-sheets-reader',
  description: 'Reads data from a Google Sheet. Requires spreadsheet ID or URL and optional range. Returns structured data with rows and columns.',
  
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The Google Sheets ID (from URL) or full URL'),
    range: z.string().optional().describe('Sheet range in A1 notation (e.g., "Sheet1!A1:D10"). Defaults to entire first sheet'),
    accessToken: z.string().describe('OAuth access token from Google authentication'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    data: z.array(z.array(z.any())).optional().describe('2D array of cell values'),
    headers: z.array(z.string()).optional().describe('First row as headers if available'),
    rowCount: z.number().optional(),
    columnCount: z.number().optional(),
    error: z.string().optional(),
  }),
  
  execute: async ({ context }) => {
    try {
      const { spreadsheetId: input, range, accessToken } = context;
      
      // Extract spreadsheet ID from URL if full URL provided
      let spreadsheetId = input;
      const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        spreadsheetId = urlMatch[1];
      }
      
      // Setup OAuth2 client with access token
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
      });
      
      // Initialize Google Sheets API
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      
      // Determine range to read
      const readRange = range || 'A1:ZZ1000'; // Default: first 1000 rows, up to column ZZ
      
      // Read the data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: readRange,
      });
      
      const data = response.data.values || [];
      
      if (data.length === 0) {
        return {
          success: true,
          data: [],
          headers: [],
          rowCount: 0,
          columnCount: 0,
        };
      }
      
      // First row as headers
      const headers = data[0]?.map(cell => String(cell)) || [];
      const rowCount = data.length;
      const columnCount = Math.max(...data.map(row => row.length));
      
      return {
        success: true,
        data,
        headers,
        rowCount,
        columnCount,
      };
      
    } catch (error: any) {
      console.error('Google Sheets Reader Error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to read Google Sheet',
      };
    }
  },
});

