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
![Screenshot 2026-10-08 at 8 55 13 PM](https://github.com/user-attachments/assets/530bfd9f-d178-4879-bae3-10648fb61862)
<img width="1470" height="956" alt="Screenshot 2026-10-08 at 8 59 25 PM" src="https://github.com/user-attachments/assets/e0975f23-7c05-46af-b158-bddcf163c326" />
<img width="1470" height="956" alt="Screenshot 2026-10-08 at 8 55 27 PM" src="https://github.com/user-attachments/assets/a003944b-c17a-4d07-924f-c93028da62fa" />
<img width="1470" height="956" alt="Screenshot 2026-10-08 at 8 59 08 PM" src="https://github.com/user-attachments/assets/105cf478-b1b3-4651-b997-544f56cef281" />
<img width="1470" height="956" alt="Screenshot 2026-10-08 at 8 57 47 PM" src="https://github.com/user-attachments/assets/0d374fe8-19e2-446d-a6ac-ad22c0b29287" />
<img width="1470" height="956" alt="Screenshot 2026-10-08 at 8 57 39 PM" src="https://github.com/user-attachments/assets/a3972a66-1fbc-4506-abb3-3ffe58b57ac3" />


