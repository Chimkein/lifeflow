"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Link2, Unlink, Clock, Bell, BellOff, Bot, Cpu, Sparkles, Mail, RefreshCw, LogIn } from "lucide-react";

interface TelegramSettings {
  connected: boolean;
  chatId: string | null;
  briefingTime: string;
  briefingEnabled: boolean;
  botConfigured: boolean;
  botUsername: string | null;
}

interface AISettings {
  ollamaModel: string;
  aiBriefingEnabled: boolean;
}

interface OllamaStatus {
  available: boolean;
  models: { name: string; size: number }[];
}

interface GmailSettings {
  gmailSyncEnabled: boolean;
  gmailLastSyncAt: string | null;
  hasGmailScope: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [briefingTime, setBriefingTime] = useState("07:00");
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [gmailSettings, setGmailSettings] = useState<GmailSettings | null>(null);
  const [gmailSaving, setGmailSaving] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [telegramRes, statusRes, aiSettingsRes, gmailRes] = await Promise.allSettled([
        fetch("/api/telegram/settings"),
        fetch("/api/ai/status"),
        fetch("/api/ai/settings"),
        fetch("/api/gmail/settings"),
      ]);
      if (cancelled) return;

      if (telegramRes.status === "fulfilled") {
        const data = await telegramRes.value.json();
        setSettings(data);
        setBriefingTime(data.briefingTime ?? "07:00");
      }
      if (statusRes.status === "fulfilled") {
        setOllamaStatus(await statusRes.value.json());
      }
      if (aiSettingsRes.status === "fulfilled") {
        setAiSettings(await aiSettingsRes.value.json());
      }
      if (gmailRes.status === "fulfilled") {
        setGmailSettings(await gmailRes.value.json());
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggleGmailSync = async () => {
    if (!gmailSettings) return;
    const newVal = !gmailSettings.gmailSyncEnabled;
    setGmailSaving(true);
    try {
      await fetch("/api/gmail/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailSyncEnabled: newVal }),
      });
      setGmailSettings((s) => s ? { ...s, gmailSyncEnabled: newVal } : s);
    } finally {
      setGmailSaving(false);
    }
  };

