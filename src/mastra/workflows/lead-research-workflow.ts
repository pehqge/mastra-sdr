import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { googleSheetsReaderTool } from '../tools/google-sheets-reader';
import { googleSheetsWriterTool } from '../tools/google-sheets-writer';
import { tavilyMcp } from '../mcp/tavily-mcp';

/**
 * Lead Research Workflow - Production Ready
 * 
 * Complete SDR workflow following AGENTE_SDR_ESPECIFICACAO.md:
 * 1. Validate Sheets connection
 * 2. Explore sheet structure (SUSPEND for user confirmation)
 * 3. Create research plan (SUSPEND for user approval)
 * 4. Process leads in PARALLEL batches with progress tracking
 * 5. Generate scored analysis (0-100) + personalized messages
 * 6. Batch write results to sheet (50 rows at a time)
 * 7. Present results summary
 */

// Helper: Convert column index to A1 notation (supports > 26 columns)
const colIndexToA1 = (colIdx: number): string => {
  let colStr = '';
  for (; colIdx > 0; colIdx = Math.floor((colIdx - 1) / 26)) {
    colStr = String.fromCharCode(((colIdx - 1) % 26) + 65) + colStr;
  }
  return colStr;
};

// Helper: Extract keywords from product description for better search
const extractSearchKeywords = (productDescription: string | undefined): string => {
  if (!productDescription) return '';
  
  // Remove common words and extract key terms
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'to'];
  const words = productDescription.toLowerCase().split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.includes(w))
    .slice(0, 3); // Top 3 keywords
  
  return words.join(' ');
};

// Step 1: Validate Sheets Connection
const validateConnectionStep = createStep({
  id: 'validate-connection',
  description: 'Validate Google Sheets connection and permissions',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    isConnected: z.boolean(),
    spreadsheetTitle: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, accessToken, productDescription } = inputData;
    
    try {
      const metadataResult = await googleSheetsReaderTool.execute({
        context: {
          spreadsheetId,
          accessToken,
          mode: 'metadata' as const,
        },
      } as any);
      
      if (!metadataResult?.success || !metadataResult.sheets?.[0]) {
        throw new Error('Failed to connect to spreadsheet. Check permissions.');
      }
      
      return {
        spreadsheetId,
        accessToken,
        productDescription,
        isConnected: true,
        spreadsheetTitle: metadataResult.spreadsheetTitle || 'Untitled Spreadsheet',
      };
    } catch (error: any) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  },
});

