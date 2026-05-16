// Local extension of BrandProfile with V4 scan-derived fields. Once V4 lands
// these into packages/shared-types they can be folded back; until then this
// keeps WS-V2 isolated from cross-package edits.

import type { BrandProfile } from "@cie/shared-types";

export interface ExtendedBrandProfile extends BrandProfile {
  tagline?: string;
  sourceUrl?: string;
  lastScannedAt?: string;
}

export function isBrandEmpty(brand: ExtendedBrandProfile | null): boolean {
  if (!brand) return true;
  const hasName = Boolean(brand.name && brand.name.trim().length > 0);
  const hasPalette =
    Array.isArray(brand.palette) && brand.palette.filter(Boolean).length > 0;
  const hasProducts =
    Array.isArray(brand.products) && brand.products.length > 0;
  return !(hasName || hasPalette || hasProducts);
}
