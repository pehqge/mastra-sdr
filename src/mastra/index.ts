import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { sdrAgent } from './agents/sdr-agent';
import { 
  googleOAuthStartRoute, 
  googleOAuthCallbackRoute 
} from './auth/google-oauth-routes';
import { leadResearchWorkflow } from './workflows/lead-research-workflow';
import { emailDispatchWorkflow } from './workflows/email-dispatch-workflow';
import { oauthSetupWorkflow } from './workflows/oauth-setup-workflow';

export const mastra = new Mastra({
  agents: { sdrAgent },
  workflows: { 
    oauthSetupWorkflow,
    leadResearchWorkflow,
    emailDispatchWorkflow,
  },
  storage: new LibSQLStore({
    url: process.env.DATABASE_URL || 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: true },
  },
  server: {
    apiRoutes: [
      googleOAuthStartRoute,
      googleOAuthCallbackRoute,
    ],
  },
});