// Step 2: Explore Sheet Structure (with SUSPEND for user confirmation)
const exploreStructureStep = createStep({
  id: 'explore-structure',
  description: 'Read sheet structure and sample data for user confirmation',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    isConnected: z.boolean(),
    spreadsheetTitle: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
    sheetName: z.string(),
    headers: z.array(z.string()),
    sampleRows: z.array(z.record(z.string(), z.any())),
    totalRows: z.number(),
    suggestedMapping: z.object({
      companyColumn: z.string().optional(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean(),
    customMapping: z.object({
      companyColumn: z.string().optional(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    sheetName: z.string(),
    headers: z.array(z.string()),
    totalRows: z.number(),
    columnCount: z.number(),
    columnMapping: z.object({
      companyColumn: z.string(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { spreadsheetId, accessToken, productDescription } = inputData;
    
    // Get metadata
    const metadataResult = await googleSheetsReaderTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        mode: 'metadata' as const,
      },
    } as any);
    
    if (!metadataResult?.success || !metadataResult.sheets?.[0]) {
      throw new Error('Failed to read sheet metadata');
    }
    
    const firstSheet = metadataResult.sheets[0];
    const sheetName = firstSheet.name;
    const totalRows = firstSheet.rowCount - 1;
    const columnCount = firstSheet.columnCount;
    
    // Read headers
    const headersResult = await googleSheetsReaderTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        mode: 'range' as const,
        range: `${sheetName}!1:1`,
        sheetName,
      },
    } as any);
    
    if (!headersResult?.success || !headersResult.headers) {
      throw new Error('Failed to read headers');
    }
    
    const headers = headersResult.headers;
    
    // Read sample rows (first 5 data rows)
    const sampleResult = await googleSheetsReaderTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        mode: 'range' as const,
        range: `${sheetName}!2:6`,
        sheetName,
        parseAsObjects: true,
      },
    } as any);
    
    const sampleRows = sampleResult?.dataObjects || [];
    
    // Auto-detect column mapping
    const lowerHeaders = headers.map(h => h.toLowerCase());
    const suggestedMapping = {
      companyColumn: headers.find((_, i) => 
        lowerHeaders[i].includes('company') || 
        lowerHeaders[i].includes('empresa') ||
        lowerHeaders[i].includes('organization')
      ),
      emailColumn: headers.find((_, i) => 
        lowerHeaders[i].includes('email') || 
        lowerHeaders[i].includes('e-mail') ||
        lowerHeaders[i].includes('mail')
      ),
      nameColumn: headers.find((_, i) => 
        lowerHeaders[i].includes('name') || 
        lowerHeaders[i].includes('nome') ||
        lowerHeaders[i].includes('contact')
      ),
    };
    
    // Check if user confirmed
    if (!resumeData?.confirmed) {
      return await suspend({
        message: `📊 Sheet Structure Analysis\n\nSheet: "${sheetName}"\nTotal Leads: ${totalRows}\nColumns Found: ${headers.join(', ')}\n\nSuggested Mapping:\n- Company: ${suggestedMapping.companyColumn || 'Not found'}\n- Email: ${suggestedMapping.emailColumn || 'Not found'}\n- Name: ${suggestedMapping.nameColumn || 'Not found'}\n\nPlease review and confirm to proceed.`,
        sheetName,
        headers,
        sampleRows,
        totalRows,
        suggestedMapping,
      });
    }
    
    // Use custom mapping if provided, otherwise use suggested
    const finalMapping = resumeData.customMapping || suggestedMapping;
    
    if (!finalMapping.companyColumn) {
      throw new Error('Company column is required. Please provide a valid column mapping.');
    }
    
    return {
      spreadsheetId,
      accessToken,
      productDescription,
      sheetName,
      headers,
      totalRows,
      columnCount,
      columnMapping: {
        companyColumn: finalMapping.companyColumn,
        emailColumn: finalMapping.emailColumn,
        nameColumn: finalMapping.nameColumn,
      },
    };
  },
});

