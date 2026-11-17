// Runs before the page paints so a visitor who chose the dark theme never sees a light flash. Light is the default and
// needs no class. Kept as a separate file because the production CSP only allows scripts from our own origin.
try {
  if (window.localStorage.getItem('marketpulse_theme') === 'dark') document.documentElement.classList.add('dark');
} catch (error) {
  // Storage can be blocked; the page then simply starts light.
}
