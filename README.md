# AI Chatbot

A smooth AI chatbot with a 3D TalkingHead avatar. The user types a message, Gemini generates a reply, and Nova speaks the answer out loud with avatar animation.

## Features

- 3D avatar powered by `met4citizen/TalkingHead`
- Gemini text responses
- Gemini text-to-speech audio
- Homepage, About page, Login demo, and Chat page
- Enter-to-send chat input
- In-chat API key button for local demo use
- Chat and API key reset on refresh/reopen

## Important Security Note

This project is designed as a local/demo app.

Do not enter private API keys into a deployed public frontend. For production, move API key handling to the backend and read it from environment variables such as `.env`.

## Run Locally

Make sure you have Node.js 18 or newer installed.

```bash
cd "/Users/divyakunder/Documents/Codex/2026-05-30/AI Chatbot"
npm run dev
```

Open:

```text
http://localhost:3000
```

## Using The App

1. Go to the Chat page.
2. Click the **API key** button.
3. Paste your Google AI Studio Gemini API key.
4. Click **Save**.
5. Send a message to Nova.

The API key is kept only for the current page session. If you refresh or reopen the app, you need to enter it again.

## Get A Gemini API Key

Create a key from Google AI Studio:

```text
https://aistudio.google.com/apikey
```

Gemini API keys usually start with `AIza`.

## Project Structure

```text
AI Chatbot/
  public/
    index.html
    styles.css
    app.js
  server.js
  package.json
  README.md
```

## GitHub Safety

This repo should not include:

- `.env`
- real API keys
- `node_modules`

Before pushing, you can check:

```bash
find . -name ".env*" -print
git status
```

## Scripts

```bash
npm run dev
npm start
```
