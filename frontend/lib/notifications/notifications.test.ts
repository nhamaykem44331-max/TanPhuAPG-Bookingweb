import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sendEmail } from "./channels/email";
import { sendTelegram } from "./channels/telegram";
import { notify } from "./index";
import { flushNotificationQueueForTests } from "./queue";
import { renderBookingHold } from "./templates/bookingHold";

function withConsoleSpy(method: "info" | "error", run: () => Promise<void>): Promise<string[]> {
  const original = console[method];
  const logs: string[] = [];
  console[method] = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  return run().finally(() => {
    console[method] = original;
  }).then(() => logs);
}

describe("notifications", () => {
  it("bỏ qua email khi flag disabled", async () => {
    process.env.NOTIFICATIONS_EMAIL_ENABLED = "false";
    const logs = await withConsoleSpy("info", () =>
      sendEmail({
        to: "khach@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    );

    assert.equal(logs.some((line) => line.includes("email skipped")), true);
  });

  it("Slack webhook lỗi 500 không làm notify throw", async () => {
    process.env.NOTIFICATIONS_SLACK_ENABLED = "true";
    process.env.SLACK_WEBHOOK_URL = "https://example.com/slack";
    process.env.NOTIFICATIONS_TELEGRAM_ENABLED = "false";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("fail", { status: 500 });

    const logs = await withConsoleSpy("error", async () => {
      await notify({ type: "INTERNAL_ALERT", severity: "error", message: "Test alert" });
      await flushNotificationQueueForTests();
    });

    globalThis.fetch = originalFetch;
    assert.equal(logs.some((line) => line.includes("slack failed: HTTP 500")), true);
  });

  it("notify xử lý nhiều event liên tiếp qua queue", async () => {
    process.env.NOTIFICATIONS_SLACK_ENABLED = "false";
    process.env.NOTIFICATIONS_TELEGRAM_ENABLED = "false";

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        notify({ type: "INTERNAL_ALERT", severity: "info", message: `Queued ${index}` }),
      ),
    );
    await flushNotificationQueueForTests();

    assert.ok(true);
  });

  it("bỏ qua Telegram khi flag disabled", async () => {
    process.env.NOTIFICATIONS_TELEGRAM_ENABLED = "false";
    const logs = await withConsoleSpy("info", () => sendTelegram({ text: "Test" }));
    assert.equal(logs.some((line) => line.includes("telegram skipped")), true);
  });

  it("render email giữ chỗ có PNR và tổng tiền", () => {
    const rendered = renderBookingHold({
      customerName: "Nguyen Van A",
      customerEmail: "a@example.com",
      pnr: "ABC123",
      route: "SGN-HAN",
      departAt: "24/04/2026 09:00",
      passengerCount: 1,
      sellAmount: "1.500.000",
      currency: "VND",
      ttlExpiresAt: "24/04/2026 18:00",
    });

    assert.match(rendered.subject, /ABC123/);
    assert.match(rendered.text, /1\.500\.000 VND/);
  });
});
