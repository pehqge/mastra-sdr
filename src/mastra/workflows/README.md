# 🔄 Workflows - Mastra SDR Agent

This directory contains the core workflows that orchestrate the complete lead analysis and email outreach process.

---

## 📚 Table of Contents

1. [OAuth Setup Workflow](#oauth-setup-workflow)
2. [Lead Research Workflow](#lead-research-workflow)
3. [Email Dispatch Workflow](#email-dispatch-workflow)
4. [Workflow Orchestration](#workflow-orchestration)

---

## 🔐 OAuth Setup Workflow

**File:** `oauth-setup-workflow.ts`

### Purpose
One-time setup to authenticate with Google services (Sheets + Gmail) and obtain access tokens.

### Flow Diagram

```
┌─────────────────┐
│ Start Workflow  │
└────────┬────────┘
         │
    ┌────▼────────────────────────────┐
    │ Step 1: Generate OAuth URL      │
    │ - Creates authorization URL     │
    │ - Includes Sheets + Gmail scopes│
    └────┬────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ Step 2: Wait for Authorization (SUSPEND)│
    │ - Shows URL to user                     │
    │ - User authorizes in browser            │
    │ - User provides authorization code      │
    │ - Workflow exchanges code for tokens    │
    └────┬───────────────────────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │ Step 3: Test Sheets Connection   │
    │ - Creates test spreadsheet       │
    │ - Verifies read/write permissions│
    │ - Deletes test spreadsheet       │
    └────┬─────────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │ Step 4: Generate Report       │
    │ - Shows connection status     │
    │ - Returns tokens (obfuscated) │
    │ - Provides next steps         │
    └────┬──────────────────────────┘
         │
    ┌────▼─────────┐
    │ Complete ✅  │
    └──────────────┘
```

### Steps Breakdown

#### **Step 1: Generate OAuth URL**

**Input:**
```typescript
{
  redirectUri?: string  // Optional custom redirect
}
```

**Process:**
- Validates Google Cloud credentials (CLIENT_ID, CLIENT_SECRET)
- Generates OAuth URL with scopes:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/gmail.send`
- Uses `offline` access type for refresh token

**Output:**
```typescript
{
  authUrl: string      // "https://accounts.google.com/o/oauth2/v2/auth?..."
  message: string      // Instructions for user
  scopes: string[]     // List of requested scopes
}
```

---

#### **Step 2: Wait for Authorization & Exchange Code**

**Input:** From Step 1

**Process:**
1. **Suspends workflow** and shows auth URL to user
2. User clicks URL → Google authorization page
3. User authorizes → Google redirects with **authorization code**
4. User pastes code back into workflow
5. **Workflow automatically exchanges code for tokens:**
   - Access token (valid ~1 hour)
   - Refresh token (valid indefinitely)
   - Expiry date

**Suspend Schema:**
```typescript
{
  authUrl: string
  instructions: string  // Step-by-step guide
  scopes: string[]
}
```

**Resume Schema:**
```typescript
{
  authorizationCode: string  // User provides this
}
```

**Output:**
```typescript
{
  accessToken: string
  refreshToken?: string
  scopes: string[]
  message: string
}
```

**Important:** User provides **authorization code** (not tokens). Workflow does the exchange automatically.

---

#### **Step 3: Test Sheets Connection**

**Input:** Tokens from Step 2

**Process:**
1. Creates OAuth2 client with tokens
2. **Creates test spreadsheet** via Sheets API
3. Verifies write permissions
4. **Immediately deletes** test spreadsheet (cleanup)

**Output:**
```typescript
{
  accessToken: string
  refreshToken?: string
  scopes: string[]
  sheetsStatus: {
    connected: boolean
    message: string       // "✅ Google Sheets: Conexão bem-sucedida!"
    testDetails: string   // "Permissões de leitura/escrita confirmadas"
  }
}
```

**Note:** Gmail is NOT tested here. It will be tested during first email send.

---

#### **Step 4: Generate Report**

**Input:** Connection status from Step 3

**Process:**
1. Checks if Sheets connected successfully
2. Generates comprehensive summary
3. **Obfuscates tokens** for security:
   - `accessTokenPreview`: "ya29...xYz1" (first 10 + last 4 chars)
   - `hasRefreshToken`: true/false
4. Provides next steps

**Output:**
```typescript
{
  success: boolean
  summary: string                    // Formatted report
  accessTokenPreview: string         // Obfuscated
  hasRefreshToken: boolean
  connections: {
    sheets: boolean
  }
  nextSteps: string[]
  
  // Internal use (prefixed with _)
  _accessToken?: string              // Full token
  _refreshToken?: string             // Full token
}
```

---

### Input Schema (Workflow)

```typescript
{
  redirectUri?: string  // Optional custom redirect URI
}
```

### Output Schema (Workflow)

```typescript
{
  success: boolean
  summary: string
  accessTokenPreview: string
  hasRefreshToken: boolean
  connections: {
    sheets: boolean
  }
  nextSteps: string[]
  _accessToken?: string      // For programmatic access
  _refreshToken?: string     // For programmatic access
}
```

### Example Usage

```typescript
const result = await mastra.workflows.oauthSetupWorkflow.execute({
  redirectUri: "http://localhost:4111/auth/google/callback"
});

// Workflow suspends, user authorizes
// User provides authorization code
// Workflow resumes automatically

console.log(result.summary);
// "✅ OAuth Setup Completo!
//  • Google Sheets: ✅ Conexão bem-sucedida!"

const accessToken = result._accessToken;  // Use in next workflows
```

### Features

- ✅ One-time setup (tokens last indefinitely with refresh)
- ✅ Automatic code-to-token exchange
- ✅ Tests Sheets connection with real API call
- ✅ Obfuscated tokens for security
- ✅ Clear error messages for common issues

### Common Errors

1. **Missing credentials**: Check `.env` file
2. **Invalid redirect URI**: Must match Google Cloud Console
3. **Code expired**: Generate new auth URL (codes expire in 10 min)
4. **Sheets API not enabled**: Enable in Google Cloud Console

---

## 🔍 Lead Research Workflow

**File:** `lead-research-workflow.ts`

### Purpose
Analyzes leads from Google Sheets at scale: researches each lead, scores them, and generates personalized messages.

### Flow Diagram

```
┌────────────────────────┐
│ Start Workflow         │
│ Input: spreadsheetId   │
│        accessToken     │
│        productDescription│
└───────┬────────────────┘
        │
   ┌────▼──────────────────────────┐
   │ Step 1: Validate Connection   │
   │ - Test Sheets API access      │
   │ - Verify read/write permissions│
   └────┬──────────────────────────┘
        │
   ┌────▼────────────────────────────────┐
   │ Step 2: Explore Structure (SUSPEND) │
   │ - Read headers & sample data        │
   │ - Auto-detect columns               │
   │ - Show to user for confirmation     │
   └────┬────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────┐
   │ Step 3: Create Research Plan (SUSPEND)│
   │ - Generate research strategy         │
   │ - Estimate time (~12s per lead)      │
   │ - Show plan to user for approval     │
   └────┬─────────────────────────────────┘
        │
   ┌────▼──────────────────────────────┐
   │ Step 4: Process Leads IN PARALLEL │
   │ ┌──────────────────────────────┐  │
   │ │ For each lead (10 at a time):│  │
   │ │ 1. Read lead data            │  │
   │ │ 2. Research via Tavily       │  │
   │ │ 3. Analyze fit (0-100 score) │  │
   │ │ 4. Generate message          │  │
   │ │ 5. Write to sheet            │  │
   │ └──────────────────────────────┘  │
   │ - Progress tracking              │
   │ - Error handling with retry      │
   │ - Batch writes (50 rows)         │
   └────┬──────────────────────────────┘
        │
   ┌────▼─────────────────────────┐
   │ Step 5: Generate Summary     │
   │ - Total processed            │
   │ - Possible clients found     │
   │ - Average score              │
   │ - Top 10 leads               │
   │ - Error report               │
   └────┬─────────────────────────┘
        │
   ┌────▼──────────┐
   │ Complete ✅   │
   └───────────────┘
```

### Steps Breakdown

#### **Step 1: Validate Connection**

**Input:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  productDescription?: string
}
```

**Process:**
- Extracts spreadsheet ID from URL (if full URL provided)
- Tests connection with Sheets API
- Validates read/write permissions

**Output:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  productDescription?: string
  isConnected: boolean
  spreadsheetTitle: string
}
```

---

#### **Step 2: Explore Structure**

**Input:** From Step 1

**Process:**
1. Reads sheet metadata (names, dimensions)
2. Reads headers (row 1)
3. Reads 5 sample rows
4. **Auto-detects columns:**
   - Company (searches for "company", "empresa", "organization")
   - Email (searches for "email", "e-mail", "mail")
   - Name (searches for "name", "nome", "contact")
5. **Suspends and shows structure to user**

**Suspend Schema:**
```typescript
{
  message: string              // Formatted structure info
  sheetName: string
  headers: string[]
  sampleRows: Record<string, any>[]
  totalRows: number
  suggestedMapping: {
    companyColumn?: string
    emailColumn?: string
    nameColumn?: string
  }
}
```

**Resume Schema:**
```typescript
{
  confirmed: boolean
  customMapping?: {            // User can override
    companyColumn?: string
    emailColumn?: string
    nameColumn?: string
  }
}
```

**Output:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  productDescription?: string
  sheetName: string
  headers: string[]
  totalRows: number
  columnCount: number
  columnMapping: {
    companyColumn: string      // Required
    emailColumn?: string
    nameColumn?: string
  }
}
```

---

#### **Step 3: Create Research Plan**

**Input:** From Step 2

**Process:**
1. Analyzes available columns
2. Creates research strategy:
   - What to search (company info, news, etc.)
   - How to analyze (based on product description)
   - Estimated time (~12s per lead)
3. **Suspends and shows plan for approval**

**Suspend Schema:**
```typescript
{
  message: string              // Formatted research plan
  plan: {
    dataAvailable: string[]
    dataToSearch: string[]
    searchStrategy: string
    estimatedTimePerLead: number
    totalEstimatedTime: number  // in minutes
    batchSize: number           // 10 leads in parallel
  }
}
```

**Resume Schema:**
```typescript
{
  approved: boolean
  adjustedBatchSize?: number   // User can change parallel count
}
```

**Output:** Same as input + research plan

---

#### **Step 4: Process Leads** 🚀

**THE CORE STEP**

**Input:** From Step 3 + research plan

**Process:**

1. **Add column headers** to sheet:
   - "SDR Summary"
   - "Score (0-100)"
   - "Possible Client?"
   - "Personalized Message"

2. **Process leads in PARALLEL batches of 10:**

   ```
   For each batch of 10 leads:
     ┌─────────────────────────────────────┐
     │ Lead 1  Lead 2  Lead 3  ...  Lead 10│
     │   │       │       │            │    │
     │   ▼       ▼       ▼            ▼    │
     │ Read    Read    Read   ...   Read   │
     │   │       │       │            │    │
     │   ▼       ▼       ▼            ▼    │
     │Research Research Research ... Research│
     │ (Tavily)(Tavily)(Tavily)    (Tavily) │
     │   │       │       │            │    │
     │   ▼       ▼       ▼            ▼    │
     │Analyze  Analyze Analyze ...  Analyze │
     │ (SDR)   (SDR)   (SDR)        (SDR)   │
     │   │       │       │            │    │
     │   ▼       ▼       ▼            ▼    │
     │ Write   Write   Write  ...   Write  │
     │ (batch buffer for 50 rows)          │
     └─────────────────────────────────────┘
   
   Progress: "Batch 1/24 (4% complete)"
   ```

3. **For EACH lead:**

   **a) Read lead data:**
   ```typescript
   googleSheetsReaderTool.execute({
     mode: "row",
     rowNumber: X,
     parseAsObjects: true
   })
   ```

   **b) Research via Tavily:**
   ```typescript
   tavilySearch.execute({
     query: `${companyName} company ${productKeywords} recent news funding growth fit business model`
     max_results: 3
   })
   ```

   **c) Analyze with SDR Agent:**
   ```typescript
   sdrAgent.generate(`
     Analyze this lead:
     ${leadData}
     
     Research:
     ${researchResults}
     
     Our Product:
     ${productDescription}
     
     Provide:
     1. SDR Summary (3-4 sentences)
     2. SCORE (0-100) based on:
        - Market fit (0-30)
        - Company maturity (0-20)
        - Buying signals (0-30)
        - Strategic alignment (0-20)
     3. Possible client (YES if >= 60, NO otherwise)
     4. Personalized email (4-5 sentences)
        - Specific observation
        - Pain point connection
        - Value-focused
        - Low-friction CTA
   `)
   ```

   **d) Parse response:**
   ```typescript
   SUMMARY: [text]
   SCORE: [0-100]
   POSSIBLE CLIENT: [YES/NO]
   MESSAGE: [text]
   ```

   **e) Buffer write data** (batch of 50)

