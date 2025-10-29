import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';

/**
 * Google Sheets Reader Tool (Enhanced)
 * 
 * Advanced tool for reading Google Sheets data with multiple modes:
 * - Read entire sheet or specific ranges
 * - Read single rows for iteration
 * - Get sheet metadata (names, dimensions)
 * - Structured output with headers and data
 */

export const googleSheetsReaderTool = createTool({
  id: 'google-sheets-reader',
  description: 'Reads data from Google Sheets with flexible options: read entire sheet, specific range, single row, or get sheet metadata. Returns structured data with headers and row information.',
  
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The Google Sheets ID (from URL) or full URL'),
    accessToken: z.string().describe('OAuth access token from Google authentication'),
    
    // Reading modes
    mode: z.enum(['full', 'range', 'row', 'metadata']).optional().describe('Read mode: "full" (entire sheet), "range" (specific A1 range), "row" (single row), "metadata" (sheet info). Default: "full"'),
    
    // Range options
    range: z.string().optional().describe('Sheet range in A1 notation (e.g., "Sheet1!A1:D10", "A1:C100"). For "range" or "full" mode. Defaults to entire first sheet.'),
    sheetName: z.string().optional().describe('Specific sheet name to read from (e.g., "Sheet1", "Leads"). If not provided, reads the first sheet.'),
    
    // Row iteration options
    rowNumber: z.number().optional().describe('Specific row number to read (for "row" mode). 1-indexed (row 1 is typically headers).'),
    
    // Output formatting
    includeHeaders: z.boolean().optional().describe('Whether to include headers in the output. Default: true'),
    skipEmptyRows: z.boolean().optional().describe('Whether to skip completely empty rows. Default: false'),
    parseAsObjects: z.boolean().optional().describe('Return data as array of objects (with headers as keys) instead of 2D array. Default: false'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    
    // Data outputs
    data: z.array(z.array(z.any())).optional().describe('2D array of cell values (when parseAsObjects=false)'),
    dataObjects: z.array(z.record(z.string(), z.any())).optional().describe('Array of objects with headers as keys (when parseAsObjects=true)'),
    headers: z.array(z.string()).optional().describe('First row as headers'),
    
    // Metadata
    rowCount: z.number().optional().describe('Total number of rows'),
    columnCount: z.number().optional().describe('Total number of columns'),
    sheetName: z.string().optional().describe('Name of the sheet that was read'),
    spreadsheetTitle: z.string().optional().describe('Title of the spreadsheet'),
    
    // Sheet metadata (when mode=metadata)
    sheets: z.array(z.object({
      name: z.string(),
      index: z.number(),
      rowCount: z.number(),
      columnCount: z.number(),
    })).optional().describe('List of all sheets in the spreadsheet with their properties'),
    
    // Single row output (when mode=row)
    row: z.record(z.string(), z.any()).optional().describe('Single row as object (header: value pairs)'),
    rowIndex: z.number().optional().describe('The row number that was read'),
    
    error: z.string().optional(),
  }),
  
  execute: async ({ context }) => {
    try {
      const { 
        spreadsheetId: input, 
        accessToken,
        mode = 'full',
        range,
        sheetName,
        rowNumber,
        includeHeaders = true,
        skipEmptyRows = false,
        parseAsObjects = false,
      } = context;
      
      // Extract spreadsheet ID from URL if full URL provided
      let spreadsheetId = input;
      const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        spreadsheetId = urlMatch[1];
      }
      
      // Setup OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );
      
      oauth2Client.setCredentials({
        access_token: accessToken,
      });
      
      const sheets = google.sheets({ 
        version: 'v4', 
        auth: oauth2Client,
      } as any);
      
      // MODE: METADATA - Get spreadsheet info
      if (mode === 'metadata') {
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId,
        });
        
        const sheetsInfo = spreadsheet.data.sheets?.map(sheet => ({
          name: sheet.properties?.title || '',
          index: sheet.properties?.index || 0,
          rowCount: sheet.properties?.gridProperties?.rowCount || 0,
          columnCount: sheet.properties?.gridProperties?.columnCount || 0,
        })) || [];
        
        return {
          success: true,
          spreadsheetTitle: spreadsheet.data.properties?.title || undefined,
          sheets: sheetsInfo,
          rowCount: sheetsInfo[0]?.rowCount,
          columnCount: sheetsInfo[0]?.columnCount,
        };
      }
      
      // Determine range to read
      let readRange: string;
      
      if (mode === 'row' && rowNumber) {
        // Read single row
        const sheetPrefix = sheetName ? `${sheetName}!` : '';
        readRange = `${sheetPrefix}${rowNumber}:${rowNumber}`;
      } else if (range) {
        // Use provided range
        readRange = sheetName && !range.includes('!') ? `${sheetName}!${range}` : range;
      } else {
        // Default: entire sheet
        const sheetPrefix = sheetName ? `${sheetName}!` : '';
        readRange = `${sheetPrefix}A:ZZ`;
      }
      
      // Read the data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: readRange,
      });
      
      let data = response.data.values || [];
      
      // Skip empty rows if requested
      if (skipEmptyRows) {
        data = data.filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''));
      }
      
      if (data.length === 0) {
        return {
          success: true,
          data: [],
          headers: [],
          rowCount: 0,
          columnCount: 0,
          sheetName: response.data.range?.split('!')[0],
        };
      }
      
      // Extract headers (first row)
      const headers = includeHeaders && data.length > 0 
        ? data[0].map(cell => String(cell || ''))
        : [];
      
      // Data rows (excluding headers if includeHeaders is true)
      const dataRows = includeHeaders && data.length > 1 ? data.slice(1) : data;
      
      const rowCount = data.length;
      const columnCount = Math.max(...data.map(row => row.length));
      
      // MODE: ROW - Return single row as object
      if (mode === 'row' && rowNumber) {
        if (rowNumber === 1 && includeHeaders) {
          // If reading row 1 and includeHeaders is true, return headers info
          return {
            success: true,
            headers,
            row: Object.fromEntries(headers.map((h, i) => [h, headers[i]])),
            rowIndex: rowNumber,
            sheetName: response.data.range?.split('!')[0],
          };
        }
        
        // For data rows, create object with header keys
        const rowData = data[0] || [];
        const rowObject: Record<string, any> = {};
        
        headers.forEach((header, index) => {
          rowObject[header] = rowData[index] || null;
        });
        
        return {
          success: true,
          headers: includeHeaders ? headers : undefined,
          row: rowObject,
          rowIndex: rowNumber,
          columnCount: rowData.length,
          sheetName: response.data.range?.split('!')[0],
        };
      }
      
      // Parse as objects if requested
      if (parseAsObjects && headers.length > 0) {
        const dataObjects = dataRows.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || null;
          });
          return obj;
        });
        
        return {
          success: true,
          dataObjects,
          headers: includeHeaders ? headers : undefined,
          rowCount,
          columnCount,
          sheetName: response.data.range?.split('!')[0],
        };
      }
      
      // Default: return as 2D array
      return {
        success: true,
        data: includeHeaders ? dataRows : data,
        headers: includeHeaders ? headers : undefined,
        rowCount,
        columnCount,
        sheetName: response.data.range?.split('!')[0],
      };
      
    } catch (error: any) {
      console.error('Google Sheets Reader Error:', error);
      
      // Specific error handling
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Access token expired or invalid. Please authenticate again.',
        };
      }
      
      if (error.code === 403) {
        return {
          success: false,
          error: 'Permission denied. Make sure the authenticated user has access to this spreadsheet.',
        };
      }
      
      if (error.code === 404) {
        return {
          success: false,
          error: 'Spreadsheet not found. Check the spreadsheet ID or URL.',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to read Google Sheet',
      };
    }
  },
});
