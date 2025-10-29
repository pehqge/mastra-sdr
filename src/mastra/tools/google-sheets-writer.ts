import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';

/**
 * Google Sheets Writer Tool
 * 
 * Updates or adds data to Google Sheets using OAuth 2.0 authentication.
 * Supports:
 * - Updating specific cells or ranges
 * - Appending new columns
 * - Batch updates for efficiency
 */

export const googleSheetsWriterTool = createTool({
  id: 'google-sheets-writer',
  description: 'Updates or adds data to a Google Sheet. Can update specific cells, ranges, or append new columns. Use A1 notation (e.g., "A1", "B2:D5", "Sheet1!A1:C10").',
  
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the Google Sheet, or a full Google Sheet URL.'),
    range: z.string().describe('The A1 notation range to update (e.g., "Sheet1!A1", "B2:D5"). For appending columns, use the column letter (e.g., "E:E" for column E).'),
    values: z.array(z.array(z.any())).describe('2D array of values to write. Each inner array represents a row. Example: [["Header"], ["Value1"], ["Value2"]] for a column.'),
    accessToken: z.string().describe('The OAuth 2.0 access token for Google API authentication.'),
    mode: z.enum(['update', 'append']).optional().describe('Update mode: "update" replaces existing data, "append" adds data after existing content. Default: "update".'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    updatedRange: z.string().optional().describe('The range that was updated, in A1 notation.'),
    updatedRows: z.number().optional().describe('Number of rows that were updated.'),
    updatedColumns: z.number().optional().describe('Number of columns that were updated.'),
    updatedCells: z.number().optional().describe('Total number of cells that were updated.'),
    error: z.string().optional().describe('Error message if the operation failed.'),
  }),
  
  execute: async ({ context }) => {
    try {
      const { spreadsheetId: input, range, values, accessToken, mode = 'update' } = context;
      
      // Extract spreadsheetId from URL if a full URL is provided
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
      
      // Determine the update method based on mode
      if (mode === 'append') {
        // Append data after existing content
        const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED', // Parse values as if user typed them
          requestBody: {
            values,
          },
        });
        
        return {
          success: true,
          updatedRange: response.data.updates?.updatedRange || undefined,
          updatedRows: response.data.updates?.updatedRows || undefined,
          updatedColumns: response.data.updates?.updatedColumns || undefined,
          updatedCells: response.data.updates?.updatedCells || undefined,
        };
      } else {
        // Update existing data (replace)
        const response = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values,
          },
        });
        
        return {
          success: true,
          updatedRange: response.data.updatedRange || undefined,
          updatedRows: response.data.updatedRows || undefined,
          updatedColumns: response.data.updatedColumns || undefined,
          updatedCells: response.data.updatedCells || undefined,
        };
      }
      
    } catch (error: any) {
      console.error('Error writing to Google Sheet:', error.message);
      
      // Check for specific OAuth errors
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Access token expired or invalid. Please authenticate again.',
        };
      }
      
      // Check for permission errors
      if (error.code === 403) {
        return {
          success: false,
          error: 'Permission denied. Make sure the authenticated user has edit access to this spreadsheet.',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to write to Google Sheet',
      };
    }
  },
});

