import type { ChatMessage } from "@/lib/ollama";

// Multi-provider chat with automatic fallback. Gemini is the primary (fast,
// reliable, non-reasoning); Groq is the fallback when Gemini is unconfigured,
// errors, or returns empty. All calls are non-streaming and time-bounded so a
// stalled provider can never hang the request to its serverless timeout.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 30000;
const MAX_OUTPUT_TOKENS = 1024;

export function isGeminiConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}

interface GeminiRequest {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
}

// Map our chat messages onto Gemini's shape: system messages become a single
// systemInstruction; user -> "user", assistant -> "model".
export function toGeminiRequest(messages: ChatMessage[]): GeminiRequest {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
  };
}

async function geminiComplete(messages: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...toGeminiRequest(messages),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p.text ?? "").join("")
    : "";
}

export interface AiReply {
  text: string;
  provider: "gemini" | "groq";
}

// Generate a reply, trying Gemini first and falling back to Groq. `groqModel`
// is the model to use if the Groq fallback runs.
export async function generateReply(
  messages: ChatMessage[],
  groqModel: string
): Promise<AiReply> {
  if (isGeminiConfigured()) {
    try {
      const text = await geminiComplete(messages);
      if (text.trim()) return { text, provider: "gemini" };
      console.warn("[AI] Gemini returned empty; falling back to Groq");
    } catch (err) {
      console.error("[AI] Gemini failed; falling back to Groq:", err);
    }
  }
  // Lazy import so this module (and its pure helpers) stay importable without
  // pulling in the Prisma/db graph that ollama.ts loads.
  const { chatComplete } = await import("@/lib/ollama");
  const text = await chatComplete(groqModel, messages);
  return { text, provider: "groq" };
}