// Step 3: Create Research Plan (with SUSPEND for approval)
const createResearchPlanStep = createStep({
  id: 'create-research-plan',
  description: 'Generate research plan and get user approval',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    sheetName: z.string(),
    headers: z.array(z.string()),
    totalRows: z.number(),
    columnCount: z.number(),
    columnMapping: z.object({
      companyColumn: z.string(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }),
  }),
  suspendSchema: z.object({
    message: z.string(),
    plan: z.object({
      dataAvailable: z.array(z.string()),
      dataToSearch: z.array(z.string()),
      searchStrategy: z.string(),
      estimatedTimePerLead: z.number(),
      totalEstimatedTime: z.number(),
      batchSize: z.number(),
    }),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    adjustedBatchSize: z.number().optional(),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    sheetName: z.string(),
    headers: z.array(z.string()),
    totalRows: z.number(),
    columnCount: z.number(),
    columnMapping: z.object({
      companyColumn: z.string(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }),
    researchPlan: z.object({
      batchSize: z.number(),
      estimatedTimePerLead: z.number(),
      totalEstimatedTime: z.number(),
    }),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { totalRows, headers, columnMapping, productDescription } = inputData;
    
    // Generate research plan
    const plan = {
      dataAvailable: headers,
      dataToSearch: [
        'Company overview and description',
        'Recent news and updates',
        'Company size and maturity indicators',
        'Industry and market segment',
      ],
      searchStrategy: `For each lead:\n1. Search: "[Company] company information"\n2. Search: "[Company] recent news"\n3. Analyze fit based on ${productDescription ? `product: ${productDescription}` : 'product offering'}\n4. Generate personalized message`,
      estimatedTimePerLead: 12,
      totalEstimatedTime: (totalRows * 12) / 60, // in minutes
      batchSize: 10,
    };
    
    if (!resumeData?.approved) {
      return await suspend({
        message: `🔍 Research Plan\n\n📊 Data Available: ${plan.dataAvailable.join(', ')}\n\n🔎 Will Search For:\n${plan.dataToSearch.map(d => `  • ${d}`).join('\n')}\n\n⚙️ Strategy:\n${plan.searchStrategy}\n\n⏱️ Estimated Time:\n  • Per Lead: ~${plan.estimatedTimePerLead}s\n  • Total: ~${Math.ceil(plan.totalEstimatedTime)} minutes\n  • Batch Size: ${plan.batchSize} leads in parallel\n\nApprove to start processing ${totalRows} leads?`,
        plan,
      });
    }
    
    const batchSize = resumeData.adjustedBatchSize || plan.batchSize;
    
    return {
      ...inputData,
      researchPlan: {
        batchSize,
        estimatedTimePerLead: plan.estimatedTimePerLead,
        totalEstimatedTime: plan.totalEstimatedTime,
      },
    };
  },
});

// Step 4: Process Leads in Parallel with Progress (PRODUCTION VERSION)
const processLeadsStep = createStep({
  id: 'process-leads',
  description: 'Process all leads with progress tracking and error handling',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    accessToken: z.string(),
    productDescription: z.string().optional(),
    sheetName: z.string(),
    headers: z.array(z.string()),
    totalRows: z.number(),
    columnCount: z.number(),
    columnMapping: z.object({
      companyColumn: z.string(),
      emailColumn: z.string().optional(),
      nameColumn: z.string().optional(),
    }),
    researchPlan: z.object({
      batchSize: z.number(),
      estimatedTimePerLead: z.number(),
      totalEstimatedTime: z.number(),
    }),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    totalProcessed: z.number(),
    successful: z.number(),
    failed: z.number(),
    possibleClients: z.number(),
    averageScore: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      companyName: z.string(),
      score: z.number(),
      isPossibleClient: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    })),
  }),
  execute: async ({ inputData, mastra }) => {
    const {
      spreadsheetId,
      accessToken,
      productDescription,
      sheetName,
      headers,
      totalRows,
      columnCount,
      columnMapping,
      researchPlan,
    } = inputData;
    
    const BATCH_SIZE = researchPlan.batchSize;
    const BATCH_WRITE_SIZE = 50; // Write to sheet in batches of 50
    
    let successful = 0;
    let failed = 0;
    let possibleClients = 0;
    let totalScore = 0;
    const results: any[] = [];
    const batchWriteBuffer: any[] = [];
    
    // Add new column headers first
    const newColumnStart = columnCount + 1;
    const columnLetter = colIndexToA1(newColumnStart);
    const endColumnLetter = colIndexToA1(newColumnStart + 3); // 4 columns
    
    await googleSheetsWriterTool.execute({
      context: {
        spreadsheetId,
        accessToken,
        range: `${sheetName}!${columnLetter}1:${endColumnLetter}1`,
        values: [['SDR Summary', 'Score (0-100)', 'Possible Client?', 'Personalized Message']],
        mode: 'update' as const,
      },
    } as any);
    
    // Get tools once
    const tavilyTools = await tavilyMcp.getTools();
    const tavilySearch = tavilyTools?.['tavily_search'];
    const sdrAgent = mastra.getAgent('sdr-agent');
    
    // Create array of row numbers
    const rowNumbers = [];
    for (let rowNumber = 2; rowNumber <= totalRows + 1; rowNumber++) {
      rowNumbers.push(rowNumber);
    }
    
    // Process in batches with progress tracking
    for (let i = 0; i < rowNumbers.length; i += BATCH_SIZE) {
      const batch = rowNumbers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rowNumbers.length / BATCH_SIZE);
      const percentComplete = Math.round((i / rowNumbers.length) * 100);
      
      console.log(`\n📊 Processing batch ${batchNum}/${totalBatches} (${percentComplete}% complete)`);
      console.log(`   Rows ${batch[0]}-${batch[batch.length - 1]} of ${totalRows}`);
      
      const batchPromises = batch.map(async (rowNumber) => {
        const MAX_RETRIES = 3;
        let lastError: any = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // 1. Read row
            const rowResult = await googleSheetsReaderTool.execute({
              context: {
                spreadsheetId,
                accessToken,
                mode: 'row' as const,
                rowNumber,
                parseAsObjects: true,
                sheetName,
              },
            } as any);
            
            if (!rowResult?.success || !rowResult.row) {
              throw new Error('Failed to read row');
            }
            
            const leadData = rowResult.row;
            const companyName = leadData[columnMapping.companyColumn] || 'Unknown Company';
            
            // 2. Research (with error handling and rich query)
            let researchResults = 'Limited research data available';
            if (tavilySearch) {
              try {
                // Build rich search query with product context
                const productKeywords = extractSearchKeywords(productDescription);
                const searchQuery = productDescription
                  ? `${companyName} company recent news funding growth ${productKeywords} fit business model`
                  : `${companyName} company business overview recent news funding`;
                
                const searchResult = await tavilySearch.execute({
                  context: {
                    query: searchQuery,
                    max_results: 3,
                  },
                });
                
                if (searchResult) {
                  researchResults = JSON.stringify(searchResult).slice(0, 1500);
                }
              } catch (searchError) {
                console.warn(`⚠️  Research failed for ${companyName} (attempt ${attempt}/${MAX_RETRIES})`);
                researchResults = 'Research data unavailable';
              }
            }
            
            // 3. Analysis with SCORE (0-100) - Enhanced Prompt
            const analysisPrompt = `
You are an elite SDR analyzing a potential client. Your goal is to identify pain points and craft compelling outreach.

Lead Information:
${JSON.stringify(leadData, null, 2)}

Research Results:
${researchResults}

${productDescription ? `Our Product/Solution: ${productDescription}` : ''}

IMPORTANT CONTEXT:
- Identify pain points this company likely has based on their industry and stage
- Look for buying signals: recent funding, team growth, new initiatives
- Consider what would make them buy NOW (urgency, budget cycles, competitive pressure)
- Use a professional but warm, conversational tone

Provide:
1. A detailed SDR summary (3-4 sentences):
   - What the company does and their current stage
   - Key pain points they likely face
   - Why they're a fit (or not) for our solution
   
2. A SCORE from 0-100 based on:
   - Market fit (0-30 points): How well do they align with our ICP? Do they match our target industry/size?
   - Company maturity (0-20 points): Are they ready to buy? Do they have budget? Are they growing?
   - Buying signals (0-30 points): Recent funding? Growing team? Job postings? News mentions?
   - Strategic alignment (0-20 points): Would this be a good long-term partnership?
   
3. Possible client determination (YES if score >= 60, NO otherwise)

4. A personalized email message (4-5 sentences):
   - Open with a SPECIFIC observation about their business (not generic)
   - Connect to a pain point they likely have
   - Explain how we help (value-focused, outcome-focused, NOT feature-focused)
   - Include a clear, low-friction CTA (e.g., "Would you be open to a quick 15-minute demo?")
   - Professional but conversational tone (avoid salesy language)

Format EXACTLY as:
SUMMARY: [detailed summary with pain points]
SCORE: [number 0-100]
POSSIBLE CLIENT: [YES or NO]
MESSAGE: [personalized, compelling email]
`;
            
            const analysisResponse = await sdrAgent?.generate(analysisPrompt, {
              maxSteps: 5,
            });
            
            const analysisText = analysisResponse?.text || '';
            
            // Parse with better regex
            const summaryMatch = analysisText.match(/SUMMARY:\s*(.+?)(?=SCORE:|$)/s);
            const scoreMatch = analysisText.match(/SCORE:\s*(\d+)/);
            const possibleMatch = analysisText.match(/POSSIBLE CLIENT:\s*(YES|NO)/i);
            const messageMatch = analysisText.match(/MESSAGE:\s*(.+)/s);
            
            const summary = summaryMatch?.[1]?.trim() || 'Analysis pending';
            const score = parseInt(scoreMatch?.[1] || '50', 10);
            const isPossibleClient = possibleMatch?.[1]?.toUpperCase() || (score >= 60 ? 'YES' : 'NO');
            const message = messageMatch?.[1]?.trim() || 'Message pending';
            
            // Buffer write data
            batchWriteBuffer.push({
              rowNumber,
              values: [summary, score.toString(), isPossibleClient, message],
            });
            
            // Perform batch write when buffer reaches size
            if (batchWriteBuffer.length >= BATCH_WRITE_SIZE) {
              await flushBatchWrites(batchWriteBuffer, spreadsheetId, accessToken, sheetName, newColumnStart);
              batchWriteBuffer.length = 0; // Clear buffer
            }
            
            return {
              success: true,
              rowNumber,
              companyName,
              score,
              isPossibleClient,
            };
            
          } catch (error: any) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
              console.log(`   ⏳ Retrying row ${rowNumber} (attempt ${attempt + 1}/${MAX_RETRIES})...`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            }
          }
        }
        
        // All retries failed
        console.error(`❌ Failed to process row ${rowNumber} after ${MAX_RETRIES} attempts`);
        return {
          success: false,
          rowNumber,
          companyName: 'Unknown',
          score: 0,
          isPossibleClient: 'NO',
          error: lastError?.message || 'Unknown error',
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate results
      for (const result of batchResults) {
        results.push(result);
        
        if (result.success) {
          successful++;
          totalScore += result.score;
          if (result.isPossibleClient === 'YES') {
            possibleClients++;
          }
        } else {
          failed++;
        }
      }
      
      // Progress update every batch
      console.log(`   ✅ Batch complete: ${successful + failed}/${totalRows} processed`);
      console.log(`   📈 Stats: ${successful} success, ${failed} failed, ${possibleClients} possible clients`);
      
      // Delay between batches
      if (i + BATCH_SIZE < rowNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Flush remaining writes
    if (batchWriteBuffer.length > 0) {
      await flushBatchWrites(batchWriteBuffer, spreadsheetId, accessToken, sheetName, newColumnStart);
    }
    
    const averageScore = successful > 0 ? Math.round(totalScore / successful) : 0;
    
    return {
      spreadsheetId,
      totalProcessed: totalRows,
      successful,
      failed,
      possibleClients,
      averageScore,
      results,
    };
  },
});

