export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupWebhook } = await import("@/lib/telegram-bot");
    await setupWebhook();
  }
}