4. **Batch writes every 50 rows** (parallel for 10x performance)

5. **Error handling:**
   - Retry up to 3 times with exponential backoff
   - Continue on failure (mark as error)
   - Log all errors for final report

6. **Progress tracking:**
   ```
   📊 Processing batch 1/24 (4% complete)
      Rows 2-11 of 234
   
   ✅ Batch complete: 10/234 processed
   📈 Stats: 9 success, 1 failed, 6 possible clients
   ```

**Output:**
```typescript
{
  spreadsheetId: string
  totalProcessed: number
  successful: number
  failed: number
  possibleClients: number
  averageScore: number
  results: Array<{
    rowNumber: number
    companyName: string
    score: number
    isPossibleClient: string
    success: boolean
    error?: string
  }>
}
```

---

#### **Step 5: Generate Summary**

**Input:** Results from Step 4

**Process:**
1. Calculates statistics
2. Finds top 10 leads by score
3. Creates error report
4. Generates comprehensive summary

**Output:**
```typescript
{
  summary: string              // Formatted results
  totalProcessed: number
  successful: number
  failed: number
  possibleClients: number
  averageScore: number
  conversionRate: number       // % of possible clients
  topLeads: Array<{
    companyName: string
    score: number
    rowNumber: number
  }>
  spreadsheetUrl: string
  errorReport: Array<{
    rowNumber: number
    companyName: string
    error: string
  }>
}
```

