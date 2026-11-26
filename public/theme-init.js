// Runs before the page paints and before the app's code. It applies a saved dark theme so there is no light flash (light is
// the default and needs no class), and it starts the map poster download. It is a separate file because the production
// CSP only allows scripts from our own origin.
try {
  if (window.localStorage.getItem('marketpulse_theme') === 'dark') document.documentElement.classList.add('dark');
} catch (error) {
  // Storage can be blocked; the page then simply starts light.
}

// Start downloading the map's poster picture now, alongside the app's code, so it can be painted with the first frame.
// A visitor who is probably signed in goes straight to the app and never sees the landing page, so skip it for them.
try {
  var signedInAt = Number(window.localStorage.getItem('shopniro_signed_in_hint'));
  var signedIn = signedInAt > 0 && Date.now() - signedInAt < 60 * 60 * 1000;
  if (!signedIn) {
    var poster = document.createElement('link');
    poster.rel = 'preload';
    poster.as = 'image';
    poster.type = 'image/webp';
    poster.href = window.localStorage.getItem('shopniro_locale') === 'bn' ? '/map-poster-bn.webp' : '/map-poster-en.webp';
    poster.setAttribute('fetchpriority', 'low');
    document.head.appendChild(poster);
  }
} catch (error) {
  // Storage can be blocked; the poster then downloads when the page asks for it.
}
