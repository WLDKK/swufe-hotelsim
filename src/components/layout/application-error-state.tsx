"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApplicationErrorStateProps = {
  title?: string;
  description?: string;
  reset?: () => void;
};

export function ApplicationErrorState({
  title = "页面暂时无法加载",
  description = "系统已经记录本次异常。你可以重试，或返回首页继续使用其他功能。",
  reset,
}: ApplicationErrorStateProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-swufe-cream px-5 py-12">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10" role="alert">
        <span className="grid size-12 place-items-center rounded-lg bg-red-50 text-swufe-red"><AlertTriangle className="size-6" /></span>
        <h1 className="mt-6 text-2xl font-bold text-swufe-blue">{title}</h1>
        <p className="mt-3 leading-7 text-slate-600">{description}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {reset ? <Button onClick={reset} className="gap-2"><RefreshCw className="size-4" />重新加载</Button> : null}
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>返回首页</Link>
        </div>
      </section>
    </main>
  );
}