  const handleGmailSync = async () => {
    setGmailSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setGmailSettings((s) => s ? { ...s, gmailLastSyncAt: new Date().toISOString() } : s);
      }
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      setLinkCode(data.code);
    } finally {
      setGenerating(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await fetch("/api/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnect: true }),
      });
      setSettings((s) => s ? { ...s, connected: false, chatId: null } : s);
      setLinkCode(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBriefing = async () => {
    setSaving(true);
    try {
      await fetch("/api/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefingTime }),
      });
      setSettings((s) => s ? { ...s, briefingTime } : s);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBriefing = async () => {
    if (!settings) return;
    const newVal = !settings.briefingEnabled;
    setSaving(true);
    try {
      await fetch("/api/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefingEnabled: newVal }),
      });
      setSettings((s) => s ? { ...s, briefingEnabled: newVal } : s);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModel = async (model: string) => {
    setAiSaving(true);
    try {
      await fetch("/api/ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollamaModel: model }),
      });
      setAiSettings((s) => s ? { ...s, ollamaModel: model } : s);
    } finally {
      setAiSaving(false);
    }
  };

  const handleToggleAiBriefing = async () => {
    if (!aiSettings) return;
    const newVal = !aiSettings.aiBriefingEnabled;
    setAiSaving(true);
    try {
      await fetch("/api/ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiBriefingEnabled: newVal }),
      });
      setAiSettings((s) => s ? { ...s, aiBriefingEnabled: newVal } : s);
    } finally {
      setAiSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your integrations and preferences
        </p>
      </div>

      {/* Telegram Connection */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageCircle className="h-5 w-5 text-[#2AABEE]" />
              Telegram
            </CardTitle>
            {settings?.connected ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings?.botConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Bot token not configured
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Create a bot via @BotFather on Telegram, then add the token to
                your <code className="rounded bg-amber-100 px-1 dark:bg-amber-800">.env</code> file
                as <code className="rounded bg-amber-100 px-1 dark:bg-amber-800">TELEGRAM_BOT_TOKEN</code> and restart the server.
              </p>
            </div>
          ) : settings?.connected ? (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <Link2 className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Linked to @{settings.botUsername}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chat ID: {settings.chatId}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                >
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Telegram account to receive daily briefings and
                interact with LifeFlow from Telegram.
              </p>
              {linkCode ? (
                <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Send this code to{" "}
                    <strong>@{settings?.botUsername}</strong> on Telegram:
                  </p>
                  <p className="mt-2 font-mono text-3xl font-bold tracking-widest">
                    {linkCode}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Expires in 5 minutes
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateCode}
                  disabled={generating}
                  size="sm"
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  {generating ? "Generating..." : "Connect Telegram"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bot className="h-5 w-5 text-gold" />
              AI Assistant
            </CardTitle>
            {ollamaStatus?.available ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ollamaStatus?.available ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                AI not configured
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Add your Groq API key to the{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-800">.env</code> file
                as <code className="rounded bg-amber-100 px-1 dark:bg-amber-800">GROQ_API_KEY</code> and redeploy.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {ollamaStatus.models.length} model{ollamaStatus.models.length === 1 ? "" : "s"} available
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Default model
                </label>
                <Select
                  value={aiSettings?.ollamaModel ?? ""}
                  onValueChange={(v) => { if (v) handleSaveModel(v); }}
                  disabled={aiSaving}
                >
                  <SelectTrigger className="max-w-[280px]">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaStatus.models.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-sm font-medium">AI-enhanced briefings</p>
                    <p className="text-xs text-muted-foreground">
                      Use AI to summarize your daily briefing
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAiBriefing}
                  disabled={aiSaving}
                >
                  {aiSettings?.aiBriefingEnabled ? (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Enabled
                    </>
                  ) : (
                    "Disabled"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gmail Integration */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-5 w-5 text-red-500" />
              Gmail
            </CardTitle>
            {gmailSettings?.hasGmailScope ? (
              gmailSettings.gmailSyncEnabled ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!gmailSettings?.hasGmailScope ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Gmail access not granted
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Sign out and sign back in to grant Gmail read access. This lets
                  LifeFlow scan your inbox for appointments.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => window.location.href = "/api/auth/signin"}
              >
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Re-sign in for Gmail access
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Appointment detection</p>
                    <p className="text-xs text-muted-foreground">
                      Scan inbox emails for appointments using AI
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleGmailSync}
                  disabled={gmailSaving}
                >
                  {gmailSettings.gmailSyncEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              {gmailSettings.gmailSyncEnabled && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Sync now</p>
                    <p className="text-xs text-muted-foreground">
                      {gmailSettings.gmailLastSyncAt
                        ? `Last synced: ${new Date(gmailSettings.gmailLastSyncAt).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGmailSync}
                    disabled={gmailSyncing}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${gmailSyncing ? "animate-spin" : ""}`} />
                    {gmailSyncing ? "Syncing..." : "Sync"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {settings?.connected && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="h-5 w-5 text-gold" />
                Daily Briefing
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleBriefing}
                disabled={saving}
              >
                {settings.briefingEnabled ? (
                  <>
                    <Bell className="mr-1.5 h-3.5 w-3.5" />
                    Enabled
                  </>
                ) : (
                  <>
                    <BellOff className="mr-1.5 h-3.5 w-3.5" />
                    Disabled
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Briefing time
                </label>
                <Input
                  type="time"
                  value={briefingTime}
                  onChange={(e) => setBriefingTime(e.target.value)}
                  className="max-w-[160px]"
                />
              </div>
              {briefingTime !== settings.briefingTime && (
                <Button
                  size="sm"
                  onClick={handleSaveBriefing}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              You&apos;ll receive a daily summary of your events, tasks, and
              notes via Telegram at this time.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
