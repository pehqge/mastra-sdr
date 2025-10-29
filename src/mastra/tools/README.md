# 🛠️ Tools - Mastra SDR Agent

This directory contains custom tools that extend the SDR Agent's capabilities for interacting with Google APIs and external services.

---

## 📚 Table of Contents

1. [Google OAuth Tool](#google-oauth-tool)
2. [Google Sheets Reader](#google-sheets-reader)
3. [Google Sheets Writer](#google-sheets-writer)
4. [Gmail Sender](#gmail-sender)

---

## 🔐 Google OAuth Tool

**File:** `google-oauth-tool.ts`

### Purpose
Generates Google OAuth 2.0 authorization URLs for authenticating users with Google services (Sheets + Gmail).

### How It Works

1. **Receives optional redirect URI**
2. **Validates environment variables** (CLIENT_ID, CLIENT_SECRET)
3. **Generates OAuth URL** with required scopes:
   - `https://www.googleapis.com/auth/spreadsheets` (read/write Google Sheets)
   - `https://www.googleapis.com/auth/gmail.send` (send emails via Gmail)
4. **Returns authorization URL** for user to visit

### Input Schema

```typescript
{
  redirectUri?: string  // Optional custom redirect URI
                        // Default: process.env.GOOGLE_REDIRECT_URI
}
```

### Output Schema

```typescript
{
  success: boolean
  authUrl?: string      // URL for user to visit and authorize
  message: string       // Instructions or error message
  error?: string        // Error details if failed
}
```

### Example Usage

```typescript
const result = await googleOAuthTool.execute({
  context: {
    redirectUri: "http://localhost:4111/auth/google/callback"
  }
});

console.log(result.authUrl);
// https://accounts.google.com/o/oauth2/v2/auth?...
```

### Configuration Required

**Environment Variables:**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:4111/auth/google/callback
```

### Error Handling

- **Missing credentials**: Returns error if CLIENT_ID or CLIENT_SECRET not configured
- **Invalid redirect URI**: Uses default if provided URI is invalid

---

## 📊 Google Sheets Reader

**File:** `google-sheets-reader.ts`

### Purpose
Reads data from Google Sheets with multiple modes for flexible data access.

### How It Works

1. **Receives spreadsheet ID/URL and access token**
2. **Authenticates with OAuth2** using provided token
3. **Reads data** based on selected mode
4. **Parses and returns** structured data

### Reading Modes

#### 1. **Full Mode** (default)
Reads entire sheet at once.

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  mode: "full",
  parseAsObjects: true  // Returns array of objects
}
```

#### 2. **Range Mode**
Reads specific cell range.

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  mode: "range",
  range: "Sheet1!A1:D10"
}
```

#### 3. **Row Mode**
Reads a single row (perfect for iteration).

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  mode: "row",
  rowNumber: 5,
  parseAsObjects: true
}
```

#### 4. **Metadata Mode**
Gets sheet properties and structure.

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  mode: "metadata"
}
```

### Input Schema

```typescript
{
  spreadsheetId: string       // Google Sheets ID or full URL
  accessToken: string         // OAuth access token
  mode?: "full" | "range" | "row" | "metadata"  // Default: "full"
  range?: string             // For "range" mode (e.g., "A1:D10")
  sheetName?: string         // Specific sheet name
  rowNumber?: number         // For "row" mode (1-indexed)
  parseAsObjects?: boolean   // Return objects instead of arrays
  skipEmptyRows?: boolean    // Ignore blank rows
  includeHeaders?: boolean   // Include first row as headers
}
```

### Output Schema

```typescript
{
  success: boolean
  
  // Data outputs
  data?: string[][]               // 2D array (when parseAsObjects=false)
  dataObjects?: Record<string, any>[]  // Array of objects (when parseAsObjects=true)
  headers?: string[]              // First row as headers
  
  // Metadata
  rowCount?: number
  columnCount?: number
  spreadsheetTitle?: string       // When mode=metadata
  sheets?: Array<{                // When mode=metadata
    name: string
    index: number
    rowCount: number
    columnCount: number
  }>
  
  // Single row output (when mode=row)
  row?: Record<string, any>
  rowIndex?: number
  
  error?: string
}
```

### Example Usage

**Read entire sheet as objects:**
```typescript
const result = await googleSheetsReaderTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    mode: "full",
    parseAsObjects: true
  }
});

