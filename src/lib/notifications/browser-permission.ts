import { waitFor } from "@/lib/state/wait-for";

/** Support both callback and Promise implementations without losing the click gesture. */
export function requestNotificationPermission(signal: AbortSignal): Promise<NotificationPermission> {
  if (Notification.permission === "granted" || Notification.permission === "denied") return Promise.resolve(Notification.permission);
  const request = new Promise<NotificationPermission>((resolve, reject) => {
    try {
      const result = Notification.requestPermission(resolve);
      if (result?.then) void result.then(resolve, reject);
    } catch (error) { reject(error); }
  });
  return waitFor(request, signal, 60_000);
}

export function notificationSetupError(stage: "permission" | "device" | "save", error: unknown): string {
  if (stage === "permission") return "No permission was received. Check the notification icon beside the address bar and allow MONO. In Samsung Internet, also allow notifications for the browser in your phone settings, then try again.";
  if (stage === "save") return "Couldn't save notifications to your account. Check your connection and try again.";
  if (error instanceof Error && error.name === "NotAllowedError") return "Notifications are blocked for this browser or installed app. Allow them in your browser and phone notification settings, then try again.";
  return "Your browser couldn't register this device for notifications. Reopen MONO in the browser you installed it from and try again. In Samsung Internet, check its notification settings; you can also try installing MONO from Chrome.";
}