// Helper function for batch writes (PARALLEL for 10x performance)
async function flushBatchWrites(
  buffer: Array<{ rowNumber: number; values: any[] }>,
  spreadsheetId: string,
  accessToken: string,
  sheetName: string,
  newColumnStart: number
) {
  if (buffer.length === 0) return;
  
  console.log(`   💾 Writing ${buffer.length} rows to sheet in PARALLEL...`);
  
  // Write all rows in parallel for 10x performance boost
  const writePromises = buffer.map(async (item) => {
    const columnLetter = colIndexToA1(newColumnStart);
    const endColumnLetter = colIndexToA1(newColumnStart + 3);
    const writeRange = `${sheetName}!${columnLetter}${item.rowNumber}:${endColumnLetter}${item.rowNumber}`;
    
    try {
      await googleSheetsWriterTool.execute({
        context: {
          spreadsheetId,
          accessToken,
          range: writeRange,
          values: [item.values],
          mode: 'update' as const,
        },
      } as any);
      return { success: true, rowNumber: item.rowNumber };
    } catch (error: any) {
      console.error(`   ⚠️  Failed to write row ${item.rowNumber}: ${error.message}`);
      return { success: false, rowNumber: item.rowNumber };
    }
  });
  
  const results = await Promise.all(writePromises);
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`   ✅ Batch write complete: ${successful} success, ${failed} failed`);
}

