const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

function openMusic(info) {
  if (!info) return;

  // 微信内直接打开网页版，避免 scheme 被拦截
  if (isWeChat) {
    location.href = info.web;
    return;
  }

  if (info.scheme) {
    const start = Date.now();
    window.location.href = info.scheme;
    setTimeout(function () {
      if (Date.now() - start < 2000 && !document.hidden) {
        window.open(info.web, '_blank');
      }
    }, 900);
  } else {
    window.open(info.web, '_blank');
  }
}