// ── JAGANNATH.DK SHARED JS ──
let lang = localStorage.getItem('jd-lang') || 'en';

function setLang(l) {
  lang = l;
  localStorage.setItem('jd-lang', l);
  document.querySelectorAll('.t-en, .t-da').forEach(el => {
    el.classList.toggle('vis', el.classList.contains('t-' + l));
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isDA = btn.textContent.trim().toLowerCase() === 'dansk';
    btn.classList.toggle('active', (l === 'da' && isDA) || (l === 'en' && !isDA));
  });
  document.documentElement.lang = l;
  // update nav links that have data attributes
  document.querySelectorAll('nav a[data-' + l + ']').forEach(el => {
    const spans = el.querySelectorAll('.t-en, .t-da');
    if (!spans.length && el.dataset[l]) el.textContent = el.dataset[l];
  });
}

function toggleMenu() {
  document.getElementById('nav-menu').classList.toggle('open');
}

// Init on load
document.addEventListener('DOMContentLoaded', () => setLang(lang));
