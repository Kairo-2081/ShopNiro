const bdt = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
});

export const money = (amount: number): string => bdt.format(amount);

interface AddressParts {
  House_Name?: string | null;
  Street?: string | null;
  City?: string | null;
  Postal_Code?: string | null;
}

/**
 * One line for an address: "House, Street, City (Postal code)". Parts that are missing are left out, so there is never a
 * dangling comma or an empty "()".
 */
export function formatAddressLine(address: AddressParts, options: { includeHouse?: boolean } = {}): string {
  const clean = (value?: string | null) => (value ?? '').trim();
  const places = [options.includeHouse ? address.House_Name : '', address.Street, address.City].map(clean).filter(Boolean).join(', ');
  const postal = clean(address.Postal_Code);
  return postal ? (places ? `${places} (${postal})` : postal) : places;
}
