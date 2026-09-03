// ─── Safrom Pricing & Outlet Configuration ───────────────────────────────────

export const PRICING = {
  // Base single store
  BASE_MONTHLY: 999,
  BASE_ANNUAL: 11988,

  // Multi-Branch (Same business type)
  BRANCH_ADDON_MONTHLY: 500,
  BRANCH_ADDON_ANNUAL: 6000,
  MAX_BRANCHES: 10,

  // Multi-Store (Diversified business types: e.g. Pub + Chemist)
  STORE_ADDON_MONTHLY: 749,
  STORE_ADDON_ANNUAL: 8988,
  MAX_STORES: 4,
} as const;

export type PlanCategory = 'single' | 'branch' | 'store';

/**
 * Calculates the total annual subscription price based on plan category and total outlets.
 * @param category 'single' | 'branch' | 'store'
 * @param totalOutlets Total number of locations (1 to 10 for branches, 1 to 4 for stores)
 */
export function calculateAnnualPrice(category: PlanCategory, totalOutlets: number = 1): number {
  if (category === 'single' || totalOutlets <= 1) {
    return PRICING.BASE_ANNUAL;
  }

  const extraOutlets = Math.max(0, totalOutlets - 1);

  if (category === 'branch') {
    const cappedExtras = Math.min(extraOutlets, PRICING.MAX_BRANCHES - 1);
    return PRICING.BASE_ANNUAL + cappedExtras * PRICING.BRANCH_ADDON_ANNUAL;
  }

  if (category === 'store') {
    const cappedExtras = Math.min(extraOutlets, PRICING.MAX_STORES - 1);
    return PRICING.BASE_ANNUAL + cappedExtras * PRICING.STORE_ADDON_ANNUAL;
  }

  return PRICING.BASE_ANNUAL;
}

/**
 * Calculates the monthly equivalent of an annual total.
 */
export function getMonthlyEquivalent(annualTotal: number): number {
  return Math.round(annualTotal / 12);
}

/**
 * Returns the cost for adding one additional outlet mid-year.
 */
export function getAddonAnnualCost(category: 'branch' | 'store'): number {
  return category === 'branch' ? PRICING.BRANCH_ADDON_ANNUAL : PRICING.STORE_ADDON_ANNUAL;
}

/**
 * Returns the maximum allowed outlets for a plan category.
 */
export function getMaxOutlets(category: PlanCategory): number {
  switch (category) {
    case 'branch':
      return PRICING.MAX_BRANCHES;
    case 'store':
      return PRICING.MAX_STORES;
    default:
      return 1;
  }
}