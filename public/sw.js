/*
 * Service worker do Lar+ — Fase 6: SÓ notificações (push + clique).
 * Sem cache offline por enquanto (PWA completo é a Fase 8).
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Lar+", body: "", url: "/notificacoes", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-maskable-192.png",
      tag: data.tag,
      data: { url: data.url },
      lang: "pt-BR",
    }),
  );
});

// Tocar na notificação abre a tela certa (deep link), reaproveitando a janela aberta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/notificacoes";
  const url = new URL(path.startsWith("/") ? path : "/notificacoes", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
