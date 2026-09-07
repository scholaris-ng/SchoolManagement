/* eslint-disable no-undef */

/**
 * Firebase Cloud Messaging service worker.
 *
 * Receives pushes while no tab is open. The web configuration arrives in the
 * query string because a service worker cannot read the bundle's environment —
 * every value there is public by design and already present in the app bundle.
 *
 * This worker deliberately does nothing but display the notification and route
 * the click. No student data is cached here.
 */

importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;

const config = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.apiKey && config.projectId && config.appId) {
  firebase.initializeApp(config);

  firebase.messaging().onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification ?? {};
    self.registration.showNotification(title || 'Scholaris', {
      body: body || '',
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.data?.notificationId,
      data: { url: payload.data?.actionUrl || '/' },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an open tab rather than piling up windows.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
