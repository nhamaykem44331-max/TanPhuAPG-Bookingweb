import { NotificationAudience, NotificationJobChannel, NotificationJobStatus, Prisma } from "@prisma/client";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface EnqueueNotificationInput {
  type: string;
  channel: NotificationJobChannel;
  audience?: NotificationAudience;
  bookingId?: string | null;
  customerId?: string | null;
  paymentIntentId?: string | null;
  templateCode?: string | null;
  // Khi đặt, lần enqueue trùng key sẽ bị bỏ qua (chống đẩy job trùng cho cùng sự kiện).
  idempotencyKey?: string | null;
  scheduledAt?: Date;
  payload?: Record<string, unknown> | null;
}

// Đẩy một job thông báo vào hàng đợi trong cùng transaction nghiệp vụ.
// Dùng createMany + skipDuplicates để idempotencyKey @unique tự chống trùng (ON CONFLICT DO NOTHING).
export async function enqueueNotification(
  tx: Prisma.TransactionClient,
  input: EnqueueNotificationInput,
): Promise<void> {
  await tx.notificationJob.createMany({
    data: [
      {
        type: input.type,
        channel: input.channel,
        audience: input.audience ?? NotificationAudience.INTERNAL,
        bookingId: input.bookingId ?? null,
        customerId: input.customerId ?? null,
        paymentIntentId: input.paymentIntentId ?? null,
        templateCode: input.templateCode ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        scheduledAt: input.scheduledAt ?? new Date(),
        payload: input.payload ? toJsonValue(input.payload) : Prisma.JsonNull,
      },
    ],
    skipDuplicates: true,
  });
}

function minusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60_000);
}

function isFutureOrNow(date: Date): boolean {
  return date.getTime() >= Date.now();
}

export async function scheduleHoldPaymentReminderJobs(
  tx: Prisma.TransactionClient,
  args: {
    bookingId: string;
    customerId?: string | null;
    paymentIntentId?: string | null;
    ttlExpiresAt?: Date | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const basePayload = toJsonValue(args.payload ?? {});
  const jobs: Prisma.NotificationJobCreateManyInput[] = [
    {
      type: "BOOKING_HOLD_CONFIRM",
      channel: NotificationJobChannel.EMAIL,
      bookingId: args.bookingId,
      customerId: args.customerId ?? null,
      paymentIntentId: args.paymentIntentId ?? null,
      scheduledAt: new Date(),
      payload: basePayload,
    },
  ];

  if (args.ttlExpiresAt) {
    const twoHoursBefore = minusMinutes(args.ttlExpiresAt, 120);
    const thirtyMinutesBefore = minusMinutes(args.ttlExpiresAt, 30);

    if (isFutureOrNow(twoHoursBefore)) {
      jobs.push({
        type: "PAYMENT_REMINDER_T_MINUS_2H",
        channel: NotificationJobChannel.EMAIL,
        bookingId: args.bookingId,
        customerId: args.customerId ?? null,
        paymentIntentId: args.paymentIntentId ?? null,
        scheduledAt: twoHoursBefore,
        payload: basePayload,
      });
    }

    if (isFutureOrNow(thirtyMinutesBefore)) {
      jobs.push({
        type: "PAYMENT_REMINDER_T_MINUS_30M",
        channel: NotificationJobChannel.EMAIL,
        bookingId: args.bookingId,
        customerId: args.customerId ?? null,
        paymentIntentId: args.paymentIntentId ?? null,
        scheduledAt: thirtyMinutesBefore,
        payload: basePayload,
      });
    }
  }

  await tx.notificationJob.createMany({ data: jobs });
}

export async function cancelPendingPaymentReminderJobs(
  tx: Prisma.TransactionClient,
  args: { bookingId: string; paymentIntentId?: string | null },
): Promise<void> {
  await tx.notificationJob.updateMany({
    where: {
      bookingId: args.bookingId,
      ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
      status: NotificationJobStatus.PENDING,
      type: {
        in: ["BOOKING_HOLD_CONFIRM", "PAYMENT_REMINDER_T_MINUS_2H", "PAYMENT_REMINDER_T_MINUS_30M"],
      },
    },
    data: {
      status: NotificationJobStatus.CANCELLED,
    },
  });
}
