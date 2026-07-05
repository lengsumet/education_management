"use client";

import { useEffect } from "react";

/**
 * Self-heals the "page renders unstyled after Back" bug. It happens when a
 * build asset (a CSS/JS chunk) referenced by a page in the browser's history no
 * longer exists — e.g. the app was redeployed (or rebuilt in dev) while the tab
 * stayed open, so the old hashed chunk 404s and no styles load.
 *
 * We listen (capture phase) for resource load errors on <link>/<script> pointing
 * at /_next/static. When one fails we do a single full reload, which re-fetches
 * the current HTML referencing the CURRENT chunk hashes. A sessionStorage
 * one-shot guard (cleared on the next successful load) prevents reload loops.
 */
export function AssetReloadGuard() {
  useEffect(() => {
    const KEY = "asset-reload-once";

    const onError = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const isStylesheet = t.tagName === "LINK" && (t as HTMLLinkElement).rel === "stylesheet";
      const isScript = t.tagName === "SCRIPT";
      const url = (t as HTMLLinkElement).href || (t as HTMLScriptElement).src || "";
      if ((isStylesheet || isScript) && url.includes("/_next/static")) {
        if (!sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, "1");
          window.location.reload();
        }
      }
    };

    const clearGuard = () => {
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    };

    window.addEventListener("error", onError, true); // capture: resource errors don't bubble
    window.addEventListener("load", clearGuard);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("load", clearGuard);
    };
  }, []);

  return null;
}