---

### Input Schema (Workflow)

```typescript
{
  spreadsheetId: string         // Google Sheet ID or URL
  accessToken: string           // From OAuth Setup
  productDescription?: string   // Optional product context
}
```

### Output Schema (Workflow)

```typescript
{
  summary: string
  totalProcessed: number
  successful: number
  failed: number
  possibleClients: number
  averageScore: number
  conversionRate: number
  topLeads: Array<{
    companyName: string
    score: number
    rowNumber: number
  }>
  spreadsheetUrl: string
  errorReport: Array<{...}>
}
```

### Example Usage

```typescript
const result = await mastra.workflows.leadResearchWorkflow.execute({
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  productDescription: "AI-powered project management tool"
});

// Workflow suspends twice:
// 1. Shows sheet structure → user confirms
// 2. Shows research plan → user approves

// Then processes all leads...

console.log(result.summary);
// "✅ Lead Research Complete!
//  • Total: 234 leads
//  • Possible Clients: 156 (68%)
//  • Average Score: 73/100"
```

### Performance

- **Parallelization**: 10 leads at once
- **Time**: ~12s per lead
- **Batch writes**: 50 rows at once
- **Example**: 234 leads = ~47 minutes

### Features

- ✅ Parallel processing (10x faster)
- ✅ Progress tracking in real-time
- ✅ Suspend/resume for user approval
- ✅ Auto-column detection
- ✅ Web research via Tavily
- ✅ AI-powered scoring (0-100)
- ✅ Personalized messages
- ✅ Batch writes for efficiency
- ✅ Retry logic with backoff
- ✅ Comprehensive error handling

