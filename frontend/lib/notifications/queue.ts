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
}

export async function flushNotificationQueueForTests(): Promise<void> {
  await Promise.all(Array.from(pendingTasks));
}
