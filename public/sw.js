/* Wolt Tracker Service Worker – Push Notifications */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Wolt Tracker", body: event.data.text() };
  }

  const title = data.title ?? "Wolt Tracker";
  const options = {
    body: data.body ?? "",
    icon: "/public/icon.png",
    badge: "/public/icon.png",
    tag: data.code ? `wolt-${data.code}` : "wolt-tracker",
    renotify: true,
    data: { code: data.code, url: data.code ? `/track/${data.code}` : "/" },
    actions: [
      { action: "view", title: "View tracking" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if open
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        return clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Re-subscribe if subscription expires
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        // In a real app you'd re-POST to /api/push-subscribe here
        console.log("Push subscription renewed:", subscription);
      }),
  );
});