---

## 📧 Email Dispatch Workflow

**File:** `email-dispatch-workflow.ts`

### Purpose
Filters leads based on criteria and sends personalized emails in bulk via Gmail.

### Flow Diagram

```
┌──────────────────────────┐
│ Start Workflow           │
│ Input: spreadsheetId     │
│        accessToken       │
│        filterCriteria    │
└──────┬───────────────────┘
       │
  ┌────▼──────────────────────┐
  │ Step 1: Load Leads         │
  │ - Read sheet with analysis │
  │ - Detect columns           │
  │ - Parse lead data          │
  └────┬───────────────────────┘
       │
  ┌────▼──────────────────────────┐
  │ Step 2: Apply Filters          │
  │ - possibleClients (YES only)   │
  │ - highScore (>= 70)            │
  │ - largeCompanies               │
  │ - techSector                   │
  │ - custom (user-defined)        │
  │ - all (no filter)              │
  └────┬───────────────────────────┘
       │
  ┌────▼────────────────────────────┐
  │ Step 3: Preview (SUSPEND)       │
  │ - Show filtered count           │
  │ - Show breakdown by score       │
  │ - Estimate send time            │
  │ - Ask for confirmation          │
  └────┬────────────────────────────┘
       │
  ┌────▼──────────────────────────┐
  │ Step 4: Send Emails PARALLEL  │
  │ ┌──────────────────────────┐  │
  │ │ Batch 1: 8 emails        │  │
  │ │ Batch 2: 8 emails        │  │
  │ │ ... (8 at a time)        │  │
  │ └──────────────────────────┘  │
  │ - Rate limiting (500/day)     │
  │ - Progress tracking           │
  │ - Error handling              │
  └────┬──────────────────────────┘
       │
  ┌────▼─────────────────────────────┐
  │ Step 5: Update Sheet Status      │
  │ - Mark "Sent" or "Failed"        │
  │ - Add timestamp                  │
  │ - Batch update (50 rows)         │
  └────┬─────────────────────────────┘
       │
  ┌────▼──────────────────────┐
  │ Step 6: Generate Report    │
  │ - Emails sent              │
  │ - Success rate             │
  │ - Failed details           │
  │ - Updated sheet URL        │
  └────┬───────────────────────┘
       │
  ┌────▼──────────┐
  │ Complete ✅   │
  └───────────────┘
```

