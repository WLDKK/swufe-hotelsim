import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-swufe-cream px-5">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-mono text-sm font-bold text-swufe-red">404</p>
        <h1 className="mt-3 text-2xl font-bold text-swufe-blue">没有找到这个页面</h1>
        <p className="mt-3 leading-7 text-slate-600">链接可能已失效，或当前账号没有对应入口。</p>
        <Link href="/" className={buttonVariants({ className: "mt-7" })}>返回首页</Link>
      </section>
    </main>
  );
}
