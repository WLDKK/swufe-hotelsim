"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Gavel, Layers3, Link2, Megaphone, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type Competition = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: "DRAFT" | "READY" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  stages: Array<{ id: string; name: string; stageOrder: number; status: string; _count: { rounds: number; advancements: number } }>;
  judgeAssignments: Array<{ id: string; judgeId: string; judge: { id: string; name: string | null; email: string } }>;
};

type CompetitionsResponse = { competitions: Competition[] };
type JudgesResponse = { users: Array<{ id: string; name: string | null; email: string; role: string }> };
type ClassesResponse = { classes: Array<{ id: string; name: string; currentRound: number }> };
type RoundsResponse = { rounds: Array<{ id: string; roundNumber: number; status: string; competitionStageId: string | null }> };

const selectClassName = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swufe-red/40";

function formValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function AdminCompetitionsPanel() {
  const queryClient = useQueryClient();
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const competitionsQuery = useQuery({
    queryKey: ["admin-competitions"],
    queryFn: () => apiFetch<CompetitionsResponse>("/api/competitions"),
  });
  const judgesQuery = useQuery({
    queryKey: ["admin-competition-judges"],
    queryFn: () => apiFetch<JudgesResponse>("/api/users?role=JUDGE"),
  });
  const classesQuery = useQuery({
    queryKey: ["admin-competition-classes"],
    queryFn: () => apiFetch<ClassesResponse>("/api/classes"),
  });
  const classes = classesQuery.data?.classes ?? [];
  const activeClassId = selectedClassId || classes[0]?.id || "";
  const roundsQuery = useQuery({
    queryKey: ["admin-competition-rounds", activeClassId],
    queryFn: () => apiFetch<RoundsResponse>(`/api/rounds?classId=${activeClassId}`),
    enabled: Boolean(activeClassId),
  });
  const competitions = useMemo(() => competitionsQuery.data?.competitions ?? [], [competitionsQuery.data]);
  const selectedCompetition = competitions.find((item) => item.id === selectedCompetitionId) ?? competitions[0] ?? null;
  const activeCompetitionId = selectedCompetition?.id ?? "";

  const finish = async (text: string) => {
    setFeedback({ tone: "success", text });
    await queryClient.invalidateQueries({ queryKey: ["admin-competitions"] });
  };
  const fail = (error: unknown) => {
    setFeedback({ tone: "error", text: error instanceof ApiClientError ? error.message : "操作失败，请稍后重试。" });
  };

  const createCompetition = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/competitions", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => finish("赛事已创建。"), onError: fail,
  });
  const createStage = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/competition-stages", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => finish("赛事阶段已添加。"), onError: fail,
  });
  const publishAnnouncement = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/announcements", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => finish("公告已发布到公开端。"), onError: fail,
  });
  const assignJudge = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/judge-assignments", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => finish("评委已分配到赛事。"), onError: fail,
  });
  const linkRound = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiFetch("/api/rounds", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setFeedback({ tone: "success", text: "回合已关联到赛事阶段。" });
      await queryClient.invalidateQueries({ queryKey: ["admin-competition-rounds", activeClassId] });
    },
    onError: fail,
  });
  const updateStatus = useMutation({
    mutationFn: (status: Competition["status"]) => apiFetch("/api/competitions", { method: "PATCH", body: JSON.stringify({ competitionId: activeCompetitionId, status }) }),
    onSuccess: () => finish("赛事状态已更新。"),
    onError: fail,
  });

  const handleCompetitionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createCompetition.mutate({ name: formValue(form, "name"), code: formValue(form, "code").toUpperCase(), description: formValue(form, "description") || undefined, status: "DRAFT" });
  };
  const handleStageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createStage.mutate({ competitionId: activeCompetitionId, name: formValue(form, "name"), stageOrder: Number(formValue(form, "stageOrder")), status: "DRAFT" });
  };
  const handleAnnouncementSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    publishAnnouncement.mutate({ competitionId: activeCompetitionId, title: formValue(form, "title"), content: formValue(form, "content"), isPublished: true });
  };
  const handleJudgeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    assignJudge.mutate({ competitionId: activeCompetitionId, judgeId: formValue(form, "judgeId") });
  };
  const handleRoundLinkSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    linkRound.mutate({ roundId: formValue(form, "roundId"), competitionStageId: formValue(form, "competitionStageId") });
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold tracking-[0.14em] text-swufe-red">COMPETITION OPERATIONS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-swufe-blue">赛事运营</h1>
        <p className="mt-2 max-w-3xl leading-7 text-slate-600">建立赛事与阶段，分配评委并发布公开公告。回合仍由教学模拟控制台关联和运行。</p>
      </header>

      {feedback ? <div role="status" className={feedback.tone === "success" ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"}>{feedback.text}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: CalendarRange, label: "赛事", value: competitions.length, hint: "全部赛事实体" },
          { icon: Layers3, label: "阶段", value: competitions.reduce((sum, item) => sum + item.stages.length, 0), hint: "已配置阶段" },
          { icon: Gavel, label: "评委分配", value: competitions.reduce((sum, item) => sum + item.judgeAssignments.length, 0), hint: "赛事级授权" },
        ].map((metric) => <Card key={metric.label}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-lg bg-red-50 text-swufe-red"><metric.icon className="size-5" /></span><div><p className="text-sm text-slate-500">{metric.label}</p><p className="text-2xl font-bold text-swufe-blue">{metric.value}</p><p className="text-xs text-slate-400">{metric.hint}</p></div></CardContent></Card>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle className="text-xl text-swufe-blue">新建赛事</CardTitle><CardDescription>赛事代码创建后应保持稳定，用于对外识别和审计。</CardDescription></CardHeader>
          <CardContent><form onSubmit={handleCompetitionSubmit} className="space-y-4">
            <div><label htmlFor="competition-name" className="text-sm font-semibold">赛事名称</label><Input id="competition-name" name="name" className="mt-2" required maxLength={160} /></div>
            <div><label htmlFor="competition-code" className="text-sm font-semibold">赛事代码</label><Input id="competition-code" name="code" className="mt-2" required maxLength={80} placeholder="SWUFE-HMC-2026" /></div>
            <div><label htmlFor="competition-description" className="text-sm font-semibold">赛事说明</label><Textarea id="competition-description" name="description" className="mt-2" rows={4} /></div>
            <Button type="submit" disabled={createCompetition.isPending} className="gap-2"><Plus className="size-4" />{createCompetition.isPending ? "创建中…" : "创建赛事"}</Button>
          </form></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl text-swufe-blue">赛事清单</CardTitle><CardDescription>选择赛事后，在下方继续配置阶段、评委与公告。</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {competitionsQuery.isLoading ? <p className="text-sm text-slate-500">正在加载赛事…</p> : competitions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">尚未建立赛事。</p> : competitions.map((competition) => (
              <button key={competition.id} type="button" onClick={() => setSelectedCompetitionId(competition.id)} className={competition.id === activeCompetitionId ? "w-full rounded-lg border border-swufe-red/30 bg-red-50 p-4 text-left" : "w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-swufe-blue">{competition.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{competition.code}</p></div><Badge variant="outline">{competition.status}</Badge></div>
                <div className="mt-3 flex gap-4 text-xs text-slate-500"><span>{competition.stages.length} 个阶段</span><span>{competition.judgeAssignments.length} 名评委</span></div>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      {selectedCompetition ? (
        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm text-slate-500">当前赛事</p><p className="mt-1 text-lg font-bold text-swufe-blue">{selectedCompetition.name} <Badge variant="outline" className="ml-2">{selectedCompetition.status}</Badge></p></div>
              {selectedCompetition.status !== "ARCHIVED" ? <Button type="button" onClick={() => updateStatus.mutate(({ DRAFT: "READY", READY: "ACTIVE", ACTIVE: "COMPLETED", COMPLETED: "ARCHIVED", ARCHIVED: "ARCHIVED" } as const)[selectedCompetition.status])} disabled={updateStatus.isPending}>
                {selectedCompetition.status === "DRAFT" ? "标记准备就绪" : selectedCompetition.status === "READY" ? "正式启动赛事" : selectedCompetition.status === "ACTIVE" ? "完成赛事" : "归档赛事"}
              </Button> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Layers3 className="size-5 text-swufe-red" /><CardTitle className="text-lg text-swufe-blue">添加赛事阶段</CardTitle><CardDescription>{selectedCompetition.name}</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleStageSubmit} className="space-y-4">
              <div><label htmlFor="stage-name" className="text-sm font-semibold">阶段名称</label><Input id="stage-name" name="name" className="mt-2" required placeholder="小组赛" /></div>
              <div><label htmlFor="stage-order" className="text-sm font-semibold">阶段序号</label><Input id="stage-order" name="stageOrder" className="mt-2" type="number" min={1} max={99} defaultValue={selectedCompetition.stages.length + 1} required /></div>
              <Button type="submit" variant="outline" disabled={createStage.isPending}>添加阶段</Button>
            </form></CardContent>
          </Card>

          <Card>
            <CardHeader><ShieldCheck className="size-5 text-swufe-red" /><CardTitle className="text-lg text-swufe-blue">分配赛事评委</CardTitle><CardDescription>分配后，评委只能访问该赛事关联回合。</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleJudgeSubmit} className="space-y-4">
              <div><label htmlFor="judge-id" className="text-sm font-semibold">评委账号</label><select id="judge-id" name="judgeId" className={`${selectClassName} mt-2`} required defaultValue=""><option value="" disabled>选择评委</option>{(judgesQuery.data?.users ?? []).map((judge) => <option key={judge.id} value={judge.id}>{judge.name ?? judge.email} · {judge.email}</option>)}</select></div>
              <Button type="submit" variant="outline" disabled={assignJudge.isPending || judgesQuery.isLoading}>确认分配</Button>
              {selectedCompetition.judgeAssignments.length > 0 ? <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">{selectedCompetition.judgeAssignments.map((item) => <li key={item.id}>{item.judge.name ?? item.judge.email}</li>)}</ul> : null}
            </form></CardContent>
          </Card>

          <Card>
            <CardHeader><Megaphone className="size-5 text-swufe-red" /><CardTitle className="text-lg text-swufe-blue">发布赛事公告</CardTitle><CardDescription>发布后立即进入公开公告时间线。</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div><label htmlFor="announcement-title" className="text-sm font-semibold">标题</label><Input id="announcement-title" name="title" className="mt-2" required maxLength={180} /></div>
              <div><label htmlFor="announcement-content" className="text-sm font-semibold">内容</label><Textarea id="announcement-content" name="content" className="mt-2" rows={5} required maxLength={8000} /></div>
              <Button type="submit" variant="outline" disabled={publishAnnouncement.isPending}>发布公告</Button>
            </form></CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader><Link2 className="size-5 text-swufe-red" /><CardTitle className="text-lg text-swufe-blue">关联比赛回合</CardTitle><CardDescription>只有已关联赛事阶段的回合，才会进入对应评委工作台。已完成回合不可修改。</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleRoundLinkSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <div><label htmlFor="round-class" className="text-sm font-semibold">班级</label><select id="round-class" className={`${selectClassName} mt-2`} value={activeClassId} onChange={(event) => setSelectedClassId(event.target.value)} required>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div><label htmlFor="round-id" className="text-sm font-semibold">待处理回合</label><select id="round-id" name="roundId" className={`${selectClassName} mt-2`} required defaultValue=""><option value="" disabled>选择回合</option>{(roundsQuery.data?.rounds ?? []).filter((round) => round.status === "PENDING").map((round) => <option key={round.id} value={round.id}>第 {round.roundNumber} 回合{round.competitionStageId ? " · 已关联" : ""}</option>)}</select></div>
              <div><label htmlFor="competition-stage-id" className="text-sm font-semibold">赛事阶段</label><select id="competition-stage-id" name="competitionStageId" className={`${selectClassName} mt-2`} required defaultValue=""><option value="" disabled>选择阶段</option>{selectedCompetition.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.stageOrder}. {stage.name}</option>)}</select></div>
              <Button type="submit" variant="outline" disabled={linkRound.isPending || selectedCompetition.stages.length === 0 || !activeClassId}>确认关联</Button>
            </form></CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
