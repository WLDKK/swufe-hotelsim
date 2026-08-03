"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus, RotateCcw } from "lucide-react";
import { AdminWorkspaceHero } from "@/components/admin/admin-workspace-hero";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { useLocale } from "@/i18n/use-locale";
import {
  getClassStatusLabel,
  getUserRoleLabel,
} from "@/i18n/status-labels";
import { cn } from "@/lib/utils";

type SemesterOption = {
  id: string;
  name: string;
  code: string;
  status: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
    role: "TEACHER" | "ADMIN";
  };
};

type ClassListItem = {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  maxTeams: number;
  minTeamSize: number;
  maxTeamSize: number;
  semester: {
    id: string;
    name: string;
    code: string;
    status: string;
    creator: {
      id: string;
      name: string | null;
      email: string;
      role: "TEACHER" | "ADMIN";
    };
  };
  _count: {
    teams: number;
    rounds: number;
    teamMembers: number;
  };
};

type ClassesResponse = {
  classes: ClassListItem[];
};

type SemestersResponse = {
  semesters: SemesterOption[];
};

const selectClassName =
  "mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const adminClassesCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "管理 / 班级",
      title: "跨学期班级治理",
      description:
        "这个管理页面复用班级数据与创建流程，同时把教师端班级配置能力提升为跨教师、跨学期的总控视角。",
      statusTitle: "目录范围",
      statusBody: (selectedLabel: string, createLabel: string) =>
        `当前班级目录聚焦在 ${selectedLabel}，而创建表单正指向 ${createLabel}。`,
      summaryLabels: {
        visible: "可见班级",
        active: "进行中",
        setup: "待配置",
        teams: "团队",
      },
      summaryHints: {
        visible: (selectedLabel: string) => selectedLabel,
        active: "已经进入模拟循环的班级。",
        setup: "仍处于 roster 与配置阶段的班级。",
        teams: "当前可见班级范围内的团队总数。",
      },
      actions: {
        dashboard: "打开总览",
        users: "打开用户",
        semesters: "打开学期",
      },
    },
    filter: {
      title: "筛选班级",
      description: "把目录限定在某个学期，或一键回到管理员的全局视图。",
      semester: "学期",
      allSemesters: "全部学期",
      listScope: "目录范围",
      createTarget: "创建目标",
      reset: "重置筛选",
    },
    create: {
      title: "创建班级",
      description: "新班级沿用与教师端一致的创建流程，但管理员可以把它挂到任意可访问学期下。",
      fields: {
        semester: "学期",
        selectSemester: "选择学期",
        name: "班级名称",
        joinCode: "加入码",
        maxTeams: "最大团队数",
        minTeamSize: "最小团队人数",
        maxTeamSize: "最大团队人数",
        totalRooms: "总房量",
        maxRounds: "最大轮次数",
      },
      button: "创建",
      error: "创建班级失败。",
    },
    loading: "正在加载班级与学期选项...",
    loadError: "班级列表加载失败。",
    empty: "当前管理员筛选条件下还没有班级。",
    card: {
      joinCode: "加入码",
      round: "轮次",
      owner: "负责人",
      teams: "团队",
      members: "成员",
      roundsCreated: "已创建轮次",
      teamSize: "团队人数",
      openDetail: "打开班级详情",
      semesters: "学期",
    },
    labels: {
      allSemesters: "全部学期",
      noSemesterSelected: "尚未选择学期",
    },
  },
  "en-US": {
    hero: {
      badgeLabel: "Admin / Classes",
      title: "Cross-semester class management",
      description:
        "This admin surface reuses the class data and creation flow while extending the teacher setup experience into cross-teacher oversight.",
      statusTitle: "Directory scope",
      statusBody: (selectedLabel: string, createLabel: string) =>
        `The classes directory is currently scoped to ${selectedLabel}, while the create form is targeting ${createLabel}.`,
      summaryLabels: {
        visible: "Visible classes",
        active: "Active",
        setup: "Setup",
        teams: "Teams",
      },
      summaryHints: {
        visible: (selectedLabel: string) => selectedLabel,
        active: "Classes already running the simulation loop.",
        setup: "Classes still in roster and configuration mode.",
        teams: "Team count across the visible class set.",
      },
      actions: {
        dashboard: "Open dashboard",
        users: "Open users",
        semesters: "Open semesters",
      },
    },
    filter: {
      title: "Filter classes",
      description: "Scope the directory to a semester or reset back to the full admin view.",
      semester: "Semester",
      allSemesters: "All semesters",
      listScope: "List scope",
      createTarget: "Create target",
      reset: "Reset filter",
    },
    create: {
      title: "Create class",
      description:
        "New classes follow the same creation flow used by the teacher workspace, but admins can target any accessible semester.",
      fields: {
        semester: "Semester",
        selectSemester: "Select a semester",
        name: "Class name",
        joinCode: "Join code",
        maxTeams: "Max teams",
        minTeamSize: "Min team size",
        maxTeamSize: "Max team size",
        totalRooms: "Total rooms",
        maxRounds: "Max rounds",
      },
      button: "Create",
      error: "Failed to create class.",
    },
    loading: "Loading classes and semester options...",
    loadError: "Failed to load classes.",
    empty: "No classes match the current admin filter yet.",
    card: {
      joinCode: "Join code",
      round: "Round",
      owner: "Owner",
      teams: "Teams",
      members: "Members",
      roundsCreated: "Rounds created",
      teamSize: "Team size",
      openDetail: "Open class detail",
      semesters: "Semesters",
    },
    labels: {
      allSemesters: "All semesters",
      noSemesterSelected: "No semester selected",
    },
  },
} as const;

