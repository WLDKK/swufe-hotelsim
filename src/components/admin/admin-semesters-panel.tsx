"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/formatters";
import { useLocale } from "@/i18n/use-locale";
import {
  getClassStatusLabel,
  getSemesterStatusLabel,
  getUserRoleLabel,
} from "@/i18n/status-labels";
import { cn } from "@/lib/utils";

type OwnerOption = {
  id: string;
  name: string | null;
  email: string;
  role: "TEACHER" | "ADMIN";
};

type TeacherUsersResponse = {
  users: OwnerOption[];
};

type SemesterListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  creator: OwnerOption;
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

type AdminSemestersPanelProps = {
  currentAdmin: OwnerOption;
};

const badgeToneMap: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  COMPLETED: "outline",
  ARCHIVED: "outline",
};

const selectClassName = "dashboard-select";

const adminSemestersCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "管理 / 学期",
      title: "学期归属与教学窗口",
      description:
        "管理员可以为自己或教师创建学期，从而把后续班级配置、模拟推进与教学归属都稳定挂到正确的操作者下面。",
      statusTitle: "归属分发",
      statusBody: (ownerLabel: string | null) =>
        ownerLabel
          ? `当前新学期会分配给 ${ownerLabel}，这样后续班级配置和模拟工作流就会落到预期的教师或管理员工作区。`
          : "请先选择一个负责人，再创建下一个学期，避免后续班级配置落到错误工作区。",
      summaryLabels: {
        semesters: "学期",
        active: "进行中",
        classes: "班级",
        owners: "负责人",
      },
      summaryHints: {
        semesters: "当前平台中的教学窗口列表。",
        active: "当前仍在使用中的学期。",
        classes: "这些教学窗口下的下游班级总数。",
        owners: "教师与当前管理员都可以作为新学期负责人。",
      },
      actions: {
        dashboard: "打开总览",
        users: "打开用户",
        classes: "打开班级",
      },
    },
    routing: {
      title: "负责人路由",
      description: "让学期归属保持明确，这样后续教师配置与管理监督才不会串线。",
      selectedOwner: "当前负责人",
      noOwner: "尚未选择负责人",
      ownerPool: "负责人池",
      ownerPoolHint: "教师与当前管理员都可以接收新学期。",
      currentAdmin: "当前管理员",
      teacherOptions: "教师候选数",
    },
    create: {
      title: "创建学期",
      description: "把学期直接分配给负责后续班级与模拟流程的教师或管理员。",
      fields: {
        owner: "负责人",
        selectOwner: "选择负责人",
        name: "名称",
        code: "代码",
        description: "说明",
        startDate: "开始日期",
        endDate: "结束日期",
      },
      error: "创建学期失败。",
      button: "创建学期",
    },
    loading: "正在加载学期与负责人选项...",
    loadError: "学期列表加载失败。",
    noDescription: "当前还没有填写学期说明。",
    owner: "负责人",
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
      badgeLabel: "Admin / Semesters",
      title: "Semester ownership and teaching windows",
      description:
        "Admins can create semesters for themselves or assign them to teachers, keeping downstream class and simulation work aligned with the platform management layer.",
      statusTitle: "Ownership routing",
      statusBody: (ownerLabel: string | null) =>
        ownerLabel
          ? `New semesters will currently be assigned to ${ownerLabel}, keeping later class setup and simulation loops attached to the intended operator.`
          : "Choose an owner before creating the next semester so later class setup lands in the correct teacher or admin workspace.",
      summaryLabels: {
        semesters: "Semesters",
        active: "Active",
        classes: "Classes",
        owners: "Owners",
      },
      summaryHints: {
        semesters: "Teaching windows currently available on the platform.",
        active: "Semesters currently in use.",
        classes: "Downstream class count across all windows.",
        owners: "Teachers plus the current admin self-assign option.",
      },
      actions: {
        dashboard: "Open dashboard",
        users: "Open users",
        classes: "Open classes",
      },
    },
    routing: {
      title: "Owner routing",
      description:
        "Keep semester ownership explicit so later teacher setup and admin oversight stay attached to the intended operator.",
      selectedOwner: "Selected owner",
      noOwner: "No owner selected",
      ownerPool: "Owner pool",
      ownerPoolHint: "Teachers and the current admin can receive new semesters.",
      currentAdmin: "Current admin",
      teacherOptions: "Teacher options",
    },
    create: {
      title: "Create semester",
      description:
        "Assign the semester to the teacher who should own the later class setup and simulation workflow.",
      fields: {
        owner: "Responsible owner",
        selectOwner: "Select an owner",
        name: "Name",
        code: "Code",
        description: "Description",
        startDate: "Start date",
        endDate: "End date",
      },
      error: "Failed to create semester.",
      button: "Create semester",
    },
    loading: "Loading semesters and owner options...",
    loadError: "Failed to load semesters.",
    noDescription: "No semester description has been added yet.",
    owner: "Owner",
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