// Step 5: Generate Final Summary
const generateSummaryStep = createStep({
  id: 'generate-summary',
  description: 'Generate comprehensive final summary with insights',
  inputSchema: z.object({
    spreadsheetId: z.string(),
    totalProcessed: z.number(),
    successful: z.number(),
    failed: z.number(),
    possibleClients: z.number(),
    averageScore: z.number(),
    results: z.array(z.object({
      rowNumber: z.number(),
      companyName: z.string(),
      score: z.number(),
      isPossibleClient: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    summary: z.string(),
    totalProcessed: z.number(),
    successful: z.number(),
    failed: z.number(),
    possibleClients: z.number(),
    averageScore: z.number(),
    conversionRate: z.number(),
    topLeads: z.array(z.object({
      companyName: z.string(),
      score: z.number(),
      rowNumber: z.number(),
    })),
    spreadsheetUrl: z.string(),
    errorReport: z.array(z.object({
      rowNumber: z.number(),
      companyName: z.string(),
      error: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { spreadsheetId, totalProcessed, successful, failed, possibleClients, averageScore, results } = inputData;
    
    const conversionRate = totalProcessed > 0 ? Math.round((possibleClients / totalProcessed) * 100) : 0;
    
    // Top 10 leads by score
    const topLeads = results
      .filter(r => r.success)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(r => ({
        companyName: r.companyName,
        score: r.score,
        rowNumber: r.rowNumber,
      }));
    
    // Error report
    const errorReport = results
      .filter(r => !r.success)
      .map(r => ({
        rowNumber: r.rowNumber,
        companyName: r.companyName,
        error: r.error || 'Unknown error',
      }));
    
    const summary = `✅ Lead Research Workflow Complete!

📊 **Processing Summary:**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Total Leads Processed: ${totalProcessed}
  • Successful: ${successful} ✓
  • Failed: ${failed} ✗
  • Possible Clients: ${possibleClients} 🎯
  • Conversion Rate: ${conversionRate}%
  • Average Lead Score: ${averageScore}/100

🏆 **Top 10 Leads** (by score):
${topLeads.map((l, i) => `  ${i + 1}. ${l.companyName} - Score: ${l.score}/100 (Row ${l.rowNumber})`).join('\n')}

${errorReport.length > 0 ? `\n⚠️  **Errors** (${errorReport.length} leads):\n${errorReport.slice(0, 5).map(e => `  • Row ${e.rowNumber}: ${e.companyName} - ${e.error}`).join('\n')}${errorReport.length > 5 ? `\n  ... and ${errorReport.length - 5} more` : ''}` : ''}

🔗 **View Updated Sheet:**
   https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

✨ Next Steps:
   1. Review top leads in the sheet
   2. Filter leads by score (e.g., >= 70)
   3. Ready to send personalized emails? (Coming in Email Dispatch Workflow)
`;

    return {
      summary,
      totalProcessed,
      successful,
      failed,
      possibleClients,
      averageScore,
      conversionRate,
      topLeads,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      errorReport,
    };
  },
});

// Main Workflow
export const leadResearchWorkflow = createWorkflow({
  id: 'lead-research-workflow',
  description: 'Production-ready SDR workflow with suspend/resume, progress tracking, scoring, and batch writes',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('Google Sheet ID or full URL'),
    accessToken: z.string().describe('OAuth access token from Google authentication'),
    productDescription: z.string().optional().describe('Optional description of the product being sold'),
  }),
  outputSchema: z.object({
    summary: z.string(),
    totalProcessed: z.number(),
    successful: z.number(),
    failed: z.number(),
    possibleClients: z.number(),
    averageScore: z.number(),
    conversionRate: z.number(),
    topLeads: z.array(z.object({
      companyName: z.string(),
      score: z.number(),
      rowNumber: z.number(),
    })),
    spreadsheetUrl: z.string(),
    errorReport: z.array(z.object({
      rowNumber: z.number(),
      companyName: z.string(),
      error: z.string(),
    })),
  }),
})
  .then(validateConnectionStep)
  .then(exploreStructureStep)
  .then(createResearchPlanStep)
  .then(processLeadsStep)
  .then(generateSummaryStep)
  .commit();
