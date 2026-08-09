import type { Metadata } from "next";
import { AdminCompetitionsPanel } from "@/components/admin/admin-competitions-panel";

export const metadata: Metadata = { title: "赛事运营" };

export default function AdminCompetitionsPage() {
  return <AdminCompetitionsPanel />;
}
