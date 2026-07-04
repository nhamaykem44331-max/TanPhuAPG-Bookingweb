export interface SlackMessage {
  text: string;
}

export async function sendSlack(message: SlackMessage): Promise<void> {
  if (process.env.NOTIFICATIONS_SLACK_ENABLED !== "true" || !process.env.SLACK_WEBHOOK_URL) {
    console.info("slack skipped");
    return;
  }

  const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message.text }),
  });

  if (!response.ok) {
    console.error(`slack failed: HTTP ${response.status}`);
    return;
  }

  console.info("slack sent");
}