### Steps Breakdown

#### **Step 1: Load Leads**

**Input:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  filterCriteria: string
}
```

**Process:**
1. Reads entire sheet
2. **Auto-detects columns** (case-insensitive, multiple aliases):
   - Email: "email", "e-mail", "mail", "contact"
   - Company: "company", "empresa", "organization"
   - Score: "score", "pontuacao", "rating"
   - Possible Client: "possible client", "possivel cliente", "is client"
   - Message: "message", "mensagem", "email body", "personalized"
   - Summary: "summary", "resumo", "sdr summary"
   - Industry: "industry", "sector", "setor"
3. Parses all leads into structured format

**Output:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  filterCriteria: string
  allLeads: Array<{
    rowNumber: number
    email: string
    company: string
    score?: number
    isPossibleClient?: string
    message?: string
    summary?: string
    industry?: string
    [key: string]: any       // Other columns
  }>
  columnIndexes: Record<string, number>
}
```

---

#### **Step 2: Apply Filters**

**Input:** From Step 1

**Process:** Filters leads based on criteria

**Available Filters:**

1. **possibleClients**
   ```typescript
   lead.isPossibleClient?.toUpperCase() === 'YES'
   ```

2. **highScore**
   ```typescript
   lead.score >= 70
   ```

3. **largeCompanies**
   ```typescript
   lead.summary?.toLowerCase().includes('large') ||
   lead.summary?.toLowerCase().includes('enterprise')
   ```

4. **techSector**
   ```typescript
   lead.industry?.toLowerCase().includes('tech') ||
   lead.industry?.toLowerCase().includes('software') ||
   lead.industry?.toLowerCase().includes('saas')
   ```

5. **custom**
   ```typescript
   // User provides custom filter expression
   ```

6. **all**
   ```typescript
   // No filter, includes everyone
   ```

