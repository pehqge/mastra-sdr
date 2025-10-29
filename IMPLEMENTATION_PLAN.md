# SDR Agent - Implementation Plan

## 🎯 Current Status

✅ **Completed:**
- [x] Agent skeleton created (`sdr-agent.ts`)
- [x] Advanced system prompts (Chain-of-Thought, Few-Shot, etc.)
- [x] Thread-scoped working memory template
- [x] Environment variables setup (`.env.example`)
- [x] Clean, production-ready code structure

## 📋 Implementation Roadmap

### Phase 1: Core Tools (Foundational) 🔧

#### Step 1: Tavily Web Search Tool
**Priority:** HIGH | **Estimated Time:** 2-3 hours

**What to build:**
- Tool to perform web searches via Tavily MCP server
- Input: Search query, optional filters
- Output: Search results with company information

**Why first:** Essential for lead research - the core functionality

**Implementation details:**
```
src/mastra/tools/tavily-search-tool.ts
- Connect to Tavily MCP server
- Handle search queries
- Parse and structure results
- Error handling for rate limits
```

**Testing:** Search for a company and verify results in Playground

---

#### Step 2: Google Sheets Tool
**Priority:** HIGH | **Estimated Time:** 3-4 hours

**What to build:**
- Read data from Google Sheets
- Write new columns to existing sheets
- Handle authentication via service account or OAuth

**Why now:** Need to read leads and write results back

**Implementation details:**
```
src/mastra/tools/google-sheets-tool.ts
- Google Sheets API integration
- Read range of cells
- Write to specific columns
- Batch operations for performance
```

**Testing:** Read a test sheet and write a new column

---

#### Step 3: Gmail Tool
**Priority:** MEDIUM | **Estimated Time:** 2-3 hours

**What to build:**
- Send emails via Gmail API
- Support for HTML templates
- Track sent emails count (rate limiting)

**Why now:** Primary email sending method

**Implementation details:**
```
src/mastra/tools/gmail-tool.ts
- Gmail API authentication
- Email composition with templates
- Rate limit tracking (500/day)
- Send email with attachments support
```

**Testing:** Send a test email to yourself

---

#### Step 4: Resend Tool
**Priority:** MEDIUM | **Estimated Time:** 1-2 hours

**What to build:**
- Send emails via Resend API
- Simpler alternative to Gmail
- Track sent emails count

**Why now:** Alternative email service for flexibility

**Implementation details:**
```
src/mastra/tools/resend-tool.ts
- Resend API integration
- Simple email sending
- Rate limit tracking (100/day free, 50k/month paid)
```

**Testing:** Send a test email via Resend

---

### Phase 2: Workflows (Orchestration) 🔄

#### Step 5: OAuth Setup Workflow
**Priority:** HIGH | **Estimated Time:** 3-4 hours

**What to build:**
- Google OAuth flow for Sheets + Gmail
- Store credentials securely
- Test connection to both services
- Handle token refresh

**Why now:** Required before users can use Google services

**Implementation details:**
```
src/mastra/workflows/oauth-setup-workflow.ts
- Step 1: Generate OAuth URL
- Step 2: Handle callback and exchange code
- Step 3: Test Sheets connection
- Step 4: Test Gmail connection
- Step 5: Update working memory with status
```

**Testing:** Complete OAuth flow in Playground

---

#### Step 6: Lead Research Workflow
**Priority:** HIGH | **Estimated Time:** 4-5 hours

**What to build:**
- Read leads from Google Sheet
- Parallel web searches for each lead
- Generate research summaries
- Score leads (High/Medium/Low fit)
- Write results back to sheet

**Why now:** Core functionality of the SDR agent

**Implementation details:**
```
src/mastra/workflows/lead-research-workflow.ts
- Step 1: Read sheet and parse leads
- Step 2: Create research plan
- Step 3: Execute parallel searches (batches of 10)
- Step 4: Process results and score leads
- Step 5: Generate personalized messages
- Step 6: Write new columns to sheet
- Step 7: Generate summary report
```

**Testing:** Process 10 test leads and verify results

---

#### Step 7: Email Dispatch Workflow
**Priority:** MEDIUM | **Estimated Time:** 3-4 hours

**What to build:**
- Filter leads based on criteria
- User confirmation before sending
- Bulk email dispatch
- Progress tracking
- Final summary report

**Why now:** Complete the full SDR cycle

**Implementation details:**
```
src/mastra/workflows/email-dispatch-workflow.ts
- Step 1: Load leads from sheet
- Step 2: Apply filters (High fit only, etc.)
- Step 3: Preview first 3 emails
- Step 4: Get user confirmation (suspend/resume)
- Step 5: Send emails in batches
- Step 6: Update sheet with sent status
- Step 7: Generate dispatch report
```

**Testing:** Send emails to 3 test addresses

---

### Phase 3: Integration & Polish 🎨

#### Step 8: Integrate Tools to Agent
**Priority:** HIGH | **Estimated Time:** 1 hour

**What to build:**
- Add all tools to agent configuration
- Update agent exports
- Verify tools are accessible

