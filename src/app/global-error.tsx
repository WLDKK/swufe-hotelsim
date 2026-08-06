"use client";

import { ApplicationErrorState } from "@/components/layout/application-error-state";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body><ApplicationErrorState title="系统暂时不可用" reset={reset} /></body>
    </html>
  );
}