**Output:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  filteredLeads: Array<Lead>
  appliedFilter: string
  stats: {
    totalLeads: number
    filteredLeads: number
    score90to100: number
    score80to89: number
    score70to79: number
    scoreBelow70: number
  }
}
```

---

#### **Step 3: Preview Campaign**

**Input:** From Step 2

**Process:**
1. Calculates statistics
2. Estimates send time
3. Checks Gmail limit (500/day)
4. **Suspends for user confirmation**

**Suspend Schema:**
```typescript
{
  message: string              // Formatted preview
  filteredCount: number
  estimatedTime: number        // in minutes
  breakdown: {
    score90to100: number
    score80to89: number
    score70to79: number
  }
}
```

**Resume Schema:**
```typescript
{
  confirmed: boolean
}
```

**Output:** Same as input + user confirmation

---

#### **Step 4: Send Emails** 🚀

**THE CORE STEP**

**Input:** From Step 3

**Process:**

1. **Parallel sending in batches of 8:**

   ```
   Batch 1: [Email 1] [Email 2] ... [Email 8]  → Send parallel
   Wait 1s (rate limiting)
   Batch 2: [Email 9] [Email 10] ... [Email 16] → Send parallel
   Wait 1s
   ...
   ```

2. **For EACH email:**

   ```typescript
   gmailSenderTool.execute({
     to: lead.email,
     from: userEmail,
     subject: `Re: ${lead.company}`,
     body: lead.message,
     html: false,
     accessToken
   })
   ```

3. **Error handling:**
   - Retry once on failure (after 2s delay)
   - Continue on permanent failure
   - Track successes and failures

4. **Rate limiting:**
   - 500 emails/day limit
   - Stop at 490 emails (safety buffer)
   - 1s delay between batches

5. **Progress tracking:**
   ```
   📧 Batch 1/16: Sending 8 emails... ✅ 8 sent
   📧 Batch 2/16: Sending 8 emails... ✅ 7 sent, 1 failed
   ```

**Output:**
```typescript
{
  spreadsheetId: string
  accessToken: string
  sentEmails: Array<{
    rowNumber: number
    company: string
    email: string
    success: boolean
    messageId?: string
    error?: string
  }>
  stats: {
    totalAttempted: number
    successful: number
    failed: number
    skipped: number          // If limit reached
  }
}
```

---

#### **Step 5: Update Sheet Status**

**Input:** From Step 4

**Process:**
1. Creates "Email Status" column (if doesn't exist)
2. Updates each lead with:
   - "Sent ✅" or "Failed ❌"
   - Timestamp
3. **Batch updates** (50 rows at once, parallel)

**Output:**
```typescript
{
  spreadsheetId: string
  updatedRows: number
  statusColumn: string
}
```

---

#### **Step 6: Generate Report**

**Input:** From Step 5

**Process:**
1. Calculates final statistics
2. Computes success rate
3. Creates error report
4. Generates comprehensive summary

**Output:**
```typescript
{
  summary: string
  totalSent: number
  successful: number
  failed: number
  successRate: number
  averageSendTime: number
  spreadsheetUrl: string
  failedEmails: Array<{
    rowNumber: number
    company: string
    email: string
    error: string
  }>
}
```

---

### Input Schema (Workflow)

```typescript
{
  spreadsheetId: string
  accessToken: string
  filterCriteria: "possibleClients" | "highScore" | "largeCompanies" | 
                 "techSector" | "custom" | "all"
}
```

### Output Schema (Workflow)

```typescript
{
  summary: string
  totalSent: number
  successful: number
  failed: number
  successRate: number
  averageSendTime: number
  spreadsheetUrl: string
  failedEmails: Array<{...}>
}
```

### Example Usage

```typescript
const result = await mastra.workflows.emailDispatchWorkflow.execute({
  spreadsheetId: "1ABC...",
  accessToken: "ya29...",
  filterCriteria: "highScore"
});

// Workflow suspends:
// Shows preview → user confirms

// Then sends emails in parallel...

console.log(result.summary);
// "✅ Email Campaign Complete!
//  • Emails Sent: 127
//  • Success Rate: 100%
//  • Average Time: 1.8s per email"
```

### Performance

- **Parallelization**: 8 emails at once
- **Rate limiting**: 1s delay between batches
- **Example**: 127 emails = ~4 minutes
- **Limit**: 500 emails/day

### Features

- ✅ Parallel sending (8x faster)
- ✅ Intelligent filters (6 types)
- ✅ Suspend for confirmation
- ✅ Progress tracking
- ✅ Rate limiting (respects Gmail 500/day)
- ✅ Retry logic
- ✅ Sheet status updates
- ✅ Comprehensive error handling
- ✅ Detailed reporting

---

## 🔗 Workflow Orchestration

### Complete Flow

The SDR Agent orchestrates all 3 workflows in sequence:

```
User: "Hi!"
  ↓
SDR: Discovery questions (8x)
  ↓
User: "Yes, analyze leads"
  ↓
