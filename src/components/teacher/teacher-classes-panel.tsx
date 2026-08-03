"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus, RotateCcw } from "lucide-react";
import { TeacherWorkspaceHero } from "@/components/teacher/teacher-workspace-hero";
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
import { getClassStatusLabel } from "@/i18n/status-labels";
import { cn } from "@/lib/utils";

type SemesterOption = {
  id: string;
  name: string;
  code: string;
  status: string;
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

const selectClassName = "dashboard-select";

const teacherClassesCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "教师 / 班级",
      title: "班级目录与配置入口",
      description:
        "这个页面汇总班级列表，并复用学期筛选与创建流程，让教师端班级配置保持连贯。",
      statusTitle: "班级配置通道",
      filteredStatus:
        "当前视图已经聚焦到单个学期，便于教师围绕同一批班级连续完成创建、筛查与后续操作。",
      allStatus:
        "当前视图横跨全部可访问学期，适合先做教学负载总览，再进入班级详情、模拟或评分。",
      summaryLabels: {
        visible: "可见班级",
        active: "进行中",
        setup: "待配置",
        semesters: "学期",
      },
      summaryHints: {
        visibleFiltered: "按当前学期筛选后的结果。",
        visibleAll: "跨全部学期的结果。",
        active: "当前已经进入模拟循环的班级。",
        setup: "仍可继续 roster 与初始化配置的班级。",
        semesters: "可用于筛选和创建的学期选项数。",
      },
      actions: {
        dashboard: "打开总览",
        semesters: "打开学期",
        simulation: "打开模拟",
        grading: "打开评分",
      },
    },
    filter: {
      title: "筛选班级",
      description: "学期筛选保持在当前页面内完成，便于快速切换不同教学窗口下的班级目录。",
      label: "按学期筛选",
      allSemesters: "全部学期",
      reset: "重置",
    },
    create: {
      title: "创建班级",
      description: "这个表单会创建新班级，并遵守学期归属校验。",
      fields: {
        semester: "学期",
        selectSemester: "选择学期",
        name: "班级名称",
        joinCode: "加入码",
        maxTeams: "最大团队数",
        totalRooms: "总房量",
        minTeamSize: "最小团队人数",
        maxTeamSize: "最大团队人数",
        maxRounds: "最大轮次数",
      },
      error: "创建班级失败。",
      button: "创建班级",
    },
    loading: "正在加载班级列表...",
    loadError: "班级列表加载失败。",
    empty: "当前筛选条件下还没有班级。",
    card: {
      joinCode: "加入码",
      round: "轮次",
      teams: "团队",
      members: "成员",
      roundsCreated: "已创建轮次",
      teamSize: "团队人数",
      openDetail: "打开班级详情",
    },
  },
  "en-US": {
    hero: {
      badgeLabel: "Teacher / Classes",
      title: "Live class directory and setup",
      description:
        "This page brings class data together and reuses semester filtering and creation so the teacher class setup flow stays consistent.",
      statusTitle: "Class setup lane",
      filteredStatus:
        "The current view is filtered to one semester so the teacher can stay focused on one cohort family while creating and reviewing classes.",
      allStatus:
        "The current view spans every accessible semester, which is useful for broad workload review before jumping into detail, simulation, or grading.",
      summaryLabels: {
        visible: "Visible classes",
        active: "Active",
        setup: "Setup",
        semesters: "Semesters",
      },
      summaryHints: {
        visibleFiltered: "Filtered by the selected semester.",
        visibleAll: "Across all semesters.",
        active: "Classes currently running inside the simulation cycle.",
        setup: "Classes still safe for roster and initialization work.",
        semesters: "Teacher-accessible semester options available for creation and filtering.",
      },
      actions: {
        dashboard: "Open dashboard",
        semesters: "Open semesters",
        simulation: "Open simulation",
        grading: "Open grading",
      },
    },
    filter: {
      title: "Filter classes",
      description:
        "Semester filtering stays local to the page so the class directory can pivot quickly without a route change.",
      label: "Filter by semester",
      allSemesters: "All semesters",
      reset: "Reset",
    },
    create: {
      title: "Create class",
      description:
        "The form creates a new class and respects semester ownership checks.",
      fields: {
        semester: "Semester",
        selectSemester: "Select a semester",
        name: "Class name",
        joinCode: "Join code",
        maxTeams: "Max teams",
        totalRooms: "Total rooms",
        minTeamSize: "Min team size",
        maxTeamSize: "Max team size",
        maxRounds: "Max rounds",
      },
      error: "Failed to create class.",
      button: "Create class",
    },
    loading: "Loading class data...",
    loadError: "Failed to load classes.",
    empty: "No classes match the current filter yet.",
    card: {
      joinCode: "Join code",
      round: "Round",
      teams: "Teams",
      members: "Members",
      roundsCreated: "Rounds created",
      teamSize: "Team size",
      openDetail: "Open class detail",
    },
  },
} as const;

