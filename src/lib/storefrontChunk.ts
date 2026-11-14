// The storefront's code is loaded on demand. It lives in its own module so that both the app and the early start of the
// first requests can ask for it without importing the whole app.
export const loadStorefront = () => import('../components/storefront/Storefront');
