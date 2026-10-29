'use strict';
(() => {
  const installButton = document.getElementById('pwaInstall');
  let installPrompt = null, updateAccepted = false, updateWorker = null, updateRequest = 0;
  const secureHost = location.protocol === 'https:' ||
    (location.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname));
  if (!secureHost || !('serviceWorker' in navigator)) return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null; installButton.hidden = true;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null; installButton.hidden = true;
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { window.APP?.toast('Установку можно повторить из меню браузера.'); }
  });

  const notice = document.createElement('section');
  notice.className = 'pwa-notice'; notice.hidden = true;
  notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');
  const label = document.createElement('span');
  const action = document.createElement('button'); action.className = 'quiet';
  const dismiss = document.createElement('button'); dismiss.className = 'quiet';
  dismiss.textContent = 'Позже'; dismiss.addEventListener('click', () => { notice.hidden = true; });
  notice.append(label, action, dismiss); document.body.append(notice);
  function showUpdate(worker) {
    updateWorker = worker;
    updateAccepted = false; action.disabled = false;
    label.textContent = 'Доступна новая версия';
    action.textContent = 'Сохранить текст и обновить';
    action.hidden = false; dismiss.textContent = 'Позже'; notice.hidden = false;
  }
  action.addEventListener('click', () => {
    if (!updateWorker || action.disabled) return;
    // The editor saves on every input. Verify the current value before any reload;
    // if browser storage is unavailable/full, keep the working page intact.
    try {
      const text = window.KB?.getText();
      if (typeof text === 'string') {
        localStorage.setItem('cs-demo-editor', text);
        if (localStorage.getItem('cs-demo-editor') !== text) throw new Error('Storage verification failed');
        window.KB?.setText(text);
      }
    } catch {
      label.textContent = 'Не удалось сохранить текст. Скачайте .txt в редакторе перед обновлением.';
      action.hidden = true; dismiss.textContent = 'Закрыть';
      return;
    }
    updateAccepted = true; action.disabled = true;
    label.textContent = 'Текст сохранён. Проверка открытых окон…';
    try { updateWorker.postMessage({type:'ACTIVATE_UPDATE', requestId:++updateRequest}); }
    catch {
      updateAccepted = false; action.disabled = false;
      label.textContent = 'Не удалось начать обновление. Повторите попытку.';
    }
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.source !== updateWorker || event.data?.type !== 'UPDATE_RESULT' || event.data.requestId !== updateRequest) return;
    if (event.data.status === 'accepted') {
      label.textContent = 'Текст сохранён. Обновление…';
      return;
    }
    updateAccepted = false; action.disabled = false;
    label.textContent = event.data.status === 'blocked'
      ? 'Закройте другие окна приложения и повторите обновление.'
      : 'Не удалось начать обновление. Повторите попытку.';
    action.textContent = 'Повторить обновление';
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Other open windows retain their working text and are never forcibly reloaded.
    if (updateAccepted) location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'});
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      const checkUpdate = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', checkUpdate);
      setInterval(checkUpdate, 60 * 60 * 1000);
      // Registration.ready confirms that the entire addAll precache completed.
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) return;
      window.APP?.toast('Программа готова к работе без интернета.');
    } catch {
      window.APP?.toast('Офлайн-версия недоступна. Программа продолжает работать в браузере.');
    }
  });
})();