export function TeacherClassesPanel({
  initialSemesterId,
}: {
  initialSemesterId?: string;
}) {
  const { locale } = useLocale();
  const copy = teacherClassesCopy[locale];
  const queryClient = useQueryClient();
  const [selectedSemesterId, setSelectedSemesterId] = useState(initialSemesterId ?? "");
  const [createSemesterId, setCreateSemesterId] = useState(initialSemesterId ?? "");

  useEffect(() => {
    setSelectedSemesterId(initialSemesterId ?? "");
    setCreateSemesterId(initialSemesterId ?? "");
  }, [initialSemesterId]);

  const semestersQuery = useQuery({
    queryKey: ["teacher-semesters", "options"],
    queryFn: () => apiFetch<SemestersResponse>("/api/semesters"),
  });

  const classesQuery = useQuery({
    queryKey: ["teacher-classes", selectedSemesterId],
    queryFn: () =>
      apiFetch<ClassesResponse>(
        selectedSemesterId
          ? `/api/classes?semesterId=${selectedSemesterId}`
          : "/api/classes"
      ),
  });

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-classes"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-semesters"] }),
      ]);
    },
  });

  const classes = classesQuery.data?.classes ?? [];
  const semesterOptions = semestersQuery.data?.semesters ?? [];
  const activeClasses = classes.filter((courseClass) => courseClass.status === "IN_PROGRESS");
  const setupClasses = classes.filter((courseClass) => courseClass.status === "SETUP");

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
    // The teacher layout already handles the shared page chrome, so this panel
    // stays focused on live class-management content and API interactions.
    <div className="flex flex-col gap-6">
      <TeacherWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={
          selectedSemesterId
            ? copy.hero.filteredStatus
            : copy.hero.allStatus
        }
        summaryItems={[
          {
            label: copy.hero.summaryLabels.visible,
            value: String(classes.length),
            hint: selectedSemesterId
              ? copy.hero.summaryHints.visibleFiltered
              : copy.hero.summaryHints.visibleAll,
          },
          {
            label: copy.hero.summaryLabels.active,
            value: String(activeClasses.length),
            hint: copy.hero.summaryHints.active,
          },
          {
            label: copy.hero.summaryLabels.setup,
            value: String(setupClasses.length),
            hint: copy.hero.summaryHints.setup,
          },
          {
            label: copy.hero.summaryLabels.semesters,
            value: String(semesterOptions.length),
            hint: copy.hero.summaryHints.semesters,
          },
        ]}
        actions={[
          { href: "/teacher/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/teacher/semesters", label: copy.hero.actions.semesters },
          { href: "/teacher/simulation", label: copy.hero.actions.simulation },
          { href: "/teacher/grading", label: copy.hero.actions.grading },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="dashboard-card-surface">
          <CardHeader>
          <CardTitle className="text-xl">{copy.filter.title}</CardTitle>
          <CardDescription>
            {copy.filter.description}
          </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-sm">
              <label htmlFor="class-semester-filter" className="text-sm font-medium">
                {copy.filter.label}
              </label>
              <select
                id="class-semester-filter"
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                type="button"
                onClick={() => {
                  setSelectedSemesterId("");
                  setCreateSemesterId("");
                }}
              >
                <RotateCcw className="size-4" />
                {copy.filter.reset}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card-surface">
          <CardHeader>
          <CardTitle className="text-xl">{copy.create.title}</CardTitle>
          <CardDescription>
            {copy.create.description}
          </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);

                await createClass.mutateAsync({
                  semesterId: createSemesterId,
                  name: String(formData.get("name") ?? ""),
                  joinCode: String(formData.get("joinCode") ?? ""),
                  // Normalize blank numeric inputs before sending the payload so
                  // the API can intentionally fall back to class defaults.
                  maxTeams: getOptionalInteger(formData.get("maxTeams")),
                  minTeamSize: getOptionalInteger(formData.get("minTeamSize")),
                  maxTeamSize: getOptionalInteger(formData.get("maxTeamSize")),
                  totalRooms: getOptionalInteger(formData.get("totalRooms")),
                  maxRounds: getOptionalInteger(formData.get("maxRounds")),
                });

                event.currentTarget.reset();
                setCreateSemesterId(selectedSemesterId);
              }}
            >
              <div>
                <label htmlFor="class-semester" className="text-sm font-medium">
                  {copy.create.fields.semester}
                </label>
                <select
                  id="class-semester"
                  name="semesterId"
                  className={selectClassName}
                  value={createSemesterId}
                  required
                  onChange={(event) => {
                    // Keep the creation form controlled so deep-linked semester
                    // filters and manual form edits never drift out of sync.
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
                <label htmlFor="class-name" className="text-sm font-medium">
                  {copy.create.fields.name}
                </label>
                <Input id="class-name" name="name" required />
              </div>
              <div>
                <label htmlFor="class-join-code" className="text-sm font-medium">
                  {copy.create.fields.joinCode}
                </label>
                <Input id="class-join-code" name="joinCode" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="class-max-teams" className="text-sm font-medium">
                    {copy.create.fields.maxTeams}
                  </label>
                  <Input id="class-max-teams" name="maxTeams" type="number" min="1" />
                </div>
                <div>
                  <label htmlFor="class-total-rooms" className="text-sm font-medium">
                    {copy.create.fields.totalRooms}
                  </label>
                  <Input id="class-total-rooms" name="totalRooms" type="number" min="1" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="class-min-team-size" className="text-sm font-medium">
                    {copy.create.fields.minTeamSize}
                  </label>
                  <Input id="class-min-team-size" name="minTeamSize" type="number" min="1" />
                </div>
                <div>
                  <label htmlFor="class-max-team-size" className="text-sm font-medium">
                    {copy.create.fields.maxTeamSize}
                  </label>
                  <Input id="class-max-team-size" name="maxTeamSize" type="number" min="1" />
                </div>
                <div>
                  <label htmlFor="class-max-rounds" className="text-sm font-medium">
                    {copy.create.fields.maxRounds}
                  </label>
                  <Input id="class-max-rounds" name="maxRounds" type="number" min="1" />
                </div>
              </div>
              {createClass.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {createClass.error instanceof ApiClientError
                    ? createClass.error.message
                    : copy.create.error}
                </div>
              ) : null}
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={createClass.isPending}
              >
                {createClass.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {copy.create.button}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {classesQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : classesQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {classesQuery.error instanceof ApiClientError
              ? classesQuery.error.message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="dashboard-card-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {classes.map((courseClass) => (
            <Card
              key={courseClass.id}
              className="dashboard-card-surface interactive-lift"
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.card.teams}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.teams} / {courseClass.maxTeams}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.card.members}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.teamMembers}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.card.roundsCreated}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {courseClass._count.rounds}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.card.teamSize}</p>
                    <p className="mt-2 text-sm font-medium">
                      {courseClass.minTeamSize} - {courseClass.maxTeamSize}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/teacher/classes/${courseClass.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")}
                >
                  {copy.card.openDetail}
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