**Implementation details:**
```typescript
// In sdr-agent.ts
import { tavilySearchTool } from '../tools/tavily-search-tool';
import { googleSheetsTool } from '../tools/google-sheets-tool';
// ... etc

export const sdrAgent = new Agent({
  // ...
  tools: {
    tavilySearchTool,
    googleSheetsTool,
    gmailTool,
    resendTool,
  },
});
```

**Testing:** Verify all tools appear in Playground

---

#### Step 9: Integrate Workflows to Agent
**Priority:** HIGH | **Estimated Time:** 1 hour

**What to build:**
- Add all workflows to agent configuration
- Update Mastra instance with workflows
- Verify workflows are accessible

**Implementation details:**
```typescript
// In index.ts
export const mastra = new Mastra({
  workflows: { 
    weatherWorkflow,
    oauthSetupWorkflow,
    leadResearchWorkflow,
    emailDispatchWorkflow,
  },
  // ...
});
```

**Testing:** Verify workflows appear in Playground

---

#### Step 10: Update System Prompt
**Priority:** MEDIUM | **Estimated Time:** 1-2 hours

**What to build:**
- Add section describing available tools
- Add section describing available workflows
- Update examples to show tool/workflow usage
- Add instructions on when to use each

**Implementation details:**
```
Update: src/mastra/agents/prompts/sdr-system-prompt.ts
- Add <tools_available> section
- Add <workflows_available> section
- Add usage examples
- Update behavioral guidelines
```

**Testing:** Ask agent about its capabilities

---

### Phase 4: Testing & Documentation 📚

#### Step 11: End-to-End Testing
**Priority:** HIGH | **Estimated Time:** 2-3 hours

**What to test:**
1. Complete OAuth setup
2. Process 50 test leads
3. Review research results
4. Send emails to test group
5. Verify all data in sheet
6. Check rate limits and errors

**Success criteria:**
- All tools work correctly
- Workflows execute without errors
- Results are accurate and high-quality
- Performance is acceptable

---

#### Step 12: Documentation
**Priority:** MEDIUM | **Estimated Time:** 2-3 hours

**What to create:**
- Main README with setup instructions
- Environment variables guide
- OAuth setup walkthrough
- Usage examples
- Troubleshooting guide
- API limits reference

**Files to create:**
```
README.md - Main documentation
docs/SETUP.md - Installation guide
docs/OAUTH.md - OAuth configuration
docs/USAGE.md - How to use the agent
docs/TROUBLESHOOTING.md - Common issues
```

---

## 🎯 Recommended Order of Execution

### Week 1: Foundation
1. **Day 1-2:** Tavily Tool + Testing
2. **Day 3-4:** Google Sheets Tool + Testing
3. **Day 5:** Gmail Tool + Testing

### Week 2: Expansion
4. **Day 1:** Resend Tool + Testing
5. **Day 2-3:** OAuth Setup Workflow + Testing
6. **Day 4-5:** Lead Research Workflow + Testing

### Week 3: Completion
7. **Day 1-2:** Email Dispatch Workflow + Testing
8. **Day 3:** Integration (Tools + Workflows)
9. **Day 4:** Update System Prompt
10. **Day 5:** End-to-End Testing

### Week 4: Polish
11. **Day 1-2:** Documentation
12. **Day 3:** Final testing and bug fixes
13. **Day 4-5:** Buffer for unexpected issues

---

## 📊 Progress Tracking

**Total Estimated Time:** 30-40 hours
**Complexity:** Medium-High
**Risk Level:** Low (incremental approach)

### Current Progress: 8%
- [x] Setup (8%)
- [ ] Phase 1: Tools (25%)
- [ ] Phase 2: Workflows (35%)
- [ ] Phase 3: Integration (17%)
- [ ] Phase 4: Testing & Docs (15%)

---

## 🚨 Critical Dependencies

1. **Tavily API Key** - Required for web search
2. **Google Cloud Project** - Required for Sheets + Gmail OAuth
3. **Resend API Key** - Required for alternative email service
4. **OpenAI API Key** - Required for LLM (already have)

---

## 💡 Pro Tips

1. **Test each tool independently** before moving to workflows
2. **Use mock data** for initial testing to avoid API costs
3. **Implement rate limiting** from the start
4. **Keep tools simple** - one responsibility each
5. **Use workflows** for complex orchestration
6. **Update prompts** as you add capabilities
7. **Document as you go** - don't leave for the end
8. **Ask for help** when stuck (use Mastra MCP docs)

---

## 🎓 Learning Resources

As you implement each step, consult:
- Mastra Documentation (via MCP)
- Google Sheets API Docs
- Gmail API Docs
- Resend API Docs
- Tavily API Docs

---

## ✅ Next Immediate Action

**START HERE:** Step 1 - Tavily Web Search Tool

```bash
# 1. Get Tavily API key from https://tavily.com
# 2. Add to .env: TAVILY_API_KEY=your_key_here
# 3. Create src/mastra/tools/tavily-search-tool.ts
# 4. Test in Playground
```

Ready to start? Let's build the Tavily tool first! 🚀

