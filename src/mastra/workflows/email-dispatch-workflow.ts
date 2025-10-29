import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { googleSheetsReaderTool } from '../tools/google-sheets-reader';
import { googleSheetsWriterTool } from '../tools/google-sheets-writer';
import { gmailSenderTool } from '../tools/gmail-sender';

/**
 * Email Dispatch Workflow - Production Ready
 * 
 * Complete email sending workflow following AGENTE_SDR_ESPECIFICACAO.md:
 * 1. Load leads from processed sheet
 * 2. Apply filters (score, possible client, custom)
 * 3. Preview sample emails (SUSPEND for confirmation)
 * 4. Send emails in batches with rate limiting
 * 5. Update sheet with send status
 * 6. Generate dispatch report
 */

// Step 1: Load Leads from Sheet
const loadLeadsStep = createStep({
  id: 'load-leads',
  description: 'Load all processed leads from Google Sheet',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string().email(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    totalLeads: z.number(),
    leads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string().optional(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string().optional(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, accessToken, fromEmail } = inputData;
    
    // Get sheet metadata
    const metadataResult = await googleSheetsReaderTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        mode: 'metadata' as const,
      },
    } as any);
    
    if (!metadataResult?.success || !metadataResult.sheets?.[0]) {
      throw new Error('Failed to load sheet metadata');
    }
    
    const sheetName = metadataResult.sheets[0].name;
    
    // Read all data
    const dataResult = await googleSheetsReaderTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        mode: 'full' as const,
        sheetName,
        parseAsObjects: true,
        skipEmptyRows: true,
      },
    } as any);
    
    if (!dataResult?.success || !dataResult.dataObjects) {
      throw new Error('Failed to load leads from sheet');
    }
    
    // Helper: Find column key (case-insensitive, multiple aliases)
    const findColumn = (row: any, aliases: string[]) => {
      const keys = Object.keys(row);
      return keys.find(k => 
        aliases.some(alias => k.toLowerCase().includes(alias.toLowerCase()))
      );
    };
    
    // Parse leads with robust column detection
    const leads = dataResult.dataObjects.map((row: any, index: number) => {
      const emailKey = findColumn(row, ['email', 'e-mail', 'mail']);
      const companyKey = findColumn(row, ['company', 'empresa', 'company name']);
      const scoreKey = findColumn(row, ['score', 'score (0-100)', 'lead score', 'pontuação']);
      const possibleKey = findColumn(row, ['possible client', 'possible client?', 'possível cliente']);
      const messageKey = findColumn(row, ['personalized message', 'message', 'mensagem']);
      const summaryKey = findColumn(row, ['sdr summary', 'summary', 'resumo']);
      const industryKey = findColumn(row, ['industry', 'sector', 'setor', 'indústria']);
      
      // Extract score from possible client column if it has format "YES (Score: 85)"
      let score: number | undefined = undefined;
      if (scoreKey && row[scoreKey]) {
        score = parseInt(row[scoreKey], 10);
      } else if (possibleKey && row[possibleKey]) {
        const scoreMatch = String(row[possibleKey]).match(/Score:\s*(\d+)/);
        if (scoreMatch) score = parseInt(scoreMatch[1], 10);
      }
      
      // Extract YES/NO from possible client
      const possibleClientRaw = possibleKey ? String(row[possibleKey]) : '';
      const isPossibleClient = possibleClientRaw.toUpperCase().includes('YES') ? 'YES' : 
                              possibleClientRaw.toUpperCase().includes('NO') ? 'NO' : undefined;
      
      return {
        rowNumber: index + 2,
        email: emailKey ? row[emailKey] : undefined,
        companyName: companyKey ? row[companyKey] : `Lead ${index + 1}`,
        score,
        isPossibleClient,
        message: messageKey ? row[messageKey] : undefined,
        summary: summaryKey ? row[summaryKey] : undefined,
        industry: industryKey ? row[industryKey] : undefined,
      };
    });
    
    return {
      spreadsheetId,
      accessToken,
      fromEmail,
      sheetName,
      totalLeads: leads.length,
      leads,
    };
  },
});