// result.dataObjects = [
//   { Company: "Acme", Email: "contact@acme.com" },
//   { Company: "TechCorp", Email: "info@tech.com" }
// ]
```

**Read single row:**
```typescript
const result = await googleSheetsReaderTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    mode: "row",
    rowNumber: 2,
    parseAsObjects: true
  }
});

// result.row = { Company: "Acme", Email: "contact@acme.com" }
```

**Get metadata:**
```typescript
const result = await googleSheetsReaderTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    mode: "metadata"
  }
});

// result.sheets = [
//   { name: "Sheet1", index: 0, rowCount: 100, columnCount: 10 }
// ]
```

### Features

- ✅ Auto-detects headers (row 1)
- ✅ Converts arrays to objects with header keys
- ✅ Skips empty rows automatically
- ✅ Handles both spreadsheet ID and full URL
- ✅ Supports multiple sheets in one spreadsheet

### Error Handling

- **Invalid token**: Returns auth error
- **Sheet not found**: Returns not found error
- **No data**: Returns empty arrays
- **Permission denied**: Returns permission error

---

## ✍️ Google Sheets Writer

**File:** `google-sheets-writer.ts`

### Purpose
Writes or appends data to Google Sheets with support for batch operations.

### How It Works

1. **Receives spreadsheet ID, range, and data**
2. **Authenticates with OAuth2**
3. **Writes data** using selected mode (update or append)
4. **Returns update statistics**

### Writing Modes

#### 1. **Update Mode** (default)
Overwrites existing data in specified range.

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  range: "Sheet1!A1:C1",
  values: [["Company", "Email", "Score"]],
  mode: "update"
}
```

#### 2. **Append Mode**
Adds new rows after existing data.

```typescript
{
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  range: "Sheet1!A:C",
  values: [
    ["Acme Corp", "contact@acme.com", "95"],
    ["TechCorp", "info@tech.com", "87"]
  ],
  mode: "append"
}
```

### Input Schema

```typescript
{
  spreadsheetId: string         // Google Sheets ID or full URL
  accessToken: string           // OAuth access token
  range: string                 // A1 notation (e.g., "Sheet1!A1:D10")
  values: any[][]              // 2D array of values to write
  mode?: "update" | "append"   // Default: "update"
}
```

### Output Schema

```typescript
{
  success: boolean
  updatedRange?: string         // A1 notation of updated range
  updatedRows?: number          // Number of rows affected
  updatedColumns?: number       // Number of columns affected
  updatedCells?: number         // Number of cells affected
  error?: string
}
```

### Example Usage

**Add column headers:**
```typescript
await googleSheetsWriterTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    range: "Sheet1!D1:F1",
    values: [["SDR Summary", "Score", "Message"]],
    mode: "update"
  }
});
```

**Update single row:**
```typescript
await googleSheetsWriterTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    range: "Sheet1!D2:F2",
    values: [["Great fit!", "95", "Hi John, noticed your company..."]],
    mode: "update"
  }
});
```

**Append multiple rows:**
```typescript
await googleSheetsWriterTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    range: "Sheet1!A:C",
    values: [
      ["New Lead 1", "email1@example.com", "80"],
      ["New Lead 2", "email2@example.com", "75"]
    ],
    mode: "append"
  }
});
```

### Features

- ✅ Supports both update and append operations
- ✅ Handles batch writes efficiently
- ✅ Auto-interprets data types (USER_ENTERED mode)
- ✅ Returns detailed update statistics
- ✅ Converts spreadsheet URL to ID automatically

### Error Handling

- **Invalid token**: Returns auth error
- **Invalid range**: Returns range error
- **Permission denied**: Returns permission error
- **Quota exceeded**: Returns quota error

---

## 📧 Gmail Sender

**File:** `gmail-sender.ts`

### Purpose
Sends emails via Gmail API with OAuth 2.0 authentication.

### How It Works

1. **Receives email details** (to, from, subject, body)
2. **Authenticates with OAuth2**
3. **Formats email** in RFC 2822 standard
4. **Encodes to base64url**
5. **Sends via Gmail API**
6. **Returns message ID**

### Input Schema

