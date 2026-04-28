import { NotificationJobChannel, NotificationJobStatus, Prisma } from "@prisma/client";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
