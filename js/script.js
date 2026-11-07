(function () {
  'use strict';

  /* ========================================================
     0. 工具
     ======================================================== */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches
                || window.matchMedia('(pointer: coarse)').matches;

  /* ========================================================
     1. 画布 & 相机
     ======================================================== */
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d', { alpha: true });

  let W = 0, H = 0, CX = 0, CY = 0, F = 1, DPR = 1;

  const CAM = { x: 0, y: 42, z: -115 };

  function resize() {
    // 移动端 DPR 限制在 1.75，避免高分辨率手机渲染过载
    const maxDpr = isMobile ? 1.75 : 2;
    DPR = Math.min(window.devicePixelRatio || 1, maxDpr);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2;
    CY = H / 2;
    F = Math.min(H * 1.12, W * 0.88);
  }

  const _p = { x: 0, y: 0, d: 0, ok: false };
  function project(x, y, z) {
    const d = z - CAM.z;
    if (d < 10) { _p.ok = false; return _p; }
    _p.x = CX + (x - CAM.x) / d * F;
    _p.y = CY - (y - CAM.y) / d * F;
    _p.d = d;
    _p.ok = true;
    return _p;
  }

  function screenToWorld(sx, sy) {
    const d = 118;
    return {
      x: CAM.x + (sx - CX) / F * d,
      y: CAM.y - (sy - CY) / F * d,
      z: CAM.z + d
    };
  }

  /* ========================================================
     2. 发光精灵
     ======================================================== */
  const COLORS = ['#e8c9a0', '#f0ece4', '#c4a882', '#d4b896', '#a89070'];

  function makeSprite(hex) {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const r = S / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0.00, 'rgba(255,255,255,.95)');
    grd.addColorStop(0.25, hexToRgba(hex, 0.9));
    grd.addColorStop(0.55, hexToRgba(hex, 0.3));
    grd.addColorStop(1.00, hexToRgba(hex, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return c;
  }

  const sprites = COLORS.map(makeSprite);

  /* ========================================================
     3. 粒子系统
     ======================================================== */
  const rockets = [];
  const sparks  = [];

  const GRAV = -26;
  const DRAG = 1.7;

  // 移动端减少每朵烟花的粒子数，避免掉帧
  const SPARK_MIN = isMobile ? 20 : 32;
  const SPARK_MAX = isMobile ? 42 : 68;
  // 自动发射间隔：移动端稍长，减少渲染压力
  const ROCKET_GAP_MIN = isMobile ? 1.6 : 1.1;
  const ROCKET_GAP_MAX = isMobile ? 3.2 : 2.6;

  function spawnRocket() {
    const startY  = rand(-14, 4);
    const targetY = rand(56, 108);
    const g = 62;
    const vy = Math.sqrt(2 * g * Math.max(targetY - startY, 24));
    rockets.push({
      x: rand(-72, 72),
      y: startY,
      z: rand(-58, 54),
      vx: rand(-2, 2),
      vy: vy,
      vz: rand(-2, 2),
      g: g
    });
  }

  function explode(x, y, z) {
    const R = rand(18, 36);
    const count = Math.round(rand(SPARK_MIN, SPARK_MAX));
    const base = Math.floor(Math.random() * COLORS.length);
    const dual = Math.random() < 0.35;
    const alt = (base + 2 + Math.floor(Math.random() * 2)) % COLORS.length;

    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const spd = R * rand(2.2, 3.4);

      sparks.push({
        x, y, z,
        vx: s * Math.cos(th) * spd,
        vy: u * spd,
        vz: s * Math.sin(th) * spd,
        age: 0,
        life: rand(1.1, 1.9),
        size: rand(0.45, 0.9),
        color: (dual && Math.random() < 0.5) ? alt : base,
        px: null,
        py: null
      });
    }
  }

  let clock = 0;
  let rocketTimer = 0;

  function update(dt) {
    clock += dt;

    rocketTimer -= dt;
    if (rocketTimer <= 0) {
      rocketTimer = rand(ROCKET_GAP_MIN, ROCKET_GAP_MAX);
      spawnRocket();
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.vy -= r.g * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      if (r.vy <= 0) {
        explode(r.x, r.y, r.z);
        rockets.splice(i, 1);
      }
    }

    const damp = Math.exp(-DRAG * dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      s.vy += GRAV * dt;
      s.vx *= damp;
      s.vy *= damp;
      s.vz *= damp;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
    }
  }

  function render() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < rockets.length; i++) {
      const r = rockets[i];
      const p = project(r.x, r.y, r.z);
      if (!p.ok) continue;
      const d = clamp(F / p.d * 2.2, 6, 36);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(sprites[1], p.x - d / 2, p.y - d / 2, d, d);
    }

    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const p = project(s.x, s.y, s.z);
      if (!p.ok) continue;

      const t = s.age / s.life;
      const alpha = Math.pow(1 - t, 1.6);
      if (alpha < 0.04) continue;

      const rad = Math.max(0.6, s.size * F / p.d);
      const d = rad * 2.8;

      if (s.px !== null) {
        const dx = p.x - s.px, dy = p.y - s.py;
        if (dx * dx + dy * dy > 1) {
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = COLORS[s.color];
          ctx.lineWidth = Math.max(0.45, rad * 0.45);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.px, s.py);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(sprites[s.color], p.x - d / 2, p.y - d / 2, d, d);

      s.px = p.x;
      s.py = p.y;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ========================================================
     4. 交互：点击放烟花
     ======================================================== */
  function handlePointer(e) {
    if (e.target && e.target.closest &&
        e.target.closest('button, .panel, .panel-overlay, .drawer, .drawer-overlay, .drawer-trigger')) return;
    const w = screenToWorld(e.clientX, e.clientY);
    explode(w.x, w.y, w.z);
  }

  window.addEventListener('pointerdown', handlePointer, { passive: true });

  window.addEventListener('resize', function () { resize(); });

  window.addEventListener('orientationchange', function () {
    setTimeout(function () { resize(); }, 260);
  });

  // iOS 地址栏收起/展开时同步画布尺寸
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { resize(); });
  }

  /* ========================================================
     5. 侧边抽屉开关 + 滑动手势
     ======================================================== */
  const drawer = document.getElementById('songDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerTrigger = document.getElementById('drawerTrigger');
  const drawerClose = document.getElementById('drawerClose');

  function openDrawer() {
    drawer.classList.add('open');
    drawerOverlay.classList.add('open');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }

  drawerTrigger.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  // 触摸滑动手势：右滑关闭抽屉
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  drawer.addEventListener('touchstart', function (e) {
    if (!drawer.classList.contains('open')) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
  }, { passive: true });

  drawer.addEventListener('touchend', function (e) {
    if (!touchActive) return;
    touchActive = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    // 向右滑动超过 60px，且水平位移大于垂直位移 → 关闭
    if (dx > 60 && Math.abs(dx) > Math.abs(dy)) {
      closeDrawer();
    }
  }, { passive: true });

  /* ========================================================
     6. 正在播放 · 歌曲信息
     ======================================================== */
  const SONGS = [
    { title: '江南',       album: '第二天堂',     year: 2004, lyric: '圈圈圆圆圈圈，天天年年天天的我，深深看你的脸', search: '江南 林俊杰' },
    { title: '修炼爱情',   album: '因你而在',     year: 2013, lyric: '修炼爱情的悲欢，我们这些努力不简单',             search: '修炼爱情 林俊杰' },
    { title: '关键词',     album: '和自己对话',   year: 2015, lyric: '好好爱自己，就有人会爱你',                       search: '关键词 林俊杰' },
    { title: '愿与愁',     album: '重拾_快乐',    year: 2023, lyric: '你我终会沦为尘埃漂流，等待花季烟雨稠',             search: '愿与愁 林俊杰' },
    { title: '可惜没如果', album: '新地球',       year: 2014, lyric: '倘若那天，把该说的话好好说，该体谅的不执着',       search: '可惜没如果 林俊杰' }
  ];

  let songIndex = 0;
  let songTimer = null;

  const npTitle = document.getElementById('npTitle');
  const npMeta = document.getElementById('npMeta');
  const npLyric = document.getElementById('npLyric');
  const npPrev = document.getElementById('npPrev');
  const npNext = document.getElementById('npNext');
  const nowPlaying = document.getElementById('nowPlaying');

  function renderSong(index) {
    const s = SONGS[index];
    if (!s) return;

    npLyric.style.opacity = '0';
    npTitle.style.opacity = '0';

    setTimeout(function () {
      npTitle.textContent = s.title;
      npMeta.textContent = '《' + s.album + '》 · ' + s.year;
      npLyric.textContent = s.lyric;

      npTitle.style.opacity = '1';
      npLyric.style.opacity = '1';
    }, 180);
  }

  function goToSong(index) {
    songIndex = (index + SONGS.length) % SONGS.length;
    renderSong(songIndex);
    resetSongTimer();
  }

  function nextSong() { goToSong(songIndex + 1); }
  function prevSong() { goToSong(songIndex - 1); }

  function resetSongTimer() {
    clearInterval(songTimer);
    songTimer = setInterval(nextSong, 7000);
  }

  npNext.addEventListener('click', function (e) {
    e.stopPropagation();
    nextSong();
  });

  npPrev.addEventListener('click', function (e) {
    e.stopPropagation();
    prevSong();
  });

  nowPlaying.addEventListener('click', function () {
    const s = SONGS[songIndex];
    const q = encodeURIComponent(s.search);
    window.open('https://music.163.com/#/search/m/?s=' + q + '&type=1', '_blank');
  });

  renderSong(0);
  resetSongTimer();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearInterval(songTimer);
    } else {
      resetSongTimer();
    }
  });

  /* ========================================================
     7. 外部音乐跳转
     ======================================================== */
  function parseMusicLink(url) {
    url = url.trim();
    if (!url) return null;

    let m = url.match(/music\.163\.com\/song\?id=(\d+)/);
    if (m) {
      const id = m[1];
      return {
        platform: 'netease', label: '网易云音乐',
        scheme: 'orpheus://song/' + id + '/?autoplay=1',
        web: 'https://music.163.com/song?id=' + id
      };
    }

    if (/163cn\.tv/.test(url)) {
      return { platform: 'netease', label: '网易云音乐', scheme: null, web: url };
    }

    m = url.match(/y\.qq\.com\/n\/ryqq\/songDetail\/([a-zA-Z0-9]+)/);
    if (m) {
      const mid = m[1];
      const p = JSON.stringify({ song: [{ songmid: mid }], action: 'play' });
      return {
        platform: 'qq', label: 'QQ音乐',
        scheme: 'qqmusic://qq.com/media/playSonglist?p=' + encodeURIComponent(p),
        web: 'https://y.qq.com/n/ryqq/songDetail/' + mid
      };
    }

    if (/c6\.y\.qq\.com|y\.qq\.com\/base\/fcgi-bin\/u/.test(url)) {
      return { platform: 'qq', label: 'QQ音乐', scheme: null, web: url };
    }

    m = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (m) {
      const id = m[1];
      return {
        platform: 'spotify', label: 'Spotify',
        scheme: 'spotify:track:' + id,
        web: 'https://open.spotify.com/track/' + id
      };
    }

    m = url.match(/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (m) {
      const id = m[1];
      return {
        platform: 'ytmusic', label: 'YouTube Music',
        scheme: null,
        web: 'https://music.youtube.com/watch?v=' + id
      };
    }

    return { platform: 'other', label: '外部链接', scheme: null, web: url };
  }

  function openMusic(info) {
    if (!info) return;
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

  const overlay = document.getElementById('panelOverlay');
  const fab = document.getElementById('musicFab');
  const closeBtn = document.getElementById('panelClose');
  const input = document.getElementById('musicInput');
  const openBtn = document.getElementById('openLinkBtn');
  const searchBtn = document.getElementById('searchBtn');
  const hint = document.getElementById('panelHint');

  function openPanel() {
    overlay.classList.add('open');
    // 移动端延时聚焦，等键盘弹出动画
    setTimeout(function () { input.focus(); }, isMobile ? 350 : 400);
  }

  function closePanel() {
    overlay.classList.remove('open');
    input.blur();
  }

  fab.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePanel();
  });

  openBtn.addEventListener('click', function () {
    const raw = input.value.trim();
    if (!raw) {
      input.focus();
      input.style.borderColor = '#c97070';
      setTimeout(function () { input.style.borderColor = ''; }, 1200);
      return;
    }
    const info = parseMusicLink(raw);
    if (!info) {
      hint.innerHTML = '无法识别该链接，请检查格式。';
      return;
    }
    closePanel();
    openMusic(info);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      openBtn.click();
    }
  });

  searchBtn.addEventListener('click', function () {
    const q = encodeURIComponent('生日快乐');
    window.open('https://music.163.com/#/search/m/?s=' + q + '&type=1', '_blank');
  });

  input.addEventListener('input', function () {
    const raw = input.value.trim();
    if (!raw) {
      hint.innerHTML = '支持：<br>网易云 music.163.com/song?id=…　·　QQ音乐 y.qq.com/…<br>Spotify open.spotify.com/track/…　·　YouTube Music music.youtube.com/watch?v=…';
      return;
    }
    const info = parseMusicLink(raw);
    if (info && info.platform !== 'other') {
      hint.innerHTML = '识别为 <strong style="color:var(--accent)">' + info.label + '</strong>' +
        (info.scheme ? ' · 将尝试唤起 App' : ' · 将打开网页版');
    } else if (info && info.platform === 'other') {
      hint.innerHTML = '未识别的平台，将直接打开链接。';
    }
  });

  /* ========================================================
     8. 启动
     ======================================================== */
  resize();

  setTimeout(function () {
    explode(rand(-50, 50), rand(58, 92), rand(-28, 28));
  }, 400);
  setTimeout(function () {
    explode(rand(-65, 65), rand(72, 106), rand(-36, 18));
  }, 850);
  setTimeout(function () {
    explode(rand(-55, 55), rand(52, 88), rand(-18, 36));
  }, 1400);

  requestAnimationFrame(function (now) {
    lastTime = now;
    loop(now);
  });

})();
