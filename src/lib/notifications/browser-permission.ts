import { waitFor } from "@/lib/state/wait-for";

/** Catch external settings changes, including browsers without Permissions API support. */
export function watchNotificationPermission(changed: (permission: NotificationPermission) => void) {
  let current = Notification.permission, disposed = false;
  let status: PermissionStatus | undefined;
  const check = () => {
    if (disposed || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    const next = Notification.permission;
    if (next !== current) { current = next; changed(next); }
  };
  if (typeof window !== "undefined") window.addEventListener("focus", check);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", check);
  if (typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function") {
    try { void navigator.permissions.query({ name: "notifications" }).then((permission) => {
      if (disposed) return;
      status = permission; status.addEventListener("change", check); check();
    }).catch(() => { /* Focus/visibility recovery remains available in Samsung and Safari. */ }); }
    catch { /* Older implementations may throw synchronously for this permission name. */ }
  }
  return () => {
    disposed = true;
    if (typeof window !== "undefined") window.removeEventListener("focus", check);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", check);
    status?.removeEventListener("change", check);
  };
}

/** Support both callback and Promise implementations without losing the click gesture. */
export function requestNotificationPermission(signal: AbortSignal): Promise<NotificationPermission> {
  if (signal.aborted) return Promise.reject(new Error("Request cancelled."));
  if (Notification.permission === "granted" || Notification.permission === "denied") return Promise.resolve(Notification.permission);
  let stopWatching = () => {};
  const request = new Promise<NotificationPermission>((resolve, reject) => {
    // Some browsers leave requestPermission pending when permission is changed in settings.
    stopWatching = watchNotificationPermission((permission) => { if (permission !== "default") resolve(permission); });
    try {
      const result = Notification.requestPermission(resolve);
      if (result?.then) void result.then(resolve, reject);
    } catch (error) { reject(error); }
  });
  return waitFor(request, signal, 60_000).finally(() => stopWatching());
}

export function notificationSetupError(stage: "permission" | "device" | "save", error: unknown): string {
  if (stage === "permission") return "No permission was received. Check the notification icon beside the address bar and allow MONO. In Samsung Internet, also allow notifications for the browser in your phone settings, then try again.";
  if (stage === "save") return "Couldn't save notifications to your account. Check your connection and try again.";
  if (error instanceof Error && error.name === "NotAllowedError") return "Notifications are blocked for this browser or installed app. Allow them in your browser and phone notification settings, then try again.";
  return "Your browser couldn't register this device for notifications. Reopen MONO in the browser you installed it from and try again. In Samsung Internet, check its notification settings; you can also try installing MONO from Chrome.";
}
