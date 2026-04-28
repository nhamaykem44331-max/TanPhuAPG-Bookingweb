export interface TelegramMessage {
  text: string;
}

export async function sendTelegram(message: TelegramMessage): Promise<void> {
  if (
    process.env.NOTIFICATIONS_TELEGRAM_ENABLED !== "true" ||
    !process.env.TELEGRAM_BOT_TOKEN ||
    !process.env.TELEGRAM_CHAT_ID
  ) {
    console.info("telegram skipped");
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message.text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    console.error(`telegram failed: HTTP ${response.status}`);
    return;
  }

  console.info("telegram sent");
}
