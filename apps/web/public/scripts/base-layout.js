function getEl(id) {
  return document.getElementById(id);
}

function setBodyOverflow(value) {
  document.body.style.overflow = value;
}

function createMenuController({ menuBtn, menu, overlay }) {
  const openMenu = () => {
    if (!menu || !overlay || !menuBtn) return;
    menu.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
    setBodyOverflow('hidden');
    const first = menu.querySelector('a');
    if (first) setTimeout(() => first.focus(), 100);
  };

  const closeMenu = () => {
    if (!menu || !overlay || !menuBtn) return;
    menu.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
    setBodyOverflow('');
    menuBtn.focus();
  };

  return { openMenu, closeMenu };
}

function wireMobileMenuEvents({ menuBtn, menu, closeBtn, overlay, openMenu, closeMenu }) {
  menuBtn?.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    if (open) closeMenu();
    else openMenu();
  });

  closeBtn?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);

  globalThis.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  menu?.addEventListener('click', (e) => {
    const target = e.target;
    if (target?.tagName === 'A') closeMenu();
  });
}

function initMobileMenu() {
  const menuBtn = getEl('mobile-menu-btn');
  const menu = getEl('mobile-menu');
  const closeBtn = getEl('mobile-menu-close');
  const overlay = getEl('mobile-menu-overlay');

  const { openMenu, closeMenu } = createMenuController({ menuBtn, menu, overlay });
  wireMobileMenuEvents({ menuBtn, menu, closeBtn, overlay, openMenu, closeMenu });
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  localStorage.setItem('theme', newTheme);
}

function initThemeToggle() {
  const themeToggle = getEl('theme-toggle');
  const themeToggleMobile = getEl('theme-toggle-mobile');

  themeToggle?.addEventListener('click', toggleTheme);
  themeToggleMobile?.addEventListener('click', toggleTheme);

  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });
}

(function initBaseLayout() {
  initMobileMenu();
  initThemeToggle();
})();