┌─────────────────────────┐
│ 1. OAuth Setup Workflow │  ← One-time
│    - Generate URL       │
│    - Exchange code      │
│    - Test Sheets        │
│    - Return tokens      │
└──────────┬──────────────┘
           │ accessToken
User: [provides sheet URL]
  ↓
┌─────────────────────────────┐
│ 2. Lead Research Workflow   │
│    - Validate connection    │
│    - Explore structure      │  ← SUSPEND
│    - Create plan            │  ← SUSPEND
│    - Process leads (10x)    │
│    - Generate summary       │
└──────────┬──────────────────┘
           │ analyzed leads
User: "Send to high score only"
  ↓
┌──────────────────────────────┐
│ 3. Email Dispatch Workflow   │
│    - Load leads              │
│    - Apply filter            │
│    - Preview                 │  ← SUSPEND
│    - Send emails (8x)        │
│    - Update status           │
│    - Generate report         │
└──────────┬───────────────────┘
           │ campaign results
SDR: "✅ Campaign complete! 127 emails sent"
```

### Workflow Communication

Workflows communicate via:

1. **Direct output → input**
   ```typescript
   const oauth = await oauthSetupWorkflow.execute();
   const research = await leadResearchWorkflow.execute({
     accessToken: oauth._accessToken  // Pass token
   });
   ```

2. **Working Memory** (via SDR Agent)
   ```typescript
   // Agent stores tokens in working memory
   workingMemory.accessToken = oauth._accessToken;
   
   // Agent uses stored token in next workflow
   const research = await leadResearchWorkflow.execute({
     accessToken: workingMemory.accessToken
   });
   ```

3. **Suspend/Resume**
   ```typescript
   // Workflow suspends
   const suspended = await workflow.execute({...});
   
   // User provides input
   // Workflow resumes
   const result = await workflow.resume(suspended.runId, {
     confirmed: true
   });
   ```

---

## 🎯 Best Practices

### 1. Error Handling
- ✅ Always wrap workflow calls in try-catch
- ✅ Retry on transient errors
- ✅ Provide clear error messages to users

### 2. Progress Tracking
- ✅ Show progress during long operations
- ✅ Estimate remaining time
- ✅ Allow user to see what's happening

### 3. Suspend/Resume
- ✅ Always show clear instructions during suspend
- ✅ Validate resume data
- ✅ Provide defaults when possible

### 4. Performance
- ✅ Use parallelization for batch operations
- ✅ Batch API calls (writes, emails)
- ✅ Implement rate limiting

### 5. Security
- ✅ Never log tokens
- ✅ Obfuscate sensitive data in outputs
- ✅ Use environment variables for credentials

---

## 📊 Workflow Comparison

| Feature | OAuth Setup | Lead Research | Email Dispatch |
|---------|-------------|---------------|----------------|
| **Duration** | ~2 min | ~47 min (234 leads) | ~4 min (127 emails) |
| **Suspends** | 1x (auth) | 2x (structure, plan) | 1x (preview) |
| **Parallel** | No | Yes (10x) | Yes (8x) |
| **API Calls** | ~5 | ~700+ | ~130 |
| **User Input** | Auth code | 2x confirmations | 1x confirmation |
| **Output** | Tokens | Analyzed leads | Email results |

---

## 🧪 Testing Workflows

### Individual Testing

```typescript
// Test OAuth Setup
const oauth = await mastra.workflows.oauthSetupWorkflow.execute({});

// Test Lead Research (requires token)
const research = await mastra.workflows.leadResearchWorkflow.execute({
  spreadsheetId: "1ABC...",
  accessToken: oauth._accessToken,
  productDescription: "AI PM tool"
});

// Test Email Dispatch (requires analyzed sheet)
const emails = await mastra.workflows.emailDispatchWorkflow.execute({
  spreadsheetId: "1ABC...",
  accessToken: oauth._accessToken,
  filterCriteria: "highScore"
});
```

### End-to-End Testing

See SDR Agent system prompt for complete conversational flow.

---

## 📚 Related Documentation

- [Tools README](../tools/README.md)
- [SDR Agent System Prompt](../agents/prompts/sdr-system-prompt.ts)
- [OAuth Setup Guide](../../../OAUTH_SETUP_GUIDE.md)

---

**Maintained by:** Mastra SDR Team
**Last Updated:** 2025-10-29

