"use client";

import { useEffect } from "react";
import { ApplicationErrorState } from "@/components/layout/application-error-state";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ message: "route boundary error", digest: error.digest ?? null }));
  }, [error]);

  return <ApplicationErrorState reset={reset} />;
}
