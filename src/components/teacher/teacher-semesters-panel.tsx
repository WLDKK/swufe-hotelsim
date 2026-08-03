"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus } from "lucide-react";
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
import { formatDate } from "@/lib/formatters";
import { useLocale } from "@/i18n/use-locale";
import {
  getClassStatusLabel,
  getSemesterStatusLabel,
} from "@/i18n/status-labels";
import { cn } from "@/lib/utils";

type SemesterListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  _count: {
    classes: number;
  };
  classes: Array<{
    id: string;
    name: string;
    status: string;
    currentRound: number;
    maxRounds: number;
  }>;
};

type SemestersResponse = {
  semesters: SemesterListItem[];
};

const badgeToneMap: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  COMPLETED: "outline",
  ARCHIVED: "outline",
};

const inputClassName =
  "dashboard-select placeholder:text-muted-foreground";

const teacherSemestersCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "教师 / 学期",
      title: "学期配置与教学窗口",
      description:
        "这个页面帮助教师先把教学窗口配置清楚，再继续向下进入班级创建、轮次推进与评分闭环。",
      statusTitle: "学期配置通道",
      statusBody:
        "总览卡片和创建表单使用同一套学期数据，因此这里的配置结果会直接影响后续班级与模拟工作流。",
      summaryLabels: {
        semesters: "学期",
        classes: "班级",
        active: "进行中",
        inactive: "草稿或归档",
      },
      summaryHints: {
        semesters: "当前教师可访问的全部学期。",
        classes: "这些教学窗口下已挂接的班级总数。",
        active: "当前处于教学进行期的学期。",
        inactive: "还未启用或已经关闭的教学窗口。",
      },
      actions: {
        dashboard: "打开总览",
        classes: "打开班级",
        simulation: "打开模拟",
      },
    },
    createTitle: "创建学期",
    createDescription: "这个表单会直接创建新学期。",
    fields: {
      name: "名称",
      code: "代码",
      description: "说明",
      startDate: "开始日期",
      endDate: "结束日期",
    },
    createError: "创建学期失败。",
    createButton: "创建学期",
    loading: "正在加载学期列表...",
    loadError: "学期列表加载失败。",
    noDescription: "当前还没有填写学期说明。",
    openRelatedClasses: "打开相关班级",
    cards: {
      classes: "班级",
      start: "开始",
      end: "结束",
    },
    classesInSemester: "本学期班级",
    openClass: "打开班级",
    noClasses: "这个学期下还没有挂接任何班级。",
  },
  "en-US": {
    hero: {
      badgeLabel: "Teacher / Semesters",
      title: "Semester management",
      description:
        "This page helps teachers shape teaching windows before moving into class creation, simulation, and grading.",
      statusTitle: "Semester setup lane",
      statusBody:
        "The summary cards and create form share the same semester data source, so this page stays aligned with downstream class and simulation workflows.",
      summaryLabels: {
        semesters: "Semesters",
        classes: "Classes",
        active: "Active",
        inactive: "Draft or archive",
      },
      summaryHints: {
        semesters: "All teacher-accessible semesters currently in the system.",
        classes: "Total classes already attached to those windows.",
        active: "Semesters currently in the active teaching period.",
        inactive: "Windows that still need activation or are already closed.",
      },
      actions: {
        dashboard: "Open dashboard",
        classes: "Open classes",
        simulation: "Open simulation",
      },
    },
    createTitle: "Create semester",
    createDescription: "This form creates a new semester.",
    fields: {
      name: "Name",
      code: "Code",
      description: "Description",
      startDate: "Start date",
      endDate: "End date",
    },
    createError: "Failed to create semester.",
    createButton: "Create semester",
    loading: "Loading semester data...",
    loadError: "Failed to load semesters.",
    noDescription: "No semester description has been added yet.",
    openRelatedClasses: "Open related classes",
    cards: {
      classes: "Classes",
      start: "Start",
      end: "End",
    },
    classesInSemester: "Classes in this semester",
    openClass: "Open class",
    noClasses: "No classes have been attached to this semester yet.",
  },
} as const;

