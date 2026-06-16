// ============================================================================
//  THE PROXY  (api/review.js)
//
//  This runs on the server, never in the browser. It is the only place your
//  API key ever exists. The page sends it an essay, it calls Gemini with your
//  secret key, and it sends the feedback back. The browser never sees the key.
//
//  TO UPGRADE FOR LAUNCH you change almost nothing here. Either:
//    (a) bump your Gemini key to a paid tier (no code change at all), or
//    (b) point this at Claude or GPT instead (rewrite only the fetch block
//        below, since the request shape differs between providers). Your
//        system prompt in lib/systemPrompt.js stays exactly the same.
// ============================================================================

import { SYSTEM_PROMPT } from "../lib/systemPrompt.js";

// VERIFY THIS in Google AI Studio. As of now the most capable free model is
// gemini-2.5-pro. If Google renames it, change this one line.
const GEMINI_MODEL = "gemini-2.5-flash";

const MAX_ESSAY_CHARS = 15000;   // a college essay is ~4000 chars. generous headroom, blocks abuse.
const MAX_PROMPT_CHARS = 3000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing GEMINI_API_KEY. Set it in your host's environment variables.",
    });
  }

  // Vercel auto-parses JSON bodies, but guard in case it arrives as a string.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const essay = (body?.essay || "").trim();
  const prompt = (body?.prompt || "").trim();

  if (!essay) {
    return res.status(400).json({ error: "Paste your essay before submitting." });
  }
  if (!prompt) {
    return res.status(400).json({ error: "Add the essay prompt you are answering." });
  }
  if (essay.length > MAX_ESSAY_CHARS) {
    return res.status(400).json({ error: "That essay is longer than this tool accepts." });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({ error: "That prompt is longer than expected." });
  }

  // Clearly delimit the two inputs so essay text is never mistaken for instructions.
  const userTurn =
    "Here is the essay prompt the writer is answering:\n" +
    "<<<PROMPT\n" + prompt + "\nPROMPT>>>\n\n" +
    "Here is the writer's essay:\n" +
    "<<<ESSAY\n" + essay + "\nESSAY>>>\n\n" +
    "Review it according to your instructions and respond with the JSON object only.";

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL +
    ":generateContent?key=" +
    apiKey;

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userTurn }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
      responseMimeType: "application/json", // JSON mode. reliable on 2.5 Pro.
    },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!r.ok) {
      // Surface rate limits clearly so the page can tell the user to wait.
      if (r.status === 429) {
        return res.status(429).json({
          error: "Rate limit reached. The free tier allows only a few requests per minute. Wait about a minute and try again.",
        });
      }
      const detail = await r.text();
      return res.status(502).json({
        error: "The model service returned an error.",
        status: r.status,
        detail: detail.slice(0, 500),
      });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(502).json({ error: "The model returned an empty response. Try again." });
    }

    // In JSON mode this should already be clean JSON, but parse defensively and
    // strip any stray code fences just in case.
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return res.status(200).json({ ok: true, result: parsed });
    } catch {
      // Never lose the model's output. Hand back the raw text if parsing fails.
      return res.status(200).json({ ok: true, raw: cleaned });
    }
  } catch (err) {
    return res.status(500).json({ error: "Could not reach the model service.", detail: String(err) });
  }
}
