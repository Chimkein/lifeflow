"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  WifiOff,
  User,
  Sparkles,
  Square,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages?: { content: string; role: string }[];
}

export default function AIPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      setOllamaOnline(data.available);
    })();
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai/conversations");
    const data = await res.json();
    setConversations(data);
  }, []);

  useEffect(() => {
    // Inlined (rather than calling loadConversations directly) so the
    // setState call is wrapped in its own async scope, matching the
    // pattern above — satisfies react-hooks/set-state-in-effect.
    (async () => {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      setConversations(data);
    })();
  }, []);

  const loadConversation = async (id: string) => {
    setActiveConvId(id);
    const res = await fetch(`/api/ai/conversations/${id}`);
    const data = await res.json();
    setMessages(
      data.messages.map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    textareaRef.current?.focus();
  };

  const handleDeleteConversation = async (id: string) => {
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    loadConversations();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: activeConvId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI unavailable" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${err.error}` }
              : m
          )
        );
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data: {
            conversationId?: string;
            token?: string;
            done?: boolean;
            error?: string;
          };
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (data.conversationId && !activeConvId) {
            setActiveConvId(data.conversationId);
          }

          if (data.token) {
            receivedContent = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + data.token }
                  : m
              )
            );
          }

          if (data.done) {
            loadConversations();
          }

          if (data.error) {
            receivedContent = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content || `Error: ${data.error}` }
                  : m
              )
            );
          }
        }
      }

      if (!receivedContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "No response from AI. Please try again." }
              : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "Failed to connect to AI. Please try again." }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (ollamaOnline === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">AI is not available</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The AI assistant is currently unavailable. Check that the Groq API key is configured.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={async () => {
            const res = await fetch("/api/ai/status");
            const data = await res.json();
            setOllamaOnline(data.available);
          }}
        >
          Retry connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div className="flex w-64 shrink-0 flex-col">
          <Button
            size="sm"
            className="mb-3 w-full gap-2"
            onClick={handleNewConversation}
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => loadConversation(conv.id)}
                onKeyDown={(e) => { if (e.key === "Enter") loadConversation(conv.id); }}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  activeConvId === conv.id
                    ? "bg-gold/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No conversations yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Toggle sidebar on mobile */}
        <div className="mb-2 flex items-center gap-2 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15">
              <Sparkles className="h-8 w-8 text-gold" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">LifeFlow AI</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Ask about your tasks, schedule, or notes. I have context about
              your day and can help you prioritize and plan.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                "What should I focus on today?",
                "Summarize my open tasks",
                "Do I have any urgent deadlines?",
                "What did I work on recently?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-gold/30 hover:bg-gold/5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto rounded-xl">
            <div className="mx-auto max-w-3xl space-y-4 p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                      <Bot className="h-4 w-4 text-gold" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted/50"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.content && streaming ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input */}
        <div className="mx-auto w-full max-w-3xl pt-3">
          <Card className="flex items-end gap-2 border-none bg-muted/50 p-3 shadow-sm">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask LifeFlow anything..."
              className="min-h-[44px] max-h-[120px] flex-1 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={streaming ? handleStop : handleSend}
              disabled={!streaming && !input.trim()}
              title={streaming ? "Stop" : "Send"}
            >
              {streaming ? (
                <Square className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </Card>
          <p className="mt-2 pb-1 text-center text-[10px] text-muted-foreground/50">
            Powered by Groq AI
          </p>
        </div>
      </div>
    </div>
  );
}
