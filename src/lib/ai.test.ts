import { describe, it, expect } from "vitest";
import { toGeminiRequest } from "./ai";

describe("toGeminiRequest", () => {
  it("moves system messages into systemInstruction and maps roles", () => {
    const req = toGeminiRequest([
      { role: "system", content: "You are LifeFlow AI." },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "what's due today?" },
    ]);
    expect(req.systemInstruction).toEqual({ parts: [{ text: "You are LifeFlow AI." }] });
    expect(req.contents).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
      { role: "user", parts: [{ text: "what's due today?" }] },
    ]);
  });

  it("joins multiple system messages and omits systemInstruction when there are none", () => {
    const joined = toGeminiRequest([
      { role: "system", content: "A" },
      { role: "system", content: "B" },
      { role: "user", content: "hi" },
    ]);
    expect(joined.systemInstruction).toEqual({ parts: [{ text: "A\n\nB" }] });

    const none = toGeminiRequest([{ role: "user", content: "hi" }]);
    expect(none.systemInstruction).toBeUndefined();
    expect(none.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });
});
