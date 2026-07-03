const THEME_KEY = 'theme-override';
const root = document.documentElement;
const toggleButton = document.getElementById('theme-toggle');
const toggleLabel = document.getElementById('theme-toggle-label');
const favicon = document.getElementById('favicon');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  toggleLabel.textContent = theme === 'dark' ? 'AM' : 'PM';
  favicon.href = `/favicon-${theme}.svg`;
}

function currentSystemTheme() {
  return systemDark.matches ? 'dark' : 'light';
}

applyTheme(localStorage.getItem(THEME_KEY) || currentSystemTheme());

systemDark.addEventListener('change', () => {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(currentSystemTheme());
  }
});

toggleButton.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// Site loader: dots fade in one by one in random order while the videos
// buffer; once every video can play through (or the cap is hit) the full
// mark holds for a beat, then the whole overlay eases away.
const loader = document.getElementById('site-loader');
if (loader) {
  document.body.classList.add('loading');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPREAD = reduceMotion ? 0 : 2200; // ms across which dots appear
  const HOLD = reduceMotion ? 300 : 700; // dramatic pause on the full mark
  const VIDEO_WAIT_CAP = 8000; // don't hold visitors hostage on slow networks

  const dots = [...loader.querySelectorAll('path')];
  for (let i = dots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dots[i], dots[j]] = [dots[j], dots[i]];
  }
  dots.forEach((dot, i) => {
    dot.style.transitionDelay = `${Math.round((i * SPREAD) / dots.length)}ms`;
  });
  requestAnimationFrame(() => loader.classList.add('dots-in'));

  const dotsDone = new Promise((r) => setTimeout(r, SPREAD + 300));
  const videosReady = Promise.race([
    Promise.all(
      [...document.querySelectorAll('.work-media video')].map((v) =>
        v.readyState >= 3
          ? Promise.resolve()
          : new Promise((r) => {
              v.addEventListener('canplaythrough', r, { once: true });
              v.addEventListener('error', r, { once: true });
            })
      )
    ),
    new Promise((r) => setTimeout(r, VIDEO_WAIT_CAP)),
  ]);

  Promise.all([dotsDone, videosReady]).then(() => {
    setTimeout(() => {
      loader.classList.add('done');
      document.body.classList.remove('loading');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
      setTimeout(() => loader.isConnected && loader.remove(), 1200);
    }, HOLD);
  });
}

// Keep page bottom padding in sync with the fixed footer's real height
const footer = document.querySelector('.footer');
function syncFooterHeight() {
  root.style.setProperty('--footer-height', `${footer.offsetHeight}px`);
}
syncFooterHeight();
window.addEventListener('resize', syncFooterHeight);
if (document.fonts) {
  document.fonts.ready.then(syncFooterHeight);
}

// Browsers can silently throttle/defer autoplay when many <video> elements
// try to start decoding at once, so re-assert play() from a few different
// triggers rather than relying on the autoplay attribute alone.
const thumbVideos = document.querySelectorAll('.work-media video');

function tryPlay(video) {
  video.play().catch(() => {});
}

if ('IntersectionObserver' in window) {
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) tryPlay(entry.target);
      });
    },
    { rootMargin: '200px' }
  );
  thumbVideos.forEach((video) => videoObserver.observe(video));
} else {
  thumbVideos.forEach(tryPlay);
}

// Safety net: some videos can end up paused after the initial load race
// (autoplay attribute vs. IntersectionObserver vs. layout not yet settled).
// Sweep once after things have settled and nudge any stragglers.
window.addEventListener('load', () => {
  setTimeout(() => {
    thumbVideos.forEach((video) => {
      if (video.paused) tryPlay(video);
    });
  }, 300);
});

// Centered static overlays on work-item hover (see /statics), keyed by the
// card's data-popup value. Each entry picks its own sizing: `scale` divides
// the source's natural width (2 = half size), `width` forces a fixed display
// width. Cards without an entry trigger nothing.
const STATICS = {
  2: { file: '2-static.svg', scale: 2 },
  3: { file: '3-static.png', scale: 2 },
  'times-square': { file: 'times-square.mp4', width: 300, video: true },
  5: { file: '5-static.svg', scale: 1 },
  10: { file: '10-static.png', scale: 2 },
};

const popupViewer = document.getElementById('popup-viewer');
const popupVideo = document.getElementById('popup-video');
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

if (canHover.matches) {
  let currentScale = 2;

  popupViewer.addEventListener('load', () => {
    popupViewer.style.width = `${popupViewer.naturalWidth / currentScale}px`;
  });
  popupVideo.addEventListener('loadedmetadata', () => {
    if (!popupVideo.style.width) {
      popupVideo.style.width = `${popupVideo.videoWidth / currentScale}px`;
    }
  });

  const hidePopups = () => {
    popupViewer.classList.remove('visible');
    popupVideo.classList.remove('visible');
    popupVideo.pause();
  };

  document.querySelectorAll('.work-item[data-popup]').forEach((item) => {
    const entry = STATICS[item.dataset.popup];
    if (!entry) return;
    item.addEventListener('mouseenter', () => {
      currentScale = entry.scale ?? 2;
      if (entry.video) {
        popupVideo.style.width = entry.width ? `${entry.width}px` : '';
        if (!popupVideo.src.endsWith(entry.file)) {
          popupVideo.src = `/statics/${entry.file}`;
        }
        popupVideo.currentTime = 0;
        popupVideo.play().catch(() => {});
        popupVideo.classList.add('visible');
      } else {
        popupViewer.src = `/statics/${entry.file}`;
        popupViewer.classList.add('visible');
      }
    });
    item.addEventListener('mouseleave', hidePopups);
  });
}
