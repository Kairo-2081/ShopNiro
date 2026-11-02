const bdt = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
});

export const money = (amount: number): string => bdt.format(amount);
