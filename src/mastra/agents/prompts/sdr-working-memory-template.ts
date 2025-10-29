/**
 * SDR Agent - MVP Working Memory Template
 * Context storage with OAuth token tracking
 */

export const sdrWorkingMemoryTemplate = `# SDR Agent - Session Context

## Google Authentication
- **Access Token**: [OAuth access token - store here when user provides it]
- **Token Status**: [Not authenticated / Authenticated]
- **Last Auth Date**: [Timestamp]

## Active Sheet
- **Sheet URL**: [Last accessed Google Sheet]
- **Last Action**: [What was done with the sheet]
- **Rows Processed**: [Number of rows read/processed]

## Email Configuration
- **Service**: Resend API
- **From Address**: [Configured sender email]
- **Emails Sent Today**: [Counter]
- **Last Email Sent**: [Timestamp and recipient]

## Quick Notes
- [Any important session information]

---
Last Updated: [Timestamp]`;
