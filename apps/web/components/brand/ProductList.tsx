"use client";

import { useId } from "react";

import type { BrandProduct } from "@cie/shared-types";

interface ProductListProps {
  products: BrandProduct[];
  onChange: (next: BrandProduct[]) => void;
}

function genId(): string {
  // crypto.randomUUID is available in modern browsers + node 19+
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function ProductList({ products, onChange }: ProductListProps) {
  const baseId = useId();

  const updateAt = (index: number, patch: Partial<BrandProduct>): void => {
    const next = products.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  };

  const removeAt = (index: number): void => {
    onChange(products.filter((_, i) => i !== index));
  };

  const addNew = (): void => {
    onChange([...products, { id: genId(), name: "", sku: "" }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No products yet.</p>
      ) : null}

      {products.map((product, i) => {
        const nameId = `${baseId}-name-${i}`;
        const skuId = `${baseId}-sku-${i}`;
        return (
          <div
            key={product.id}
            className="hc-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 flex-col">
              <label htmlFor={nameId} className="text-muted-foreground text-xs">
                Name
              </label>
              <input
                id={nameId}
                value={product.name}
                onChange={(e) => updateAt(i, { name: e.target.value })}
                className="rounded border px-2 py-1 text-sm"
                placeholder="Storm Runner"
              />
            </div>
            <div className="flex w-full flex-col sm:w-40">
              <label htmlFor={skuId} className="text-muted-foreground text-xs">
                SKU
              </label>
              <input
                id={skuId}
                value={product.sku ?? ""}
                onChange={(e) => updateAt(i, { sku: e.target.value })}
                className="rounded border px-2 py-1 text-sm font-mono"
                placeholder="SR-2026"
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${product.name || "product"}`}
              className="hc-pill border-destructive text-destructive hover:bg-destructive/5 self-end rounded-full border px-3 py-1 text-xs sm:self-center"
            >
              Remove
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addNew}
        className="hc-pill self-start rounded-full border px-4 py-1.5 text-sm hover:bg-muted"
      >
        + Add product
      </button>
    </div>
  );
}

export default ProductList;
