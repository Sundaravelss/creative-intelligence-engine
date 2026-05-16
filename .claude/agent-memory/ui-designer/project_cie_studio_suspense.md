---
name: cie-studio-suspense
description: /studio production build fails without Suspense boundary around useSearchParams
metadata:
  type: project
---

The `/studio` page uses `useSearchParams()` to sync `?adapter=` and `?view=` to URL. In Next 14 App Router, `useSearchParams` triggers a CSR bailout that requires a `<Suspense>` boundary — otherwise `next build` crashes with `useSearchParams() should be wrapped in a suspense boundary`.

**Why:** Next.js prerenders pages by default. `useSearchParams()` must opt out via Suspense.

**How to apply:** When adding any new App Router page that reads search params client-side, structure it as `export default function Page() { return <Suspense fallback={...}><PageInner/></Suspense> }`.
