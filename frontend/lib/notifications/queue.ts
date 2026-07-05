import { waitUntil } from "@vercel/functions";

const pendingTasks = new Set<Promise<void>>();

export function enqueueNotification(task: () => Promise<void>): void {
  const pending = Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error("notification failed", error);
    })
    .finally(() => {
      pendingTasks.delete(pending);
    });

  pendingTasks.add(pending);

  // Trên Vercel serverless, function bị đóng băng ngay khi response trả về, nên
  // promise "fire-and-forget" (email/SMTP, Telegram, Zalo) thường bị giết giữa chừng.
  // waitUntil giữ compute sống tới khi notification chạy xong. Ngoài Vercel
  // (local/dev) không có request context → bỏ qua, process vẫn sống nên vẫn gửi được.
  try {
    waitUntil(pending);
  } catch {
    // no-op ngoài môi trường Vercel
  }
}

export async function flushNotificationQueueForTests(): Promise<void> {
  await Promise.all(Array.from(pendingTasks));
}
