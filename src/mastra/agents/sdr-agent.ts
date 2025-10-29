import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { sdrSystemPrompt } from './prompts/sdr-system-prompt';
import { sdrWorkingMemoryTemplate } from './prompts/sdr-working-memory-template';
import { googleSheetsReaderTool } from '../tools/google-sheets-reader';
import { googleSheetsWriterTool } from '../tools/google-sheets-writer';
import { gmailSenderTool } from '../tools/gmail-sender';
import { googleOAuthTool } from '../tools/google-oauth-tool';
import { tavilyMcp } from '../mcp/tavily-mcp';

/**
 * SDR Agent Configuration
 * 
 * Elite Sales Development Representative agent specialized in:
 * - Lead qualification and analysis from Google Sheets
 * - Comprehensive web research using Tavily
 * - Personalized outreach message generation
 * - Bulk email campaigns via Gmail or Resend
 */

export const sdrMemory = new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: 'thread',
      template: sdrWorkingMemoryTemplate,
    },
    threads: {
      generateTitle: true,
    },
  },
});

export const sdrAgent = new Agent({
  name: 'sdr-agent',
  id: 'sdr-agent',
  description: 'Sales Development Representative agent specialized in lead analysis and personalized sales communication',
  instructions: sdrSystemPrompt,
  model: openai('gpt-5-mini'),
  memory: sdrMemory,
  tools: {
    googleOAuthTool,
    googleSheetsReaderTool,
    googleSheetsWriterTool,
    gmailSenderTool,
    ...(await tavilyMcp.getTools()),
  },
  defaultGenerateOptions: {
    maxSteps: 10,
    temperature: 0.7,
  },
});
