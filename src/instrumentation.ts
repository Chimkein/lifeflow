export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupWebhook } = await import("@/lib/telegram-bot");
    setupWebhook().catch((err) => {
      console.error("[Telegram] Webhook setup error:", err);
    });
  }
}
