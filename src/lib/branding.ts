export const shopNiroLogo = new URL('../../ShopNiro-new-round-final.png', import.meta.url).href;
export const shopNiroLogoSmall = new URL('../../ShopNiro-new-round-128.png', import.meta.url).href;
export const shopNiroAnimation = new URL('../../ShopNiro-new-round.gif', import.meta.url).href;

// onError handler for store logos: swap a missing or broken image for the ShopNiro mark instead of showing alt text.
export function fallbackToBrandLogo(event: { currentTarget: HTMLImageElement }): void {
  const image = event.currentTarget;
  if (image.src === shopNiroLogoSmall) return;
  image.src = shopNiroLogoSmall;
}
