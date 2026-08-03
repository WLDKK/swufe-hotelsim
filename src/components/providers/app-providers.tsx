"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiClientError } from "@/lib/api/client";

export function AppProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Keep one QueryClient instance per browser session so later dashboard and
  // simulator pages can share cache without recreating it on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 45_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // Avoid retrying known client failures such as validation or
              // permission issues, while still smoothing over short-lived
              // network and 5xx problems for dashboard reads.
              if (
                error instanceof ApiClientError &&
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 429
              ) {
                return false;
              }

              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
