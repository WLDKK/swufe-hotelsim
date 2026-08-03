"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { AdminWorkspaceHero } from "@/components/admin/admin-workspace-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getSemesterStatusLabel,
  getTeamMemberRoleLabel,
  getUserRoleLabel,
} from "@/i18n/status-labels";

type PlatformUser = {
  id: string;
  name: string | null;
  email: string;
  role: "STUDENT" | "TEACHER" | "JUDGE" | "SPECTATOR" | "ADMIN";
  studentId: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    teamMembers: number;
    createdSemesters: number;
  };
  teamMembers: Array<{
    id: string;
    role: string;
    class: {
      id: string;
      name: string;
    };
    team: {
      id: string;
      name: string;
      hotelName: string;
    };
  }>;
  createdSemesters: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
  }>;
};

type UsersResponse = {
  users: PlatformUser[];
};

type AdminUsersPanelProps = {
  currentAdminId: string;
};

const selectClassName = "dashboard-select";

const roleBadgeToneMap: Record<
  PlatformUser["role"],
  "default" | "secondary" | "outline"
> = {
  ADMIN: "default",
  TEACHER: "secondary",
  JUDGE: "secondary",
  SPECTATOR: "outline",
  STUDENT: "outline",
};

const adminUsersCopy = {
  "zh-CN": {
    hero: {
      badgeLabel: "管理 / 用户",
      title: "平台用户开通与角色治理",
      description:
        "这个工作区用于统一管理平台账号与角色，因此账号创建与角色调整会立即影响教师、学生和管理端的访问权限。",
      statusTitle: "访问治理",
      statusBody: (
        usersLoading: boolean,
        visibleUsers: number,
        filteredLabel: string,
        searchLabel: string
      ) =>
        `当前目录${usersLoading ? "正在接收实时更新" : `展示 ${visibleUsers} 个可见用户`}，筛选条件为${filteredLabel}，${searchLabel === "无搜索关键词" ? "当前没有附加搜索词。" : `当前搜索词为“${searchLabel}”。`}`,
      summaryLabels: {
        users: "用户",
        admins: "管理员",
        teachers: "教师",
        students: "学生",
      },
      summaryHints: {
        users: (users: number, filteredLabel: string) => `当前可见 ${users} | ${filteredLabel}`,
        admins: "此页面禁止移除当前管理员自己的管理员角色。",
        teachers: "教师角色会影响学期归属与后续教学工作区权限。",
        students: (searchLabel: string) => searchLabel,
      },
      actions: {
        dashboard: "打开总览",
        semesters: "打开学期",
        classes: "打开班级",
      },
    },
    filters: {
      allRoles: "全部角色",
      admin: "管理员",
      teacher: "教师",
      student: "学生",
      noSearch: "无搜索关键词",
      reset: "重置",
      searchPlaceholder: "搜索姓名、邮箱或学号",
    },
    create: {
      title: "创建用户",
      description:
        "新账号创建后会立即具备密码登录能力，方便管理端开通与当前认证链路保持一致。",
      fields: {
        name: "姓名",
        email: "邮箱",
        password: "密码",
        role: "角色",
        studentId: "学号",
      },
      studentPlaceholder: "学生账号建议填写学号",
      optionalPlaceholder: "可选",
      button: "创建用户",
      createSuccess: "新用户已创建，且可以立即登录。",
      createError: "创建用户失败。",
      updateSuccess: "所选用户角色已更新。",
      updateError: "更新用户角色失败。",
    },
    scope: {
      title: "目录范围",
      description: "在批量调整角色时，把当前筛选条件、安全规则和开通上下文始终保留在视野里。",
      visibleUsers: "当前可见用户",
      searchScope: "搜索范围",
      searchHint: "延迟搜索让输入过程保持流畅。",
      safetyRule: "安全规则",
      safetyValue: "当前管理员不能在此页面移除自己的管理员角色",
      provisioning: "开通状态",
      provisioningValue: "新账号创建后即可直接登录",
    },
    directory: {
      title: "用户目录",
      description: "无需离开管理路由组，就可以完成平台账号筛选与角色调整。",
      loading: "正在加载用户目录...",
      loadError: "用户目录加载失败。",
      empty: "当前筛选条件下没有匹配用户。",
      labels: {
        studentId: "学号",
        locale: "语言",
        teamAssignments: "团队归属",
        ownedSemesters: "拥有学期",
        created: "创建时间",
        updated: "更新时间",
        changeRole: "调整角色",
        selfDemote: "当前管理员不能在这里移除自己的管理员角色。",
        saveRole: "保存角色",
        recentAssignments: "最近团队归属",
        recentSemesters: "最近归属学期",
        noAssignments: "这个用户当前没有团队归属记录。",
        noOwnedSemesters: "这个用户暂时还没有归属学期。",
      },
    },
  },
  "en-US": {
    hero: {
      badgeLabel: "Admin / Users",
      title: "Platform user provisioning and role control",
      description:
        "This workspace manages platform accounts and roles, so account creation and role changes immediately affect access across teacher, student, and admin routes.",
      statusTitle: "Access governance",
      statusBody: (
        usersLoading: boolean,
        visibleUsers: number,
        filteredLabel: string,
        searchLabel: string
      ) =>
        `The directory is currently showing ${usersLoading ? "live updates" : `${visibleUsers} visible users`} with ${filteredLabel.toLowerCase()} and ${searchLabel === "No active search" ? "no search term applied." : `search "${searchLabel}" applied.`}`,
      summaryLabels: {
        users: "Users",
        admins: "Admins",
        teachers: "Teachers",
        students: "Students",
      },
      summaryHints: {
        users: (users: number, filteredLabel: string) => `Visible now ${users} | ${filteredLabel}`,
        admins: "Self-demotion is blocked on this screen.",
        teachers: "Teacher access controls semester ownership.",
        students: (searchLabel: string) => searchLabel,
      },
      actions: {
        dashboard: "Open dashboard",
        semesters: "Open semesters",
        classes: "Open classes",
      },
    },
    filters: {
      allRoles: "All roles",
      admin: "Admin",
      teacher: "Teacher",
      student: "Student",
      noSearch: "No active search",
      reset: "Reset",
      searchPlaceholder: "Search name, email, or student ID",
    },
    create: {
      title: "Create user",
      description:
        "New accounts are created with credential login enabled from the start, so seeded auth and admin provisioning stay aligned.",
      fields: {
        name: "Name",
        email: "Email",
        password: "Password",
        role: "Role",
        studentId: "Student ID",
      },
      studentPlaceholder: "Recommended for student accounts",
      optionalPlaceholder: "Optional",
      button: "Create user",
      createSuccess: "The new user has been created and can sign in immediately.",
      createError: "Failed to create the user.",
      updateSuccess: "The selected user role has been updated.",
      updateError: "Failed to update the user role.",
    },
    scope: {
      title: "Directory scope",
      description:
        "Keep the current filter, safety rules, and provisioning context visible while updating roles in bulk.",
      visibleUsers: "Visible users",
      searchScope: "Search scope",
      searchHint: "Deferred search keeps typing responsive.",
      safetyRule: "Safety rule",
      safetyValue: "Current admin cannot remove their own admin role",
      provisioning: "Provisioning",
      provisioningValue: "New accounts can sign in immediately after creation",
    },
    directory: {
      title: "User directory",
      description: "Filter and update platform accounts without leaving the admin route group.",
      loading: "Loading users...",
      loadError: "Failed to load users.",
      empty: "No users match the current filter.",
      labels: {
        studentId: "Student ID",
        locale: "Locale",
        teamAssignments: "Team assignments",
        ownedSemesters: "Owned semesters",
        created: "Created",
        updated: "Updated",
        changeRole: "Change role",
        selfDemote: "Your own admin role cannot be removed from this screen.",
        saveRole: "Save role",
        recentAssignments: "Recent team assignments",
        recentSemesters: "Recent owned semesters",
        noAssignments: "No team assignments are recorded for this user.",
        noOwnedSemesters: "This user does not own any semesters yet.",
      },
    },
  },
} as const;