```typescript
{
  to: string              // Recipient email (must be valid email)
  from: string            // Sender email (must be authenticated user)
  subject: string         // Email subject line
  body: string            // Email content (plain text or HTML)
  html?: boolean          // True if body is HTML (default: false)
  accessToken: string     // OAuth access token
}
```

### Output Schema

```typescript
{
  success: boolean
  messageId?: string      // Gmail message ID if sent successfully
  error?: string          // Error message if failed
}
```

### Example Usage

**Send plain text email:**
```typescript
const result = await gmailSenderTool.execute({
  context: {
    to: "prospect@company.com",
    from: "john@acme.com",
    subject: "Quick question about your project management",
    body: "Hi Sarah,\n\nI noticed your company recently...",
    html: false,
    accessToken: "ya29..."
  }
});

console.log(result.messageId);  // "18c1f2d3e4a5b6c7"
```

**Send HTML email:**
```typescript
const result = await gmailSenderTool.execute({
  context: {
    to: "prospect@company.com",
    from: "john@acme.com",
    subject: "Personalized demo for TechCorp",
    body: "<h1>Hi Sarah</h1><p>I noticed your company...</p>",
    html: true,
    accessToken: "ya29..."
  }
});
```

### Features

- ✅ Supports plain text and HTML emails
- ✅ RFC 2822 compliant formatting
- ✅ Base64url encoding
- ✅ Returns Gmail message ID for tracking
- ✅ 500 emails/day limit (Gmail API)

### Error Handling

**Common Errors:**

1. **Invalid Credentials (401)**
   ```
   Gmail authentication failed. Your access token might be expired 
   or invalid. Please re-authenticate.
   ```

2. **Daily Limit Exceeded (403)**
   ```
   Gmail daily sending limit (500 emails) exceeded. 
   Please try again tomorrow.
   ```

3. **Invalid Email**
   ```
   Invalid email address format.
   ```

### Gmail Limits

| Limit Type | Free Gmail | Google Workspace |
|------------|------------|------------------|
| Emails/day | 500 | 2,000 |
| Recipients/email | 500 | 2,000 |
| Email size | 25 MB | 25 MB |

---

## 🔗 Tool Dependencies

All tools depend on:

- **googleapis** package for Google API interactions
- **OAuth 2.0 credentials** from Google Cloud Console
- **Environment variables** for configuration

---

## 🔧 Setup Required

### 1. Google Cloud Console Setup

1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable APIs:
   - Google Sheets API
   - Gmail API
3. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:4111/auth/google/callback`
4. Download credentials (CLIENT_ID + CLIENT_SECRET)

### 2. Environment Variables

Create `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:4111/auth/google/callback
```

### 3. OAuth Flow

Before using any tool:

1. Run **OAuth Setup Workflow** (see `workflows/README.md`)
2. User authorizes in browser
3. Tokens are obtained and stored
4. Tools use tokens for API calls

---

## 📊 Tools Usage in Workflows

### OAuth Setup Workflow
- ✅ **google-oauth-tool**: Generate auth URL

### Lead Research Workflow
- ✅ **google-sheets-reader**: Read lead data
- ✅ **google-sheets-writer**: Add analysis columns

### Email Dispatch Workflow
- ✅ **google-sheets-reader**: Load leads with filters
- ✅ **gmail-sender**: Send emails in bulk
- ✅ **google-sheets-writer**: Update send status

---

## 🧪 Testing Tools Individually

You can test tools outside of workflows:

```typescript
import { googleSheetsReaderTool } from './google-sheets-reader';

const result = await googleSheetsReaderTool.execute({
  context: {
    spreadsheetId: "1ABC...",
    accessToken: "ya29...",
    mode: "full",
    parseAsObjects: true
  }
});

console.log(result.dataObjects);
```

---

## 🔐 Security Best Practices

1. **Never log tokens**: Tokens are sensitive credentials
2. **Use environment variables**: Never hardcode credentials
3. **Rotate tokens**: Refresh tokens when expired
4. **Limit scopes**: Only request necessary permissions
5. **Secure storage**: Store tokens encrypted if persisting

---

## 📚 Related Documentation

- [Workflows README](../workflows/README.md)
- [Google OAuth Setup Guide](../../../OAUTH_SETUP_GUIDE.md)
- [SDR Agent System Prompt](../agents/prompts/sdr-system-prompt.ts)

---

**Maintained by:** Mastra SDR Team
**Last Updated:** 2025-10-29

