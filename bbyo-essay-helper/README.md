# Shofar Reader — BBYO Essay Feedback (prototype)

A web page that reads a teen's BBYO college essay and the prompt they're
answering, then returns specific, honest feedback on where to dig deeper. It
never writes for the teen. It only asks the questions that pull more out of them.

This prototype runs on the **free Gemini API tier** so it costs nothing to
demo. The architecture is built so the upgrade to a paid model at launch is a
one-line change.

---

## How it's wired (read this once)

The page never talks to Gemini directly. If it did, your API key would be
visible to anyone who opened browser dev tools. Instead:

```
browser (index.html)  ->  /api/review.js (server, holds the key)  ->  Gemini
```

The key lives only as a server environment variable. The browser never sees it.
This is also why upgrading to a paid key later changes nothing in the page.

```
.
├── index.html            the page
├── lib/systemPrompt.js   THE PROMPT. edit this to change behavior.
├── api/review.js         the proxy. holds the key. calls the model.
├── package.json
└── .gitignore
```

---

## Deploy in ~10 minutes (Vercel, free)

### 1. Get a free Gemini API key
Go to **aistudio.google.com**, sign in, and create an API key. No credit card.
Copy it somewhere safe for a moment. Treat it like a password.

### 2. Put this folder on GitHub
Create a new repo and push these files. (If you'd rather skip GitHub for a quick
first test, see "60-second alternative" below.)

### 3. Import the repo into Vercel
- Go to **vercel.com**, sign in with GitHub, click **Add New > Project**.
- Pick this repo and click **Import**. Leave all build settings as their
  defaults (there is no build step, it's a static page plus a function).

### 4. Add your key as an environment variable
- Before (or right after) the first deploy, open the project's
  **Settings > Environment Variables**.
- Add one variable:
  - **Name:** `GEMINI_API_KEY`
  - **Value:** the key you copied in step 1
- Save. If you added it after the first deploy, hit **Redeploy** so it takes
  effect.

### 5. Done
Vercel gives you a URL like `your-project.vercel.app`. That's the link you
share. Open it, paste an essay and a prompt, and you'll get feedback.

### 60-second alternative (no GitHub)
In this folder, run:
```
npm i -g vercel
vercel
```
Follow the prompts. Then set the key with:
```
vercel env add GEMINI_API_KEY
```
and redeploy with `vercel --prod`.

---

## Tuning the feedback

Everything about how the reviewer behaves lives in **`lib/systemPrompt.js`**.
That file is the actual product. Open it and you'll find:
- the reviewer persona,
- the topic gate (BBYO-only),
- the eight "lenses" it reads through,
- the hard rule that it never writes for the teen,
- a BBYO glossary,
- a placeholder where you should paste 2-4 of the strongest Shofar excerpts.

Adding those real Shofar examples is the single highest-leverage improvement
you can make. It shows the model what "good" looks like.

After editing, push to GitHub (Vercel auto-redeploys) or run `vercel --prod`.

---

## Two things to be honest about while testing

**Rate limits.** The free tier allows only a few requests per minute and on the
order of 100 per day. That's plenty for a live demo or quiet testing. It is NOT
enough to open to a whole chapter at once. If a few dozen people hammer it the
same day, everyone starts seeing "rate limit reached." That's expected on free,
and it's exactly what the paid upgrade fixes.

**Privacy.** On the free tier, Google may use submitted text to improve their
models. Fine for sample essays and volunteer testers. For real teens' real
essays at launch, move to the paid tier, where that doesn't happen.

---

## Upgrading for launch

**Cheapest path, stay on Gemini.** Move your API key to a paid tier in Google AI
Studio. No code change at all. Rate limits jump and the training-on-your-data
concern goes away.

**Switch to Claude or GPT instead.** Only the fetch block in `api/review.js`
changes, because each provider's request shape differs. Your system prompt in
`lib/systemPrompt.js` is model-agnostic and stays exactly as it is.

---

## Known gotchas

- **Model name.** `api/review.js` has `GEMINI_MODEL = "gemini-2.5-pro"` near the
  top. If Google renames the free model, change that one line. Verify the
  current name in AI Studio.
- **Empty or weird output.** The proxy parses the model's JSON defensively and
  falls back to showing raw text, so you never lose a response. If you see raw
  text instead of nice cards, the model didn't return clean JSON that round.
  Resubmitting usually fixes it.
- **"Server is missing GEMINI_API_KEY."** You haven't set the env var, or you
  set it but didn't redeploy.