export function AdminUsersPanel({ currentAdminId }: AdminUsersPanelProps) {
  const { locale } = useLocale();
  const copy = adminUsersCopy[locale];
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | PlatformUser["role"]>("ALL");
  const [createRole, setCreateRole] = useState<PlatformUser["role"]>("STUDENT");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, PlatformUser["role"]>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchInput);

  // Keep a dedicated unfiltered query for the hero metrics so global platform
  // counts stay stable even while the directory itself is filtered or searched.
  const summaryQuery = useQuery({
    queryKey: ["admin-users", "summary"],
    queryFn: () => apiFetch<UsersResponse>("/api/users"),
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", roleFilter, deferredSearch],
    queryFn: () => {
      const params = new URLSearchParams();

      if (roleFilter !== "ALL") {
        params.set("role", roleFilter);
      }

      if (deferredSearch.trim()) {
        params.set("search", deferredSearch.trim());
      }

      const query = params.toString();
      return apiFetch<UsersResponse>(query ? `/api/users?${query}` : "/api/users");
    },
  });

  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data?.users]);
  const summaryUsers = useMemo(
    () => summaryQuery.data?.users ?? [],
    [summaryQuery.data?.users]
  );

  useEffect(() => {
    setRoleDrafts(
      Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<
        string,
        PlatformUser["role"]
      >
    );
  }, [users]);

  const createUserMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
      role: PlatformUser["role"];
      studentId: string;
    }) =>
      apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage(copy.create.createSuccess);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof ApiClientError ? error.message : copy.create.createError
      );
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (payload: { userId: string; role: PlatformUser["role"] }) =>
      apiFetch("/api/users", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setFeedbackTone("success");
      setFeedbackMessage(copy.create.updateSuccess);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof ApiClientError ? error.message : copy.create.updateError
      );
    },
    onSettled: () => {
      setSavingUserId(null);
    },
  });

  const totals = useMemo(
    () => ({
      total: summaryUsers.length,
      admins: summaryUsers.filter((user) => user.role === "ADMIN").length,
      teachers: summaryUsers.filter((user) => user.role === "TEACHER").length,
      students: summaryUsers.filter((user) => user.role === "STUDENT").length,
    }),
    [summaryUsers]
  );
  const usersLoading = summaryQuery.isLoading || usersQuery.isLoading;
  const filteredLabel =
    roleFilter === "ALL"
      ? copy.filters.allRoles
      : locale === "zh-CN"
        ? `${getUserRoleLabel(locale, roleFilter)}`
        : `${roleFilter.toLowerCase()} only`;
  const searchLabel = deferredSearch.trim() || copy.filters.noSearch;

  return (
    <div className="flex flex-col gap-6">
      <AdminWorkspaceHero
        badgeLabel={copy.hero.badgeLabel}
        title={copy.hero.title}
        description={copy.hero.description}
        statusTitle={copy.hero.statusTitle}
        statusBody={copy.hero.statusBody(usersLoading, users.length, filteredLabel, searchLabel)}
        summaryItems={[
          {
            label: copy.hero.summaryLabels.users,
            value: usersLoading ? "..." : String(totals.total),
            hint: copy.hero.summaryHints.users(users.length, filteredLabel),
          },
          {
            label: copy.hero.summaryLabels.admins,
            value: usersLoading ? "..." : String(totals.admins),
            hint: copy.hero.summaryHints.admins,
          },
          {
            label: copy.hero.summaryLabels.teachers,
            value: usersLoading ? "..." : String(totals.teachers),
            hint: copy.hero.summaryHints.teachers,
          },
          {
            label: copy.hero.summaryLabels.students,
            value: usersLoading ? "..." : String(totals.students),
            hint: copy.hero.summaryHints.students(searchLabel),
          },
        ]}
        actions={[
          { href: "/admin/dashboard", label: copy.hero.actions.dashboard, variant: "default" },
          { href: "/admin/semesters", label: copy.hero.actions.semesters },
          { href: "/admin/classes", label: copy.hero.actions.classes },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
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

                await createUserMutation.mutateAsync({
                  name: String(formData.get("name") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  password: String(formData.get("password") ?? ""),
                  role: createRole,
                  studentId: String(formData.get("studentId") ?? ""),
                });

                event.currentTarget.reset();
                setCreateRole("STUDENT");
              }}
            >
              <div>
                <label htmlFor="admin-user-name" className="text-sm font-medium">
                  {copy.create.fields.name}
                </label>
                <Input id="admin-user-name" name="name" required />
              </div>
              <div>
                <label htmlFor="admin-user-email" className="text-sm font-medium">
                  {copy.create.fields.email}
                </label>
                <Input id="admin-user-email" name="email" type="email" required />
              </div>
              <div>
                <label htmlFor="admin-user-password" className="text-sm font-medium">
                  {copy.create.fields.password}
                </label>
                <Input
                  id="admin-user-password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-user-role" className="text-sm font-medium">
                  {copy.create.fields.role}
                </label>
                <select
                  id="admin-user-role"
                  className={selectClassName}
                  value={createRole}
                  onChange={(event) => {
                    setCreateRole(event.target.value as PlatformUser["role"]);
                  }}
                >
                  <option value="STUDENT">{getUserRoleLabel(locale, "STUDENT")}</option>
                  <option value="TEACHER">{getUserRoleLabel(locale, "TEACHER")}</option>
                  <option value="JUDGE">{getUserRoleLabel(locale, "JUDGE")}</option>
                  <option value="SPECTATOR">{getUserRoleLabel(locale, "SPECTATOR")}</option>
                  <option value="ADMIN">{getUserRoleLabel(locale, "ADMIN")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="admin-user-student-id" className="text-sm font-medium">
                  {copy.create.fields.studentId}
                </label>
                <Input
                  id="admin-user-student-id"
                  name="studentId"
                  placeholder={
                    createRole === "STUDENT"
                      ? copy.create.studentPlaceholder
                      : copy.create.optionalPlaceholder
                  }
                />
              </div>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {copy.create.button}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="dashboard-card-surface">
          <CardHeader>
            <CardTitle className="text-xl">{copy.scope.title}</CardTitle>
            <CardDescription>
              {copy.scope.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="dashboard-panel">
              <p className="text-sm text-muted-foreground">{copy.scope.visibleUsers}</p>
              <p className="mt-2 text-2xl font-semibold">
                {usersLoading ? "..." : users.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{filteredLabel}</p>
            </div>
            <div className="dashboard-panel">
              <p className="text-sm text-muted-foreground">{copy.scope.searchScope}</p>
              <p className="mt-2 text-sm font-medium">{searchLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.scope.searchHint}
              </p>
            </div>
            <div className="dashboard-panel">
              <p className="text-sm text-muted-foreground">{copy.scope.safetyRule}</p>
              <p className="mt-2 text-sm font-medium">
                {copy.scope.safetyValue}
              </p>
            </div>
            <div className="dashboard-panel">
              <p className="text-sm text-muted-foreground">{copy.scope.provisioning}</p>
              <p className="mt-2 text-sm font-medium">
                {copy.scope.provisioningValue}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {feedbackMessage ? (
        <Card
          className={
            feedbackTone === "success"
              ? "dashboard-card-success"
              : "dashboard-card-alert"
          }
        >
          <CardContent
            className={
              feedbackTone === "success"
                ? "p-6 text-sm text-emerald-700"
                : "p-6 text-sm text-destructive"
            }
          >
            {feedbackMessage}
          </CardContent>
        </Card>
      ) : null}

      <Card className="dashboard-card-surface">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">{copy.directory.title}</CardTitle>
            <CardDescription>
              {copy.directory.description}
            </CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <Input
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              placeholder={copy.filters.searchPlaceholder}
            />
            <select
              className={selectClassName}
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as "ALL" | PlatformUser["role"]);
              }}
            >
              <option value="ALL">{copy.filters.allRoles}</option>
              <option value="ADMIN">{getUserRoleLabel(locale, "ADMIN")}</option>
              <option value="TEACHER">{getUserRoleLabel(locale, "TEACHER")}</option>
              <option value="JUDGE">{getUserRoleLabel(locale, "JUDGE")}</option>
              <option value="SPECTATOR">{getUserRoleLabel(locale, "SPECTATOR")}</option>
              <option value="STUDENT">{getUserRoleLabel(locale, "STUDENT")}</option>
            </select>
            <Button
              variant="outline"
              type="button"
              className="gap-2"
              onClick={() => {
                setSearchInput("");
                setRoleFilter("ALL");
              }}
            >
              <RotateCcw className="size-4" />
              {copy.filters.reset}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersLoading ? (
            <div className="flex items-center gap-3 p-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.directory.loading}
            </div>
          ) : summaryQuery.error || usersQuery.error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {(usersQuery.error ?? summaryQuery.error) instanceof ApiClientError
                ? ((usersQuery.error ?? summaryQuery.error) as ApiClientError).message
                : copy.directory.loadError}
            </div>
          ) : users.length === 0 ? (
            <div className="dashboard-panel-dashed">
              {copy.directory.empty}
            </div>
          ) : (
            users.map((user) => {
              const nextRole = roleDrafts[user.id] ?? user.role;
              const isSelf = user.id === currentAdminId;
              const wouldSelfDemote = isSelf && nextRole !== "ADMIN";

              return (
                <div
                  key={user.id}
                  className="dashboard-panel"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {user.name ?? user.email}
                        </p>
                        <Badge variant={roleBadgeToneMap[user.role]}>
                          {getUserRoleLabel(locale, user.role)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <span>{copy.directory.labels.studentId} {user.studentId ?? "-"}</span>
                        <span>{copy.directory.labels.locale} {user.locale}</span>
                        <span>{copy.directory.labels.teamAssignments} {user._count.teamMembers}</span>
                        <span>{copy.directory.labels.ownedSemesters} {user._count.createdSemesters}</span>
                        <span>{copy.directory.labels.created} {formatDate(user.createdAt)}</span>
                        <span>{copy.directory.labels.updated} {formatDate(user.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="w-full max-w-sm space-y-3">
                      <div>
                        <label
                          htmlFor={`admin-role-${user.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.directory.labels.changeRole}
                        </label>
                        <select
                          id={`admin-role-${user.id}`}
                          className={selectClassName}
                          value={nextRole}
                          onChange={(event) => {
                            setRoleDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [user.id]: event.target.value as PlatformUser["role"],
                            }));
                          }}
                        >
                          <option value="ADMIN">{getUserRoleLabel(locale, "ADMIN")}</option>
                          <option value="TEACHER">{getUserRoleLabel(locale, "TEACHER")}</option>
                          <option value="JUDGE">{getUserRoleLabel(locale, "JUDGE")}</option>
                          <option value="SPECTATOR">{getUserRoleLabel(locale, "SPECTATOR")}</option>
                          <option value="STUDENT">{getUserRoleLabel(locale, "STUDENT")}</option>
                        </select>
                      </div>
                      {wouldSelfDemote ? (
                        <p className="text-xs text-destructive">
                          {copy.directory.labels.selfDemote}
                        </p>
                      ) : null}
                      <Button
                        className="w-full gap-2"
                        disabled={
                          updateRoleMutation.isPending ||
                          nextRole === user.role ||
                          wouldSelfDemote
                        }
                        onClick={() => {
                          setSavingUserId(user.id);
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role: nextRole,
                          });
                        }}
                      >
                        {updateRoleMutation.isPending && savingUserId === user.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        {copy.directory.labels.saveRole}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        {copy.directory.labels.recentAssignments}
                      </p>
                      <div className="mt-3 space-y-2">
                        {user.teamMembers.length > 0 ? (
                          user.teamMembers.map((teamMember) => (
                            <div
                              key={teamMember.id}
                              className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground"
                            >
                              <p className="font-medium text-foreground">
                                {teamMember.team.name}
                              </p>
                              <p className="mt-1">
                                {teamMember.class.name} |{" "}
                                {getTeamMemberRoleLabel(locale, teamMember.role)}
                              </p>
                              <p className="mt-1">{teamMember.team.hotelName}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                            {copy.directory.labels.noAssignments}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        {copy.directory.labels.recentSemesters}
                      </p>
                      <div className="mt-3 space-y-2">
                        {user.createdSemesters.length > 0 ? (
                          user.createdSemesters.map((semester) => (
                            <div
                              key={semester.id}
                              className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground"
                            >
                              <p className="font-medium text-foreground">
                                {semester.name}
                              </p>
                              <p className="mt-1">
                                {semester.code} | {getSemesterStatusLabel(locale, semester.status)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                            {copy.directory.labels.noOwnedSemesters}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
