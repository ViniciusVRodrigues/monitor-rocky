// Service worker do Rocky: recebe o aviso (push) e mostra a notificação. Não faz fetch no handler:
// com o Tailscale desligado o /api não responde, e o aviso tem que aparecer mesmo assim.
const ICONE = '/img/icone-192.png';
const BADGE = '/img/badge-96.png';

self.addEventListener('install', (evento) => {
  // Guarda o ícone e o badge; se o cache falhar, a instalação segue (a notificação sai sem ícone).
  evento.waitUntil(
    (async () => {
      try {
        const cache = await caches.open('rocky-avisos-v1');
        await cache.addAll([ICONE, BADGE]);
      } catch { /* sem cache */ }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

function urlSegura(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
}

self.addEventListener('push', (evento) => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch { dados = {}; }
  if (!dados || typeof dados !== 'object') dados = {};
  const titulo = typeof dados.titulo === 'string' && dados.titulo ? dados.titulo : 'Rocky';
  const corpo = typeof dados.corpo === 'string' && dados.corpo ? dados.corpo : 'Novo aviso do monitor.';
  const tag = typeof dados.tag === 'string' && dados.tag ? dados.tag : 'rocky-som';
  // Todo push mostra uma notificação (o Safari cancela a inscrição de quem não mostra).
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo, tag, renotify: true, icon: ICONE, badge: BADGE, data: { url: urlSegura(dados.url) },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = urlSegura(evento.notification.data && evento.notification.data.url);
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mesma = janelas.find((j) => j.url && new URL(j.url).origin === self.location.origin);
      if (mesma) {
        try { await mesma.focus(); } catch { /* sem foco */ }
        if (typeof mesma.navigate === 'function') {
          try { await mesma.navigate(url); } catch { /* sem navegação */ }
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
