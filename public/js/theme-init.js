// Chargé de façon bloquante dans <head> : applique le thème AVANT le premier rendu
// (évite le « flash » sombre → clair) et signale que JavaScript est actif.
(function () {
  var root = document.documentElement;
  var theme = null;
  try { theme = localStorage.getItem('theme'); } catch (e) {}
  if (!theme) theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = theme;
  root.classList.add('js');
})();
