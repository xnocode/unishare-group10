"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectWorker({ to }: { to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `${to}?${qs}` : to);
  }, [router, searchParams, to]);

  return null;
}

/** Client-safe redirect that preserves query parameters across route aliases under cacheComponents. */
export function QueryRedirect({ to }: { to: string }) {
  return (
    <Suspense fallback={null}>
      <RedirectWorker to={to} />
    </Suspense>
  );
}