// Step 2: Apply Filters (with SUSPEND for user to choose)
const applyFiltersStep = createStep({
  id: 'apply-filters',
  description: 'Filter leads based on user criteria',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    totalLeads: z.number(),
    leads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string().optional(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string().optional(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
  }),
  suspendSchema: z.object({
    message: z.string(),
    stats: z.object({
      totalLeads: z.number(),
      withEmail: z.number(),
      possibleClients: z.number(),
      averageScore: z.number(),
      highScore: z.number(), // >= 70
      mediumScore: z.number(), // 50-69
      lowScore: z.number(), // < 50
    }),
    suggestedFilters: z.array(z.object({
      name: z.string(),
      description: z.string(),
      estimatedCount: z.number(),
    })),
  }),
  resumeSchema: z.object({
    selectedFilter: z.enum(['all', 'possible-clients', 'high-score', 'medium-score', 'large-companies', 'tech-sector', 'custom']),
    customMinScore: z.number().optional(),
    customMaxScore: z.number().optional(),
    customIndustry: z.string().optional(),
    onlyWithEmail: z.boolean().optional(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    filteredLeads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
    filterApplied: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { spreadsheetId, accessToken, fromEmail, sheetName, leads } = inputData;
    
    // Calculate stats
    const withEmail = leads.filter(l => l.email).length;
    const possibleClients = leads.filter(l => l.isPossibleClient === 'YES').length;
    const scores = leads.filter(l => l.score !== undefined).map(l => l.score!);
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const highScore = leads.filter(l => l.score && l.score >= 70).length;
    const mediumScore = leads.filter(l => l.score && l.score >= 50 && l.score < 70).length;
    const lowScore = leads.filter(l => l.score && l.score < 50).length;
    
    const stats = {
      totalLeads: leads.length,
      withEmail,
      possibleClients,
      averageScore,
      highScore,
      mediumScore,
      lowScore,
    };
    
    // Detect company size from summary
    const detectCompanySize = (summary: string | undefined) => {
      if (!summary) return 'unknown';
      const lowerSummary = summary.toLowerCase();
      if (lowerSummary.includes('enterprise') || lowerSummary.includes('large') || lowerSummary.includes('fortune')) return 'large';
      if (lowerSummary.includes('startup') || lowerSummary.includes('small')) return 'small';
      return 'medium';
    };
    
    const largeCompanies = leads.filter(l => l.email && detectCompanySize(l.summary) === 'large').length;
    const techSector = leads.filter(l => {
      const industry = (l.industry || '').toLowerCase();
      const summary = (l.summary || '').toLowerCase();
      return l.email && (
        industry.includes('tech') || industry.includes('software') || industry.includes('saas') ||
        summary.includes('technology') || summary.includes('software') || summary.includes('saas')
      );
    }).length;
    
    // Suggest filters
    const suggestedFilters = [
      {
        name: 'All Leads with Email',
        description: 'Send to all leads that have an email address',
        estimatedCount: withEmail,
      },
      {
        name: 'Possible Clients Only',
        description: 'Send only to leads marked as "Possible Client: YES"',
        estimatedCount: leads.filter(l => l.email && l.isPossibleClient === 'YES').length,
      },
      {
        name: 'High Score (≥70)',
        description: 'Send to leads with score 70 or higher',
        estimatedCount: leads.filter(l => l.email && l.score && l.score >= 70).length,
      },
      {
        name: 'Medium Score (50-69)',
        description: 'Send to leads with score between 50 and 69',
        estimatedCount: leads.filter(l => l.email && l.score && l.score >= 50 && l.score < 70).length,
      },
      {
        name: 'Large Companies Only',
        description: 'Send to medium/large enterprises (detected from company description)',
        estimatedCount: largeCompanies,
      },
      {
        name: 'Tech Sector Only',
        description: 'Send to technology/software companies',
        estimatedCount: techSector,
      },
      {
        name: 'Custom Filter',
        description: 'Define your own criteria (score range, industry, etc.)',
        estimatedCount: 0,
      },
    ];
    
    if (!resumeData?.selectedFilter) {
      return await suspend({
        message: `📧 Email Dispatch - Filter Selection\n\n📊 Lead Statistics:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  • Total Leads: ${stats.totalLeads}\n  • With Email: ${stats.withEmail}\n  • Possible Clients: ${stats.possibleClients}\n  • Average Score: ${stats.averageScore}/100\n\n📈 Score Distribution:\n  • High (≥70): ${stats.highScore} leads\n  • Medium (50-69): ${stats.mediumScore} leads\n  • Low (<50): ${stats.lowScore} leads\n\n🎯 Suggested Filters:\n${suggestedFilters.map((f, i) => `  ${i + 1}. ${f.name}\n     ${f.description}\n     → ~${f.estimatedCount} emails`).join('\n\n')}\n\nSelect a filter to proceed.`,
        stats,
        suggestedFilters,
      });
    }
    
    // Apply selected filter
    let filteredLeads = leads.filter(l => l.email && l.message); // Base: must have email and message
    let filterDescription = 'Unknown filter';
    
    switch (resumeData.selectedFilter) {
      case 'all':
        filterDescription = 'All leads with email';
        break;
      
      case 'possible-clients':
        filteredLeads = filteredLeads.filter(l => l.isPossibleClient === 'YES');
        filterDescription = 'Possible clients only';
        break;
      
      case 'high-score':
        filteredLeads = filteredLeads.filter(l => l.score && l.score >= 70);
        filterDescription = 'High score leads (≥70)';
        break;
      
      case 'medium-score':
        filteredLeads = filteredLeads.filter(l => l.score && l.score >= 50 && l.score < 70);
        filterDescription = 'Medium score leads (50-69)';
        break;
      
      case 'large-companies':
        filteredLeads = filteredLeads.filter(l => detectCompanySize(l.summary) === 'large');
        filterDescription = 'Large/Enterprise companies';
        break;
      
      case 'tech-sector':
        filteredLeads = filteredLeads.filter(l => {
          const industry = (l.industry || '').toLowerCase();
          const summary = (l.summary || '').toLowerCase();
          return industry.includes('tech') || industry.includes('software') || industry.includes('saas') ||
                 summary.includes('technology') || summary.includes('software') || summary.includes('saas');
        });
        filterDescription = 'Technology/Software sector';
        break;
      
      case 'custom':
        const minScore = resumeData.customMinScore || 0;
        const maxScore = resumeData.customMaxScore || 100;
        filteredLeads = filteredLeads.filter(l => l.score && l.score >= minScore && l.score <= maxScore);
        
        if (resumeData.customIndustry) {
          const industryFilter = resumeData.customIndustry.toLowerCase();
          filteredLeads = filteredLeads.filter(l => {
            const industry = (l.industry || '').toLowerCase();
            const summary = (l.summary || '').toLowerCase();
            return industry.includes(industryFilter) || summary.includes(industryFilter);
          });
          filterDescription = `Custom: Score ${minScore}-${maxScore}, Industry: ${resumeData.customIndustry}`;
        } else {
          filterDescription = `Custom score range (${minScore}-${maxScore})`;
        }
        break;
    }
    
    if (resumeData.onlyWithEmail) {
      filteredLeads = filteredLeads.filter(l => l.email);
    }
    
    // Type cast to ensure email and message are strings
    const validFilteredLeads = filteredLeads
      .filter((l): l is typeof l & { email: string; message: string } => 
        typeof l.email === 'string' && typeof l.message === 'string'
      );
    
    return {
      spreadsheetId,
      accessToken,
      fromEmail,
      sheetName,
      filteredLeads: validFilteredLeads,
      filterApplied: filterDescription,
    };
  },
});

// Step 3: Preview Emails (with SUSPEND for confirmation)
const previewEmailsStep = createStep({
  id: 'preview-emails',
  description: 'Preview sample emails before sending',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    filteredLeads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
    filterApplied: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
    totalToSend: z.number(),
    sampleEmails: z.array(z.object({
      to: z.string(),
      companyName: z.string(),
      subject: z.string(),
      preview: z.string(),
    })),
    dailyLimit: z.number(),
    warning: z.string().optional(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean(),
    customSubjectTemplate: z.string().optional(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    filteredLeads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
    subjectTemplate: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { spreadsheetId, accessToken, fromEmail, sheetName, filteredLeads } = inputData;
    
    const GMAIL_DAILY_LIMIT = 500;
    const sampleSize = Math.min(3, filteredLeads.length);
    const sampleLeads = filteredLeads.slice(0, sampleSize);
    
    const defaultSubject = 'Opportunity for {company}';
    
    const sampleEmails = sampleLeads.map(lead => ({
      to: lead.email,
      companyName: lead.companyName,
      subject: defaultSubject.replace('{company}', lead.companyName),
      preview: lead.message.slice(0, 150) + (lead.message.length > 150 ? '...' : ''),
    }));
    
    const warning = filteredLeads.length > GMAIL_DAILY_LIMIT 
      ? `⚠️  You're trying to send ${filteredLeads.length} emails, but Gmail limit is ${GMAIL_DAILY_LIMIT}/day. Consider splitting into batches.`
      : undefined;
    
    if (!resumeData?.confirmed) {
      return await suspend({
        message: `📧 Email Preview & Confirmation\n\n📨 Ready to send ${filteredLeads.length} emails\n📤 From: ${fromEmail}\n🎯 Filter Applied: ${inputData.filterApplied}\n\n📝 Sample Emails (first ${sampleSize}):\n${sampleEmails.map((e, i) => `\n${i + 1}. To: ${e.to}\n   Company: ${e.companyName}\n   Subject: ${e.subject}\n   Preview: "${e.preview}"`).join('\n')}\n\n${warning || '✅ Within daily limit'}\n\nConfirm to proceed with sending?`,
        totalToSend: filteredLeads.length,
        sampleEmails,
        dailyLimit: GMAIL_DAILY_LIMIT,
        warning,
      });
    }
    
    const subjectTemplate = resumeData.customSubjectTemplate || defaultSubject;
    
    return {
      spreadsheetId,
      accessToken,
      fromEmail,
      sheetName,
      filteredLeads,
      subjectTemplate,
    };
  },
});

// Step 4: Send Emails in Batches
const sendEmailsStep = createStep({
  id: 'send-emails',
  description: 'Send emails in batches with rate limiting and progress tracking',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    fromEmail: z.string(),
    sheetName: z.string(),
    filteredLeads: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      score: z.number().optional(),
      isPossibleClient: z.string().optional(),
      message: z.string(),
      summary: z.string().optional(),
      industry: z.string().optional(),
    })),
    subjectTemplate: z.string(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    sheetName: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      status: z.enum(['sent', 'failed']),
      messageId: z.string().optional(),
      error: z.string().optional(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, accessToken, fromEmail, sheetName, filteredLeads, subjectTemplate } = inputData;
    
    const BATCH_SIZE = 50; // Process 50 emails in parallel
    const STAGGER_DELAY = 200; // 200ms delay between starting each email send (rate limiting)
    const MAX_RETRIES = 2;
    
    let totalSent = 0;
    let totalFailed = 0;
    const results: any[] = [];
    
    console.log(`\n📧 Starting email dispatch: ${filteredLeads.length} emails`);
    
    // Helper: Send single email with retries
    const sendSingleEmail = async (lead: typeof filteredLeads[0], delayMs: number = 0) => {
      // Stagger start time for rate limiting
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const subject = subjectTemplate.replace('{company}', lead.companyName);
          
          const sendResult = await gmailSenderTool.execute({
            context: {
              to: lead.email,
              from: fromEmail,
              subject,
              body: lead.message,
              html: false,
              accessToken,
            },
          } as any);
          
          if (sendResult?.success) {
            console.log(`   ✅ Sent to ${lead.email} (${lead.companyName})`);
            return {
              rowNumber: lead.rowNumber,
              email: lead.email,
              companyName: lead.companyName,
              status: 'sent' as const,
              messageId: sendResult.messageId,
            };
          } else {
            throw new Error(sendResult?.error || 'Unknown error');
          }
        } catch (error: any) {
          lastError = error;
          if (attempt < MAX_RETRIES) {
            console.log(`   ⏳ Retry ${attempt}/${MAX_RETRIES} for ${lead.email}...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          }
        }
      }
      
      // All retries failed
      console.error(`   ❌ Failed to send to ${lead.email}: ${lastError?.message}`);
      return {
        rowNumber: lead.rowNumber,
        email: lead.email,
        companyName: lead.companyName,
        status: 'failed' as const,
        error: lastError?.message || 'Failed after retries',
      };
    };
    
    // Process in parallel batches
    for (let i = 0; i < filteredLeads.length; i += BATCH_SIZE) {
      const batch = filteredLeads.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(filteredLeads.length / BATCH_SIZE);
      
      console.log(`\n📨 Batch ${batchNum}/${totalBatches}: Sending ${batch.length} emails in PARALLEL...`);
      
      // Send all emails in batch PARALLEL with staggered starts
      const batchPromises = batch.map((lead, index) => 
        sendSingleEmail(lead, index * STAGGER_DELAY)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate results
      for (const result of batchResults) {
        results.push(result);
        if (result.status === 'sent') {
          totalSent++;
        } else {
          totalFailed++;
        }
      }
      
      console.log(`   📊 Batch complete: ${totalSent} sent, ${totalFailed} failed (${totalSent + totalFailed}/${filteredLeads.length} total)`);
      
      // Small delay between batches
      if (i + BATCH_SIZE < filteredLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`\n✅ Email dispatch complete: ${totalSent}/${filteredLeads.length} sent successfully`);
    
    return {
      spreadsheetId,
      accessToken,
      sheetName,
      totalSent,
      totalFailed,
      results,
    };
  },
});

// Step 5: Update Sheet with Send Status
const updateSendStatusStep = createStep({
  id: 'update-send-status',
  description: 'Update Google Sheet with email send status and timestamp',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    sheetName: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      status: z.enum(['sent', 'failed']),
      messageId: z.string().optional(),
      error: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      status: z.enum(['sent', 'failed']),
      messageId: z.string().optional(),
      error: z.string().optional(),
    })),
    sheetUpdated: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, accessToken, sheetName, results, totalSent, totalFailed } = inputData;
    
    console.log(`\n💾 Updating sheet with send status...`);
    
    try {
      // Find the next available column for "Email Status" and "Send Date"
      // We'll assume columns after Personalized Message
      // For simplicity, we'll write to specific columns (adjust as needed)
      
      // Helper to convert column index to A1 notation
      const colIndexToA1 = (colIdx: number) => {
        let colStr = '';
        for (; colIdx >= 0; colIdx = Math.floor(colIdx / 26) - 1) {
          colStr = String.fromCharCode(colIdx % 26 + 65) + colStr;
        }
        return colStr;
      };
      
      // Batch write: Group updates into chunks
      const WRITE_BATCH_SIZE = 100;
      const writeData: { range: string; values: string[][]; }[] = [];
      
      for (const result of results) {
        const statusText = result.status === 'sent' 
          ? `✅ Sent${result.messageId ? ` (${result.messageId.substring(0, 10)}...)` : ''}`
          : `❌ Failed: ${result.error || 'Unknown error'}`;
        const sendDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Assuming Email Status is column G and Send Date is column H (adjust as needed)
        const statusCol = 'G';
        const dateCol = 'H';
        
        writeData.push({
          range: `${sheetName}!${statusCol}${result.rowNumber}:${dateCol}${result.rowNumber}`,
          values: [[statusText, sendDate]],
        });
      }
      
      // Write in batches
      for (let i = 0; i < writeData.length; i += WRITE_BATCH_SIZE) {
        const batch = writeData.slice(i, i + WRITE_BATCH_SIZE);
        
        console.log(`   💾 Writing batch ${Math.floor(i / WRITE_BATCH_SIZE) + 1}/${Math.ceil(writeData.length / WRITE_BATCH_SIZE)}...`);
        
        // Execute batch writes sequentially (Google Sheets API limitation)
        for (const write of batch) {
          await googleSheetsWriterTool.execute({
            context: {
              spreadsheetId,
              accessToken,
              range: write.range,
              values: write.values,
              mode: 'update' as const,
            },
          } as any);
        }
      }
      
      console.log(`   ✅ Sheet updated with ${results.length} status entries`);
      
      return {
        ...inputData,
        sheetUpdated: true,
      };
      
    } catch (error: any) {
      console.error(`   ⚠️  Failed to update sheet: ${error.message}`);
      console.log(`   (Email dispatch was successful, but status tracking failed)`);
      
      return {
        ...inputData,
        sheetUpdated: false,
      };
    }
  },
});

// Step 6: Generate Dispatch Report
const generateDispatchReportStep = createStep({
  id: 'generate-dispatch-report',
  description: 'Generate comprehensive dispatch report',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      email: z.string(),
      companyName: z.string(),
      status: z.enum(['sent', 'failed']),
      messageId: z.string().optional(),
      error: z.string().optional(),
    })),
    sheetUpdated: z.boolean(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    successRate: z.number(),
    sentEmails: z.array(z.object({
      email: z.string(),
      companyName: z.string(),
      messageId: z.string(),
    })),
    failedEmails: z.array(z.object({
      email: z.string(),
      companyName: z.string(),
      error: z.string(),
    })),
    spreadsheetUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, totalSent, totalFailed, results } = inputData;
    
    const total = totalSent + totalFailed;
    const successRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;
    
    const sentEmails = results
      .filter(r => r.status === 'sent')
      .map(r => ({
        email: r.email,
        companyName: r.companyName,
        messageId: r.messageId || 'N/A',
      }));
    
    const failedEmails = results
      .filter(r => r.status === 'failed')
      .map(r => ({
        email: r.email,
        companyName: r.companyName,
        error: r.error || 'Unknown error',
      }));
    
    const summary = `✅ Email Dispatch Complete!

📧 **Dispatch Summary:**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Total Emails: ${total}
  • Successfully Sent: ${totalSent} ✓
  • Failed: ${totalFailed} ✗
  • Success Rate: ${successRate}%

${failedEmails.length > 0 ? `\n⚠️  **Failed Emails** (${failedEmails.length}):\n${failedEmails.slice(0, 5).map((f, i) => `  ${i + 1}. ${f.email} (${f.companyName})\n     Error: ${f.error}`).join('\n')}${failedEmails.length > 5 ? `\n  ... and ${failedEmails.length - 5} more` : ''}` : ''}

🔗 **View Sheet:**
   https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

💡 **Next Steps:**
   • Monitor inbox for responses
   • Follow up with high-score leads after 3-5 days
   • Track engagement metrics
`;

    return {
      summary,
      totalSent,
      totalFailed,
      successRate,
      sentEmails,
      failedEmails,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  },
});

// Main Email Dispatch Workflow
export const emailDispatchWorkflow = createWorkflow({
  id: 'email-dispatch-workflow',
  description: 'Complete email sending workflow with filtering, preview, batch sending, and tracking',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('Google Sheet ID containing processed leads'),
    accessToken: z.string().describe('OAuth access token for Google API'),
    fromEmail: z.string().email().describe('Sender email address (must be authenticated user)'),
  }),
  outputSchema: z.object({
    summary: z.string(),
    totalSent: z.number(),
    totalFailed: z.number(),
    successRate: z.number(),
    sentEmails: z.array(z.object({
      email: z.string(),
      companyName: z.string(),
      messageId: z.string(),
    })),
    failedEmails: z.array(z.object({
      email: z.string(),
      companyName: z.string(),
      error: z.string(),
    })),
    spreadsheetUrl: z.string(),
  }),
})
  .then(loadLeadsStep)
  .then(applyFiltersStep)
  .then(previewEmailsStep)
  .then(sendEmailsStep)
  .then(updateSendStatusStep)
  .then(generateDispatchReportStep)
  .commit();