export function TeacherSemestersPanel() {
  const { locale } = useLocale();
  const copy = teacherSemestersCopy[locale];
  const queryClient = useQueryClient();
  const semestersQuery = useQuery({
    queryKey: ["teacher-semesters"],
    queryFn: () => apiFetch<SemestersResponse>("/api/semesters"),
  });
  const createSemester = useMutation({
    mutationFn: (payload: {
      name: string;
      code: string;
      description: string;
      startDate: string;
      endDate: string;
    }) =>
      apiFetch("/api/semesters", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teacher-semesters"] });
    },
  });

  const semesters = semestersQuery.data?.semesters ?? [];
  const totalClasses = semesters.reduce(
    (sum, semester) => sum + semester._count.classes,
    0
  );

  return (
    // The dashboard layout already provides the outer shell, so this component
    // only renders the page body that is specific to semester management.
    <div className="flex flex-col gap-6">
      <TeacherWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={copy.hero.statusBody}
        summaryItems={[
          {
            label: copy.hero.summaryLabels.semesters,
            value: String(semesters.length),
            hint: copy.hero.summaryHints.semesters,
          },
          {
            label: copy.hero.summaryLabels.classes,
            value: String(totalClasses),
            hint: copy.hero.summaryHints.classes,
          },
          {
            label: copy.hero.summaryLabels.active,
            value: String(
              semesters.filter((semester) => semester.status === "ACTIVE").length
            ),
            hint: copy.hero.summaryHints.active,
          },
          {
            label: copy.hero.summaryLabels.inactive,
            value: String(
              semesters.filter((semester) => semester.status !== "ACTIVE").length
            ),
            hint: copy.hero.summaryHints.inactive,
          },
        ]}
        actions={[
          { href: "/teacher/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/teacher/classes", label: copy.hero.actions.classes },
          { href: "/teacher/simulation", label: copy.hero.actions.simulation },
        ]}
      />

      <Card className="dashboard-card-surface">
        <CardHeader>
          <CardTitle className="text-xl">{copy.createTitle}</CardTitle>
          <CardDescription>
            {copy.createDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              await createSemester.mutateAsync({
                name: String(formData.get("name") ?? ""),
                code: String(formData.get("code") ?? ""),
                description: String(formData.get("description") ?? ""),
                startDate: String(formData.get("startDate") ?? ""),
                endDate: String(formData.get("endDate") ?? ""),
              });

              event.currentTarget.reset();
            }}
          >
            <div>
              <label htmlFor="semester-name" className="text-sm font-medium">
                {copy.fields.name}
              </label>
              <Input id="semester-name" name="name" required />
            </div>
            <div>
              <label htmlFor="semester-code" className="text-sm font-medium">
                {copy.fields.code}
              </label>
              <Input id="semester-code" name="code" required />
            </div>
            <div>
              <label htmlFor="semester-description" className="text-sm font-medium">
                {copy.fields.description}
              </label>
              <textarea
                id="semester-description"
                name="description"
                rows={3}
                className={inputClassName}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="semester-start" className="text-sm font-medium">
                  {copy.fields.startDate}
                </label>
                <Input id="semester-start" name="startDate" type="date" />
              </div>
              <div>
                <label htmlFor="semester-end" className="text-sm font-medium">
                  {copy.fields.endDate}
                </label>
                <Input id="semester-end" name="endDate" type="date" />
              </div>
            </div>
            {createSemester.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {createSemester.error instanceof ApiClientError
                  ? createSemester.error.message
                  : copy.createError}
              </div>
            ) : null}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={createSemester.isPending}
            >
              {createSemester.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {copy.createButton}
            </Button>
          </form>
        </CardContent>
      </Card>

      {semestersQuery.isLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : semestersQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {semestersQuery.error instanceof ApiClientError
              ? semestersQuery.error.message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {semesters.map((semester) => (
            <Card
              key={semester.id}
              className="dashboard-card-surface interactive-lift"
            >
              <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={badgeToneMap[semester.status] ?? "outline"}
                      className="w-fit"
                    >
                      {getSemesterStatusLabel(locale, semester.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {semester.code}
                    </span>
                  </div>
                  <CardTitle className="text-2xl">{semester.name}</CardTitle>
                  <CardDescription className="max-w-3xl text-base leading-7">
                    {semester.description || copy.noDescription}
                  </CardDescription>
                </div>
                <Link
                  href={`/teacher/classes?semesterId=${semester.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  {copy.openRelatedClasses}
                  <ArrowRight className="size-4" />
                </Link>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.cards.classes}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {semester._count.classes}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.cards.start}</p>
                    <p className="mt-2 text-sm font-medium">
                      {formatDate(semester.startDate)}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">{copy.cards.end}</p>
                    <p className="mt-2 text-sm font-medium">
                      {formatDate(semester.endDate)}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {copy.classesInSemester}
                  </p>
                  {semester.classes.length > 0 ? (
                    semester.classes.map((courseClass) => (
                      <div
                        key={courseClass.id}
                        className="dashboard-panel"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              {courseClass.name}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {getClassStatusLabel(locale, courseClass.status)} | {locale === "zh-CN" ? "第" : "Round"} {courseClass.currentRound}
                              {locale === "zh-CN" ? " 轮 / " : " / "}
                              {courseClass.maxRounds}
                            </p>
                          </div>
                          <Link
                            href={`/teacher/classes/${courseClass.id}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "gap-2"
                            )}
                          >
                            {copy.openClass}
                            <ArrowRight className="size-4" />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="dashboard-panel-dashed">
                      {copy.noClasses}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
