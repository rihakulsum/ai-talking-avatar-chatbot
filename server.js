import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        keyMode: "browser"
      });
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong on the server." });
  }
}).listen(port, () => {
  console.log(`Gemini TalkingHead chatbot running at http://localhost:${port}`);
});

async function handleChat(req, res) {
  const body = await readJson(req);
  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
  const apiKey = String(req.headers["x-gemini-api-key"] || body.apiKey || "").trim();

  if (!message) {
    sendJson(res, 400, { error: "Please send a message first." });
    return;
  }

  if (!apiKey || apiKey.includes("put_your")) {
    sendJson(res, 400, {
      error: "Paste your Gemini API key in the key box, save it, then send your message again."
    });
    return;
  }

  if (!keyLooksLikeGeminiApiKey(apiKey)) {
    sendJson(res, 400, {
      error: `That key does not look like a Google AI Studio Gemini API key. It starts with "${apiKey.slice(0, 6)}...", but Gemini API keys usually start with "AIza".`
    });
    return;
  }

  try {
    const reply = await generateReply(apiKey, message, history);
    const audio = await generateSpeech(apiKey, reply);

    sendJson(res, 200, {
      reply,
      audio,
      words: makeWordTimings(reply, audio.durationMs)
    });
  } catch (error) {
    sendJson(res, 502, {
      error: `Gemini could not complete the request: ${error.message}`
    });
  }
}

async function generateReply(apiKey, message, history) {
  const contents = history
    .filter((item) => item && item.role && item.text)
    .map((item) => ({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: String(item.text).slice(0, 500) }]
    }));

  contents.push({ role: "user", parts: [{ text: message }] });

  const data = await geminiFetch(apiKey, "gemini-2.5-flash-lite", {
    systemInstruction: {
      parts: [
        {
          text: "You are Nova, a warm, concise avatar assistant. Answer in 1-3 short sentences unless the user asks for detail. For simple math, answer directly. Avoid markdown tables. Be natural and easy to listen to aloud."
        }
      ]
    },
    contents,
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 180
    }
  });

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  return text || "I am here, but I could not form a response. Try asking that another way.";
}

async function generateSpeech(apiKey, text) {
  const speakableText = text.replace(/\s+/g, " ").slice(0, 900);
  const data = await geminiFetch(apiKey, "gemini-2.5-flash-preview-tts", {
    contents: [
      {
        parts: [
          {
            text: `Read this in a clear, friendly, conversational voice with natural pauses: ${speakableText}`
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore"
          }
        }
      }
    }
  });

  const inline = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) {
    throw new Error("Gemini did not return speech audio.");
  }

  const sampleRate = sampleRateFromMime(inline.mimeType) || 24000;
  const pcm = Buffer.from(inline.data, "base64");
  const wav = pcmToWav(pcm, sampleRate);

  return {
    mimeType: "audio/wav",
    data: wav.toString("base64"),
    durationMs: Math.round((pcm.length / 2 / sampleRate) * 1000)
  };
}

async function geminiFetch(apiKey, model, payload) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

function makeWordTimings(text, durationMs) {
  const words = text
    .replace(/[^\p{L}\p{N}' -]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 220);

  if (!words.length) {
    return { words: [], wtimes: [], wdurations: [] };
  }

  const usableDuration = Math.max(durationMs - 300, words.length * 180);
  const totalWeight = words.reduce((sum, word) => sum + Math.max(1, word.length / 5), 0);
  let cursor = 120;

  const wtimes = [];
  const wdurations = words.map((word) => {
    const duration = Math.max(110, Math.round((Math.max(1, word.length / 5) / totalWeight) * usableDuration));
    wtimes.push(cursor);
    cursor += duration;
    return duration;
  });

  return { words, wtimes, wdurations };
}

function sampleRateFromMime(mimeType = "") {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function keyLooksLikeGeminiApiKey(key = "") {
  return key.startsWith("AIza") && key.length >= 30 && !/\s/.test(key);
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  const byteRate = sampleRate * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

async function serveStatic(pathname, res) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, "public", safePath === "/" ? "index.html" : safePath);
  const fallbackPath = join(root, "public", "index.html");
  const target = existsSync(filePath) ? filePath : fallbackPath;
  const data = await readFile(target);
  res.writeHead(200, {
    "content-type": mimeTypes[extname(target)] || "application/octet-stream"
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 12000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
