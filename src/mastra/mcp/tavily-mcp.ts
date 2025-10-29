import { MCPClient } from '@mastra/mcp';

/**
 * Tavily MCP Client
 * 
 * Connects to Tavily's remote MCP server for web search capabilities.
 * Provides access to search tools for finding information on the internet.
 */

export const tavilyMcp = new MCPClient({
  id: 'tavily-search',
  servers: {
    tavily: {
      url: new URL(`https://mcp.tavily.com/mcp/?tavilyApiKey=${process.env.TAVILY_API_KEY}`),
    },
  },
  timeout: 30000, // 30 second timeout for web searches
});

