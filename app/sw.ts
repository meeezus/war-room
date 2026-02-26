/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Push notification handlers
// ---------------------------------------------------------------------------

self.addEventListener("push", (event: PushEvent) => {
  console.log("[SW] Push received");

  let data = { title: "War Room", body: "New notification" } as Record<
    string,
    unknown
  >;

  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    console.error("[SW] Push data parse error:", e);
  }

  // vibrate is valid per the Notification API spec but missing from TS's
  // NotificationOptions type, so we build as a plain object.
  const options = {
    body: (data.body as string) || "You have a new message",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: (data.url as string) || "/chat" },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      (data.title as string) || "War Room",
      options,
    ),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url =
    (event.notification.data as { url?: string } | undefined)?.url || "/chat";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window" })
      .then((clientList: readonly WindowClient[]) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
