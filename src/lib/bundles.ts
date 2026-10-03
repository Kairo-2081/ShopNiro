import { ProductBundle } from '../types';

export interface BundlePriceItem {
  Product_ID: string;
  Price: number;
  Quantity: number;
}

export interface BundlePriceResult {
  unitPrices: Map<string, number>;
  appliedBundleIds: string[];
}

export const calculateBundlePrices = (
  items: BundlePriceItem[],
  bundles: ProductBundle[]
): BundlePriceResult => {
  const quantities = new Map<string, number>();
  const unitPrices = new Map<string, number>();
  items.forEach((item) => {
    quantities.set(item.Product_ID, (quantities.get(item.Product_ID) || 0) + Math.max(0, Number(item.Quantity) || 0));
    unitPrices.set(item.Product_ID, Math.max(0, Number(item.Price) || 0));
  });

  const claimedProducts = new Set<string>();
  const appliedBundleIds: string[] = [];
  const activeBundles = [...bundles]
    .filter((bundle) => bundle.Active && (!bundle.Ends_At || Date.parse(bundle.Ends_At) > Date.now()))
    .sort((first, second) => Number(second.Discount_Percent) - Number(first.Discount_Percent) || first.Bundle_ID.localeCompare(second.Bundle_ID));

  activeBundles.forEach((bundle) => {
    const productIds = [...new Set(bundle.Product_IDs)];
    if (productIds.length < 2 || productIds.some((id) => !quantities.has(id) || claimedProducts.has(id))) return;
    const bundleQuantity = Math.min(...productIds.map((id) => quantities.get(id) || 0));
    if (bundleQuantity <= 0) return;

    productIds.forEach((id) => {
      const quantity = quantities.get(id) || 0;
      const price = unitPrices.get(id) || 0;
      const discount = price * (Number(bundle.Discount_Percent) / 100) * (bundleQuantity / quantity);
      unitPrices.set(id, Math.max(0, Math.round((price - discount + Number.EPSILON) * 100) / 100));
      claimedProducts.add(id);
    });
    appliedBundleIds.push(bundle.Bundle_ID);
  });

  return { unitPrices, appliedBundleIds };
};