export function AdminSemestersPanel({
  currentAdmin,
}: AdminSemestersPanelProps) {
  const { locale } = useLocale();
  const copy = adminSemestersCopy[locale];
  const queryClient = useQueryClient();
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const semestersQuery = useQuery({
    queryKey: ["admin-semesters"],
    queryFn: () => apiFetch<SemestersResponse>("/api/semesters"),
  });

  const teachersQuery = useQuery({
    queryKey: ["admin-semester-owners"],
    queryFn: () => apiFetch<TeacherUsersResponse>("/api/users?role=TEACHER"),
  });

  const ownerOptions = useMemo(() => {
    const teachers = teachersQuery.data?.users ?? [];
    const combined = [currentAdmin, ...teachers];

    // The filtered users API only returns teachers here, so add the current
    // admin back in explicitly to preserve self-assignment as a valid path.
    return combined.filter(
      (owner, index, items) => items.findIndex((item) => item.id === owner.id) === index
    );
  }, [currentAdmin, teachersQuery.data?.users]);

  useEffect(() => {
    if (!selectedOwnerId && ownerOptions.length > 0) {
      const teacherOwner = ownerOptions.find((owner) => owner.role === "TEACHER");
      setSelectedOwnerId(teacherOwner?.id ?? ownerOptions[0].id);
    }
  }, [ownerOptions, selectedOwnerId]);

  const createSemester = useMutation({
    mutationFn: (payload: {
      name: string;
      code: string;
      description: string;
      creatorId: string;
      startDate: string;
      endDate: string;
    }) =>
      apiFetch("/api/semesters", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-semesters"] });
    },
  });

  const semesters = semestersQuery.data?.semesters ?? [];
  const totalClasses = semesters.reduce(
    (sum, semester) => sum + semester._count.classes,
    0
  );
  const semestersLoading = semestersQuery.isLoading || teachersQuery.isLoading;
  const selectedOwnerLabel =
    ownerOptions.find((owner) => owner.id === selectedOwnerId)?.name ??
    ownerOptions.find((owner) => owner.id === selectedOwnerId)?.email ??
    null;

  return (
    <div className="flex flex-col gap-6">
      <AdminWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={copy.hero.statusBody(selectedOwnerLabel)}
        summaryItems={[
          {
            label: copy.hero.summaryLabels.semesters,
            value: semestersLoading ? "..." : String(semesters.length),
            hint: copy.hero.summaryHints.semesters,
          },
          {
            label: copy.hero.summaryLabels.active,
            value: semestersLoading
              ? "..."
              : String(
                  semesters.filter((semester) => semester.status === "ACTIVE").length
                ),
            hint: copy.hero.summaryHints.active,
          },
          {
            label: copy.hero.summaryLabels.classes,
            value: semestersLoading ? "..." : String(totalClasses),
            hint: copy.hero.summaryHints.classes,
          },
          {
            label: copy.hero.summaryLabels.owners,
            value: semestersLoading ? "..." : String(ownerOptions.length),
            hint: copy.hero.summaryHints.owners,
          },
        ]}
        actions={[
          { href: "/admin/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/admin/users", label: copy.hero.actions.users },
          { href: "/admin/classes", label: copy.hero.actions.classes },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="dashboard-card-surface">
          <CardHeader>
          <CardTitle className="text-xl">{copy.routing.title}</CardTitle>
          <CardDescription>
            {copy.routing.description}
          </CardDescription>
          </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="dashboard-panel">
            <p className="text-sm text-muted-foreground">{copy.routing.selectedOwner}</p>
            <p className="mt-2 text-sm font-medium">
              {ownerOptions.find((owner) => owner.id === selectedOwnerId)?.name ??
                  ownerOptions.find((owner) => owner.id === selectedOwnerId)?.email ??
                  copy.routing.noOwner}
            </p>
          </div>
          <div className="dashboard-panel">
            <p className="text-sm text-muted-foreground">{copy.routing.ownerPool}</p>
            <p className="mt-2 text-2xl font-semibold">
              {semestersLoading ? "..." : ownerOptions.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                {copy.routing.ownerPoolHint}
              </p>
          </div>
          <div className="dashboard-panel">
            <p className="text-sm text-muted-foreground">{copy.routing.currentAdmin}</p>
            <p className="mt-2 text-sm font-medium">
              {currentAdmin.name ?? currentAdmin.email}
            </p>
          </div>
          <div className="dashboard-panel">
            <p className="text-sm text-muted-foreground">{copy.routing.teacherOptions}</p>
            <p className="mt-2 text-2xl font-semibold">
              {semestersLoading ? "..." : Math.max(ownerOptions.length - 1, 0)}
            </p>
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

                await createSemester.mutateAsync({
                  name: String(formData.get("name") ?? ""),
                  code: String(formData.get("code") ?? ""),
                  description: String(formData.get("description") ?? ""),
                  creatorId: selectedOwnerId,
                  startDate: String(formData.get("startDate") ?? ""),
                  endDate: String(formData.get("endDate") ?? ""),
                });

                event.currentTarget.reset();
              }}
            >
              <div>
                <label htmlFor="admin-semester-owner" className="text-sm font-medium">
                  {copy.create.fields.owner}
                </label>
                <select
                  id="admin-semester-owner"
                  className={selectClassName}
                  value={selectedOwnerId}
                  required
                  onChange={(event) => {
                    setSelectedOwnerId(event.target.value);
                  }}
                >
                  <option value="">{copy.create.fields.selectOwner}</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {(owner.name ?? owner.email) + ` (${getUserRoleLabel(locale, owner.role)})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="admin-semester-name" className="text-sm font-medium">
                  {copy.create.fields.name}
                </label>
                <Input id="admin-semester-name" name="name" required />
              </div>
              <div>
                <label htmlFor="admin-semester-code" className="text-sm font-medium">
                  {copy.create.fields.code}
                </label>
                <Input id="admin-semester-code" name="code" required />
              </div>
              <div>
                <label htmlFor="admin-semester-description" className="text-sm font-medium">
                  {copy.create.fields.description}
                </label>
                <Textarea id="admin-semester-description" name="description" rows={3} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-semester-start" className="text-sm font-medium">
                    {copy.create.fields.startDate}
                  </label>
                  <Input id="admin-semester-start" name="startDate" type="date" />
                </div>
                <div>
                  <label htmlFor="admin-semester-end" className="text-sm font-medium">
                    {copy.create.fields.endDate}
                  </label>
                  <Input id="admin-semester-end" name="endDate" type="date" />
                </div>
              </div>
              {createSemester.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {createSemester.error instanceof ApiClientError
                    ? createSemester.error.message
                    : copy.create.error}
                </div>
              ) : null}
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={createSemester.isPending || !selectedOwnerId}
              >
                {createSemester.isPending ? (
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

      {semestersLoading ? (
        <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : semestersQuery.error || teachersQuery.error ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {(semestersQuery.error ?? teachersQuery.error) instanceof ApiClientError
              ? ((semestersQuery.error ?? teachersQuery.error) as ApiClientError).message
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
                  <p className="text-sm text-muted-foreground">
                    {copy.owner} {semester.creator.name ?? semester.creator.email} (
                    {getUserRoleLabel(locale, semester.creator.role)})
                  </p>
                </div>
                <Link
                  href={`/admin/classes?semesterId=${semester.id}`}
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
                            href={`/admin/classes/${courseClass.id}`}
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
