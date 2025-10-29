# Google OAuth Setup Guide

This guide explains how to set up Google OAuth for the SDR Agent to access Google Sheets and Gmail.

## 🎯 Overview

The SDR Agent uses OAuth 2.0 to authenticate with Google services. This is a one-time setup that allows the agent to:
- Read data from Google Sheets
- Send emails via Gmail (future feature)

## 📋 Prerequisites

- A Google Account
- Access to Google Cloud Console

## 🚀 Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name (e.g., "SDR Agent")
4. Click **"Create"**

### 2. Enable Required APIs

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search and enable the following APIs:
   - **Google Sheets API**
   - **Gmail API** (for future email features)

### 3. Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (unless you have a Google Workspace)
3. Fill in the required information:
   - **App name**: SDR Agent
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **"Save and Continue"**
5. **Scopes**: Click **"Add or Remove Scopes"**, add:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/gmail.send`
6. Click **"Save and Continue"**
7. **Test users**: Add your email address
8. Click **"Save and Continue"**

### 4. Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Choose **"Web application"**
4. Configure:
   - **Name**: SDR Agent OAuth Client
   - **Authorized redirect URIs**: Add these URLs:
     ```
     http://localhost:4111/auth/google/callback
     http://127.0.0.1:4111/auth/google/callback
     ```
   - For production, add your production URL
5. Click **"Create"**
6. **IMPORTANT**: Copy your **Client ID** and **Client Secret**

### 5. Update Environment Variables

Add the credentials to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id_from_step_4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_4
GOOGLE_REDIRECT_URI=http://localhost:4111/auth/google/callback
```

## 🎬 Using OAuth in the Agent

### First-Time Authentication

1. Start a conversation with the SDR Agent
2. When you ask to access a Google Sheet, the agent will:
   - Generate an OAuth link using the `google-oauth` tool
   - Provide you with a link to click
3. Click the link and authorize the application
4. After authorization, you'll see a success page with an **access token**
5. Copy the access token and paste it back to the agent:
   ```
   "My access token is: ya29.a0AfH6SM..."
   ```
6. The agent stores the token and uses it automatically for all future requests

### OAuth Flow Diagram

```
User asks for sheet data
        ↓
Agent checks for access token
        ↓
    No token? → Generate OAuth link → User clicks → Authorizes → Gets token → Pastes to agent
        ↓
    Has token? → Use it to read Google Sheets
        ↓
    Return data to user
```

## 🔒 Security Notes

- **Access tokens** are temporary (typically 1 hour)
- **Refresh tokens** can be used to get new access tokens (future feature)
- Tokens are stored in the conversation's working memory (thread-scoped)
- Never commit tokens to version control
- For production, consider implementing refresh token rotation

## 🧪 Testing the Setup

1. Start your Mastra server:
   ```bash
   pnpm run dev
   ```

2. Open the Playground: http://localhost:4111/

3. Select `sdr-agent`

4. Send a message:
   ```
   I want to read data from my Google Sheet
   ```

5. The agent should:
   - Detect no authentication
   - Generate an OAuth link
   - Ask you to authorize

6. Follow the link, authorize, and paste the token back

7. Now try accessing a sheet:
   ```
   Read this sheet: [paste your Google Sheet URL]
   ```

## 🐛 Troubleshooting

### "OAuth credentials not configured"
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in your `.env` file
- Restart your Mastra server after adding them

### "Redirect URI mismatch"
- Ensure the redirect URI in Google Cloud Console matches exactly:
  - `http://localhost:4111/auth/google/callback`
- Check for trailing slashes or http vs https

### "Access blocked: This app's request is invalid"
- Make sure you added your email as a test user in the OAuth consent screen
- Ensure the required APIs (Sheets, Gmail) are enabled

### "Invalid grant" or "Token expired"
- The access token has expired (they last ~1 hour)
- Request a new OAuth link from the agent
- (Future) Implement refresh token flow for longer sessions

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Gmail API Documentation](https://developers.google.com/gmail/api)

## 🎉 Next Steps

Once OAuth is set up:
- ✅ Read Google Sheets
- ✅ Send emails via Resend
- 🔜 Implement refresh token flow
- 🔜 Add Gmail sender (alternative to Resend)
- 🔜 Web search integration with Tavily