export function AdminClassesPanel({
  initialSemesterId,
}: {
  initialSemesterId?: string;
}) {
  const { locale } = useLocale();
  const copy = adminClassesCopy[locale];
  const queryClient = useQueryClient();
  const [selectedSemesterId, setSelectedSemesterId] = useState(initialSemesterId ?? "");
  const [createSemesterId, setCreateSemesterId] = useState(initialSemesterId ?? "");

  useEffect(() => {
    setSelectedSemesterId(initialSemesterId ?? "");
    setCreateSemesterId(initialSemesterId ?? "");
  }, [initialSemesterId]);

  // Keep the list filter and create-form target separate so admins can inspect
  // one semester while intentionally creating the next class in another one.

  const semestersQuery = useQuery({
    queryKey: ["admin-classes", "semesters"],
    queryFn: () => apiFetch<SemestersResponse>("/api/semesters"),
  });

  const classesQuery = useQuery({
    queryKey: ["admin-classes", selectedSemesterId],
    queryFn: () =>
      apiFetch<ClassesResponse>(
        selectedSemesterId
          ? `/api/classes?semesterId=${selectedSemesterId}`
          : "/api/classes"
      ),
  });

  const semesterOptions = useMemo(
    () => semestersQuery.data?.semesters ?? [],
    [semestersQuery.data?.semesters]
  );

  useEffect(() => {
    if (!createSemesterId && semesterOptions.length > 0) {
      setCreateSemesterId(selectedSemesterId || semesterOptions[0].id);
    }
  }, [createSemesterId, selectedSemesterId, semesterOptions]);

  const createClass = useMutation({
    mutationFn: (payload: {
      semesterId: string;
      name: string;
      joinCode: string;
      maxTeams?: number;
      minTeamSize?: number;
      maxTeamSize?: number;
      totalRooms?: number;
      maxRounds?: number;
    }) =>
      apiFetch("/api/classes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      // Class creation changes both the classes directory and semester-level
      // counts, so refresh both query families for consistent admin follow-up.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-classes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-semesters"] }),
      ]);
    },
  });

  const classes = useMemo(
    () => classesQuery.data?.classes ?? [],
    [classesQuery.data?.classes]
  );

  const totals = useMemo(
    () => ({
      classes: classes.length,
      active: classes.filter((courseClass) => courseClass.status === "IN_PROGRESS").length,
      setup: classes.filter((courseClass) => courseClass.status === "SETUP").length,
      teams: classes.reduce((sum, courseClass) => sum + courseClass._count.teams, 0),
    }),
    [classes]
  );
  const classesLoading = classesQuery.isLoading || semestersQuery.isLoading;
  const selectedSemesterLabel =
    semesterOptions.find((semester) => semester.id === selectedSemesterId)?.name ??
    copy.labels.allSemesters;
  const createSemesterLabel =
    semesterOptions.find((semester) => semester.id === createSemesterId)?.name ??
    copy.labels.noSemesterSelected;

  const getOptionalInteger = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={copy.hero.statusBody(selectedSemesterLabel, createSemesterLabel)}
        summaryItems={[
          {
            label: copy.hero.summaryLabels.visible,
            value: classesLoading ? "..." : String(totals.classes),
            hint: copy.hero.summaryHints.visible(selectedSemesterLabel),
          },
          {
            label: copy.hero.summaryLabels.active,
            value: classesLoading ? "..." : String(totals.active),
            hint: copy.hero.summaryHints.active,
          },
          {
            label: copy.hero.summaryLabels.setup,
            value: classesLoading ? "..." : String(totals.setup),
            hint: copy.hero.summaryHints.setup,
          },
          {
            label: copy.hero.summaryLabels.teams,
            value: classesLoading ? "..." : String(totals.teams),
            hint: copy.hero.summaryHints.teams,
          },
        ]}
        actions={[
          { href: "/admin/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/admin/users", label: copy.hero.actions.users },
          { href: "/admin/semesters", label: copy.hero.actions.semesters },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-border/70 bg-background/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{copy.filter.title}</CardTitle>
          <CardDescription>
              {copy.filter.description}
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="admin-class-semester-filter" className="text-sm font-medium">
                {copy.filter.semester}
              </label>
              <select
                id="admin-class-semester-filter"
                className={selectClassName}
                value={selectedSemesterId}
                onChange={(event) => {
                  setSelectedSemesterId(event.target.value);
                }}
              >
                <option value="">{copy.filter.allSemesters}</option>
                {semesterOptions.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name} ({semester.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">{copy.filter.listScope}</p>
                <p className="mt-2 text-sm font-medium">{selectedSemesterLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">{copy.filter.createTarget}</p>
                <p className="mt-2 text-sm font-medium">{createSemesterLabel}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              type="button"
              onClick={() => {
                setSelectedSemesterId("");
                setCreateSemesterId(semesterOptions[0]?.id ?? "");
              }}
            >
              <RotateCcw className="size-4" />
              {copy.filter.reset}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{copy.create.title}</CardTitle>
          <CardDescription>
              {copy.create.description}
          </CardDescription>
        </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);

                await createClass.mutateAsync({
                  semesterId: createSemesterId,
                  name: String(formData.get("name") ?? ""),
                  joinCode: String(formData.get("joinCode") ?? ""),
                  maxTeams: getOptionalInteger(formData.get("maxTeams")),
                  minTeamSize: getOptionalInteger(formData.get("minTeamSize")),
                  maxTeamSize: getOptionalInteger(formData.get("maxTeamSize")),
                  totalRooms: getOptionalInteger(formData.get("totalRooms")),
                  maxRounds: getOptionalInteger(formData.get("maxRounds")),
                });

                event.currentTarget.reset();
                setCreateSemesterId(selectedSemesterId || (semesterOptions[0]?.id ?? ""));
              }}
            >
              <div>
                <label htmlFor="admin-class-semester" className="text-sm font-medium">
                  {copy.create.fields.semester}
                </label>
                <select
                  id="admin-class-semester"
                  className={selectClassName}
                  value={createSemesterId}
                  required
                  onChange={(event) => {
                    setCreateSemesterId(event.target.value);
                  }}
                >
                  <option value="">{copy.create.fields.selectSemester}</option>
                  {semesterOptions.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name} ({semester.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="admin-class-name" className="text-sm font-medium">
                  {copy.create.fields.name}
                </label>
                <Input id="admin-class-name" name="name" required />
              </div>
              <div>
                <label htmlFor="admin-class-join-code" className="text-sm font-medium">
                  {copy.create.fields.joinCode}
                </label>
                <Input id="admin-class-join-code" name="joinCode" />
              </div>
              <div>
                <label htmlFor="admin-class-max-teams" className="text-sm font-medium">
                  {copy.create.fields.maxTeams}
                </label>
                <Input id="admin-class-max-teams" name="maxTeams" type="number" min="1" />
              </div>
              <Button
                type="submit"
                className="mt-7 gap-2"
                disabled={createClass.isPending || !createSemesterId}
              >
                {createClass.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {copy.create.button}
              </Button>
              <div>
                <label htmlFor="admin-class-min-team-size" className="text-sm font-medium">
                  {copy.create.fields.minTeamSize}
                </label>
                <Input
                  id="admin-class-min-team-size"
                  name="minTeamSize"
                  type="number"
                  min="1"
                />
              </div>
              <div>
                <label htmlFor="admin-class-max-team-size" className="text-sm font-medium">
                  {copy.create.fields.maxTeamSize}
                </label>
                <Input
                  id="admin-class-max-team-size"
                  name="maxTeamSize"
                  type="number"
                  min="1"
                />
              </div>
              <div>
                <label htmlFor="admin-class-total-rooms" className="text-sm font-medium">
                  {copy.create.fields.totalRooms}
                </label>
                <Input id="admin-class-total-rooms" name="totalRooms" type="number" min="1" />
              </div>
              <div>
                <label htmlFor="admin-class-max-rounds" className="text-sm font-medium">
                  {copy.create.fields.maxRounds}
                </label>
                <Input id="admin-class-max-rounds" name="maxRounds" type="number" min="1" />
              </div>
            </form>
            {createClass.error ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {createClass.error instanceof ApiClientError
                  ? createClass.error.message
                  : copy.create.error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {classesLoading ? (
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : classesQuery.error || semestersQuery.error ? (
        <Card className="border-destructive/40 bg-background/95 shadow-sm">
          <CardContent className="p-6 text-sm text-destructive">
            {(classesQuery.error ?? semestersQuery.error) instanceof ApiClientError
              ? ((classesQuery.error ?? semestersQuery.error) as ApiClientError).message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {classes.map((courseClass) => (
            <Card
              key={courseClass.id}
              className="border-border/70 bg-background/95 shadow-sm"
              // Keep a stable class-level hook here so disposable E2E can open
              // a known seeded class without depending on card order.
              data-testid="admin-class-card"
              data-class-name={courseClass.name}
            >
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {getClassStatusLabel(locale, courseClass.status)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {courseClass.semester.name}
                  </span>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{courseClass.name}</CardTitle>
                  <CardDescription className="text-base leading-7">
                    {copy.card.joinCode} <code>{courseClass.joinCode}</code> | {copy.card.round}{" "}
                    {courseClass.currentRound} / {courseClass.maxRounds}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground">
                    {copy.card.owner} {courseClass.semester.creator.name ?? courseClass.semester.creator.email} (
                    {getUserRoleLabel(locale, courseClass.semester.creator.role)})
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.card.teams}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.teams} / {courseClass.maxTeams}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.card.members}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.teamMembers}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.card.roundsCreated}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.rounds}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.card.teamSize}</p>
                    <p className="mt-2 text-sm font-medium">
                      {courseClass.minTeamSize} - {courseClass.maxTeamSize}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/classes/${courseClass.id}`}
                    className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
                  >
                    {copy.card.openDetail}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/admin/semesters"
                    className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                  >
                    {copy.card.semesters}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
