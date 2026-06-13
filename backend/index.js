import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const app = express();
const port = process.env.PORT || 4002;
const defaultModel = process.env.OPENAI_MODEL || "gpt-5.5";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

const modes = {
  general:
    "You are SOR AI, a polished, practical assistant. Give direct answers, ask only necessary questions, and format clearly.",
  qa:
    "You are SOR AI in question-and-answer mode. Answer the user's question directly first, then add helpful context, examples, or next steps. If the question is unclear, state the best assumption and continue.",
  code:
    "You are SOR AI in developer mode. Prioritize correct, runnable code, explain tradeoffs briefly, and call out assumptions.",
  study:
    "You are SOR AI in study mode. Teach with structure, examples, checks for understanding, and concise summaries.",
  creative:
    "You are SOR AI in creative mode. Generate vivid options, refine ideas, and keep outputs usable rather than vague.",
  writing:
    "You are SOR AI in writing mode. Help draft, rewrite, expand, shorten, translate, and polish content. Preserve the user's intent, improve clarity, and offer finished text first.",
};

const languages = {
  auto: "Detect the user's language and reply in that same language. If the user mixes languages, mirror the mix naturally.",
  en: "Reply in English.",
  hi: "Reply in Hindi using Devanagari script. If technical terms are clearer in English, keep those terms in English.",
  hinglish: "Reply in natural Hinglish, mixing Hindi and English the way Indian developers commonly speak.",
  gu: "Reply in Gujarati.",
  mr: "Reply in Marathi.",
  ta: "Reply in Tamil.",
  te: "Reply in Telugu.",
  bn: "Reply in Bengali.",
  es: "Reply in Spanish.",
  fr: "Reply in French.",
  ar: "Reply in Arabic.",
};

const safeReasoning = new Set(["minimal", "low", "medium", "high"]);

function buildInstructions({ mode = "general", systemPrompt = "", tone = "balanced", language = "auto" }) {
  const base = modes[mode] || modes.general;
  const toneLine = `Tone target: ${tone}. Be helpful, accurate, and concise unless the user asks for depth.`;
  const languageLine = languages[language] || languages.auto;
  const custom = String(systemPrompt || "").trim();
  return [base, languageLine, toneLine, custom].filter(Boolean).join("\n\n");
}

function normalizeMessages(messages = []) {
  return messages
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .slice(-24)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 12000),
    }));
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamDemoResponse(res, settings) {
  const demo = [
    "I am wired and ready, but the backend does not have `OPENAI_API_KEY` yet.",
    "",
    "Add your key in `backend/.env`, restart the server, and this same interface will stream real AI responses through the OpenAI Responses API.",
    "",
    "What is already built here:",
    "- streaming chat UI",
    "- ChatGPT-style question and answer conversation flow",
    "- multiple assistant modes",
    "- Hindi, English, Hinglish, and more language controls",
    "- reasoning effort control",
    "- virtual avatar UI state",
    "- writing assistant mode and draft tool",
    "- local conversation history",
    "- export, copy, regenerate, search, and prompt tools",
    "",
    `Selected model: ${settings.model || defaultModel}`,
  ].join("\n");

  for (const token of demo.split(/(\s+)/)) {
    sendEvent(res, "delta", { text: token });
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
  sendEvent(res, "done", { ok: true, demo: true });
  res.end();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    defaultModel,
  });
});

app.post("/api/chat", async (req, res) => {
  const settings = req.body?.settings || {};
  const messages = normalizeMessages(req.body?.messages);
  const lastMessage = messages.at(-1);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content.trim()) {
    sendEvent(res, "error", { message: "Send a message before asking the assistant to respond." });
    return res.end();
  }

  if (!process.env.OPENAI_API_KEY) {
    return streamDemoResponse(res, settings);
  }

  try {
    const payload = {
      model: settings.model || defaultModel,
      instructions: buildInstructions(settings),
      input: messages,
      stream: true,
    };

    if (safeReasoning.has(settings.reasoningEffort)) {
      payload.reasoning = { effort: settings.reasoningEffort };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      sendEvent(res, "error", {
        message: "OpenAI request failed.",
        detail: errorText.slice(0, 1000),
      });
      return res.end();
    }

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const dataLine = block
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!dataLine) continue;
        const raw = dataLine.replace(/^data:\s*/, "");
        if (raw === "[DONE]") continue;

        const event = JSON.parse(raw);
        if (event.type === "response.output_text.delta") {
          sendEvent(res, "delta", { text: event.delta || "" });
        }
        if (event.type === "response.refusal.delta") {
          sendEvent(res, "delta", { text: event.delta || "" });
        }
        if (event.type === "response.completed") {
          sendEvent(res, "done", { ok: true });
        }
        if (event.type === "response.error") {
          sendEvent(res, "error", { message: event.error?.message || "The model returned an error." });
        }
      }
    }
  } catch (error) {
    sendEvent(res, "error", {
      message: "Could not reach the AI service.",
      detail: error.message,
    });
  } finally {
    res.end();
  }
});

app.post("/api/prompt-tools", (req, res) => {
  const text = String(req.body?.text || "").trim();
  const tool = String(req.body?.tool || "improve");

  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }

  const outputs = {
    improve: `Rewrite this into a precise, high-quality prompt. Preserve my intent, add missing context, define the output format, and ask clarifying questions only if needed:\n\n${text}`,
    ask: `Turn this into one clear ChatGPT-style question. Keep the user's intent, add useful context, and make it easy for an AI assistant to answer well:\n\n${text}`,
    plan: `Create a practical execution plan for this request. Include assumptions, milestones, risks, and the first concrete action:\n\n${text}`,
    explain: `Explain this clearly for a smart beginner, then give one advanced note and one example:\n\n${text}`,
    write: `Write a polished finished draft from this idea. Choose the best structure, improve wording, keep it natural, and include a short subject/title if useful:\n\n${text}`,
  };

  res.json({ text: outputs[tool] || outputs.improve });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

if (process.argv[1] === __filename) {
  app.listen(port, () => {
    console.log(`SOR AI server running on http://localhost:${port}`);
  });
}
