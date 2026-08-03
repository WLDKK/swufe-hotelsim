"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Crown,
  Download,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  UserPlus,
  UserX,
} from "lucide-react";
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
import { getTeamMemberRoleLabel } from "@/i18n/status-labels";
import { useLocale } from "@/i18n/use-locale";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type RosterMember = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    studentId: string | null;
  };
};

type RosterTeam = {
  id: string;
  name: string;
  hotelName: string;
  color: string;
  members: RosterMember[];
};

type AdminTeamRosterClassRecord = {
  id: string;
  name: string;
  currentRound: number;
  maxTeams: number;
  minTeamSize: number;
  maxTeamSize: number;
  teams: RosterTeam[];
};

type StudentSummary = {
  id: string;
  name: string | null;
  email: string;
  role: "STUDENT";
  studentId: string | null;
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
};

type StudentUsersResponse = {
  users: StudentSummary[];
};

type TeamMutationRequest = {
  url: string;
  method: "POST" | "PATCH" | "DELETE";
  payload?: unknown;
  successMessage: string;
};

type RosterCsvMutationResponse = {
  mode: "validate" | "apply";
  summary: {
    teams: number;
    members: number;
    leaders: number;
  };
  preview: Array<{
    teamName: string;
    hotelName: string;
    color: string;
    memberCount: number;
    leaderLabel: string;
  }>;
  replacedTeamCount?: number;
  createdTeamCount?: number;
};

type RosterCsvIssue = {
  rowNumber: number | null;
  field: string | null;
  message: string;
};

const selectClassName =
  "mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function getStudentLabel(student: StudentSummary) {
  return student.name?.trim() || student.studentId || student.email;
}

function sortStudents(students: StudentSummary[], locale: string) {
  return [...students].sort((left, right) =>
    getStudentLabel(left).localeCompare(getStudentLabel(right), locale, {
      sensitivity: "base",
    })
  );
}

function sortMembers(members: RosterMember[], locale: string) {
  return [...members].sort((left, right) => {
    if (left.role === right.role) {
      const leftLabel = left.user.name?.trim() || left.user.studentId || left.user.email;
      const rightLabel =
        right.user.name?.trim() || right.user.studentId || right.user.email;

      return leftLabel.localeCompare(rightLabel, locale, {
        sensitivity: "base",
      });
    }

    if (left.role === "LEADER") {
      return -1;
    }

    if (right.role === "LEADER") {
      return 1;
    }

    return left.role.localeCompare(right.role, locale, {
      sensitivity: "base",
    });
  });
}

// Keep the roster-management copy local to the admin setup console so future
// handoff work can evolve CSV, roster, and mutation messaging in one place
// without threading a large amount of route-specific text through global i18n.
const adminTeamRosterCopy = {
  "zh-CN": {
    notices: {
      rosterUpdateFailed: "名册更新失败。",
      selectCsvFirst: "请先选择 CSV 文件，再执行校验或导入。",
      csvApplied: (replaced: number, created: number) =>
        `CSV 名册已导入完成。已替换 ${replaced} 支原有队伍，并新建 ${created} 支导入队伍。`,
      csvValidated: "CSV 校验通过，请先查看预览摘要，再决定是否导入。",
      csvFailed: "CSV 名册操作失败。",
    },
    overview: {
      title: "管理端名册与队伍管理",
      description:
        "这个仅管理端可见的面板补齐了班级详情里的队伍与名册管理，把队伍创建、成员调整与班级名册维护集中到一起。",
      metrics: {
        teamsConfigured: "已配置队伍",
        assignedStudents: "已分配学生",
        unassignedPool: "未分配池",
        allowedTeamSize: "允许队伍人数",
      },
      teamSizeValue: (min: number, max: number) => `${min} - ${max} 人`,
    },
    guardrails: {
      title: "配置护栏",
      description:
        "这些指标直接映射服务端的名册规则，让管理端在触发 mutation 前就知道当前还能做哪些 setup 动作。",
      rosterMode: "名册模式",
      rosterModeLocked: "轮次开始后锁定",
      rosterModeOpen: "可继续配置",
      remainingTeamSlots: "剩余队伍名额",
      csvReplace: "CSV 替换",
      newTeamCreation: "新建队伍",
      blocked: "已阻止",
      available: "可用",
    },
    csv: {
      title: "批量 CSV 名册工作区",
      description:
        "先导出当前名册、下载规范模板，再对 setup 阶段名册做校验或一键替换，便于后续与教务表格对接。",
      downloadTemplate: "下载模板 CSV",
      exportCurrent: "导出当前名册 CSV",
      uploadLabel: "上传名册 CSV",
      uploadHint: "导入会整体替换本班 setup 名册。一旦轮次开始，系统会阻止该操作。",
      validateButton: "校验 CSV",
      applyButton: "导入到班级",
      selectedFile: (fileName: string) => `已选择文件：${fileName}`,
      noFile: "尚未选择 CSV 文件。",
      summaryTitle: "CSV 校验摘要",
      summaryDescription:
        "建议先校验队伍数、队长数与成员总数，再决定是否覆盖当前名册。这里的预览来自服务端解析器，因此与实际导入规则完全一致。",
      metrics: {
        teams: "队伍",
        members: "成员",
        leaders: "队长",
      },
      previewMembers: (memberCount: number) => `${memberCount} 人`,
      leaderLabel: (leaderLabel: string) => `队长 ${leaderLabel}`,
      issueTitle: (rowNumber: number | null, field: string | null) =>
        `${rowNumber ? `第 ${rowNumber} 行` : "CSV 校验"}${field ? ` / ${field}` : ""}`,
      empty: "先校验一个 CSV 文件，这里会显示导入后的队伍结构预览。",
    },
    create: {
      title: "创建队伍",
      description:
        "从剩余未分配学生里构建新队伍。即使前端提交了极端情况，系统仍会继续校验班级容量、setup 阶段以及最小/最大队伍人数规则。",
      lockedNotice:
        "轮次一旦开始，新队伍就会被刻意阻止，以避免后加入的队伍缺失与其它队伍一致的历史决策轨迹。",
      createSuccess: "新队伍已创建，并同步进入班级名册。",
      fields: {
        teamName: "队伍名称",
        hotelName: "酒店名称",
        accentColor: "标识颜色",
        leader: "队长",
      },
      leaderPlaceholder: "请选择学生队长",
      additionalMembers: "额外成员",
      loadingPool: "正在加载学生池...",
      noUnassigned: "当前没有可分配到本班的新学生。",
      remainingSlots: (remainingTeamSlots: number) =>
        `班级剩余可创建队伍名额：${remainingTeamSlots}`,
      submit: "创建队伍",
    },
    studentPool: {
      title: "可用学生池",
      description: "这里展示的学生可以安全加入当前班级，不会与本班现有成员归属发生冲突。",
      loading: "正在加载学生目录...",
      loadError: "学生目录加载失败。",
      noStudentId: "暂无学号",
      otherClassContext: "其他班级上下文：",
      noMemberships: "目前还没有其它班级归属记录。",
      empty: "当前可见学生都已经加入本班队伍。",
    },
    emptyTeams: "当前班级还没有队伍。先在上方创建首支队伍，名册闭环才会启动。",
    teamCard: {
      members: (memberCount: number) => `${memberCount} 名成员`,
      currentLeader: (leaderLabel: string) => `当前队长 ${leaderLabel}`,
      noLeader: "未设置",
      deleteSuccess: "队伍已从 setup 名册中删除，班级详情已同步刷新。",
      deleteButton: "删除队伍",
      profileSaveSuccess: "队伍资料已更新。",
      profileSaveButton: "保存队伍资料",
      leaderSaveSuccess: "队长设置已更新，班级名册现已同步。",
      leaderField: "队长",
      leaderSaveButton: "保存队长",
      addMemberSuccess: "所选学生已加入队伍。",
      addMemberField: "添加学生",
      addMemberButton: "添加成员",
      noAvailableStudents: "暂无可加入学生",
      leaderReassignHint: "如需移动或移除该学生，请先改派队长。",
      moveTo: "移动到",
      noOtherTeams: "暂无其他队伍",
      moveButton: "移动",
      moveSuccess: "该学生已移动到目标队伍，班级名册已刷新。",
      removeButton: "移除",
      removeSuccess: "该学生已从队伍中移除，名册已刷新。",
      footerNote:
        "队伍删除会在轮次开始后被锁定，以保证后续决策、结果与评分链路的历史一致性。",
      fields: {
        teamName: "队伍名称",
        hotelName: "酒店名称",
        accentColor: "标识颜色",
      },
    },
  },
  "en-US": {
    notices: {
      rosterUpdateFailed: "The roster update failed.",
      selectCsvFirst: "Select a CSV file before validating or applying the roster.",
      csvApplied: (replaced: number, created: number) =>
        `Roster CSV applied successfully. Replaced ${replaced} existing teams with ${created} imported teams.`,
      csvValidated:
        "Roster CSV validation passed. Review the preview summary before applying it.",
      csvFailed: "The CSV roster action failed.",
    },
    overview: {
      title: "Admin roster and team management",
      description:
        "This admin-only surface closes the remaining setup gap inside class detail by keeping team creation and member reshuffling in one roster workflow.",
      metrics: {
        teamsConfigured: "Teams configured",
        assignedStudents: "Assigned students",
        unassignedPool: "Unassigned pool",
        allowedTeamSize: "Allowed team size",
      },
      teamSizeValue: (min: number, max: number) => `${min} - ${max} students`,
    },
    guardrails: {
      title: "Setup guardrails",
      description:
        "These indicators mirror the server-side roster rules so admins can tell at a glance which setup actions are still available before triggering a mutation.",
      rosterMode: "Roster mode",
      rosterModeLocked: "Locked after round start",
      rosterModeOpen: "Setup open",
      remainingTeamSlots: "Remaining team slots",
      csvReplace: "CSV replace",
      newTeamCreation: "New team creation",
      blocked: "Blocked",
      available: "Available",
    },
    csv: {
      title: "Bulk CSV roster workspace",
      description:
        "Export the current class roster, download the canonical CSV template, then validate or replace the setup-phase roster in one batch operation.",
      downloadTemplate: "Download template CSV",
      exportCurrent: "Export current roster CSV",
      uploadLabel: "Upload roster CSV",
      uploadHint:
        "Import replaces the entire setup roster for this class. It is blocked once round processing has started.",
      validateButton: "Validate CSV",
      applyButton: "Apply CSV to class",
      selectedFile: (fileName: string) => `Selected file: ${fileName}`,
      noFile: "No CSV file selected yet.",
      summaryTitle: "CSV validation summary",
      summaryDescription:
        "Validate first to confirm team counts, leaders, and member totals before replacing the live setup roster. The preview is generated from the server-side import parser, so it matches the actual apply contract.",
      metrics: {
        teams: "Teams",
        members: "Members",
        leaders: "Leaders",
      },
      previewMembers: (memberCount: number) => `${memberCount} members`,
      leaderLabel: (leaderLabel: string) => `Leader ${leaderLabel}`,
      issueTitle: (rowNumber: number | null, field: string | null) =>
        `${rowNumber ? `Row ${rowNumber}` : "CSV validation"}${field ? ` / ${field}` : ""}`,
      empty: "Validate a CSV file to preview the imported team structure here.",
    },
    create: {
      title: "Create a team",
      description:
        "Build a new roster from the remaining unassigned students. The system will still enforce class capacity, setup-phase, and min/max team-size rules even if an admin submits an edge case from this form.",
      lockedNotice:
        "New teams are intentionally blocked after round processing starts, so later cohorts do not enter the simulation without the same historical decision trail as the rest of the class.",
      createSuccess: "The new team has been created and synced into the live class roster.",
      fields: {
        teamName: "Team name",
        hotelName: "Hotel name",
        accentColor: "Accent color",
        leader: "Leader",
      },
      leaderPlaceholder: "Select a student leader",
      additionalMembers: "Additional members",
      loadingPool: "Loading the student pool...",
      noUnassigned: "No unassigned students are currently available for this class.",
      remainingSlots: (remainingTeamSlots: number) =>
        `Remaining class team slots: ${remainingTeamSlots}`,
      submit: "Create team",
    },
    studentPool: {
      title: "Available student pool",
      description:
        "Students listed here can be assigned into this class without colliding with an existing in-class membership.",
      loading: "Loading student directory...",
      loadError: "Failed to load the student directory.",
      noStudentId: "No student ID",
      otherClassContext: "Other class context:",
      noMemberships: "No existing class memberships yet.",
      empty: "Every visible student is already placed into a team for this class.",
    },
    emptyTeams: "No teams exist for this class yet. Create the first team above to start the roster workflow.",
    teamCard: {
      members: (memberCount: number) => `${memberCount} members`,
      currentLeader: (leaderLabel: string) => `Current leader ${leaderLabel}`,
      noLeader: "N/A",
      deleteSuccess:
        "The team was deleted from the setup roster and class detail has been refreshed.",
      deleteButton: "Delete team",
      profileSaveSuccess: "Team profile metadata has been updated.",
      profileSaveButton: "Save team profile",
      leaderSaveSuccess:
        "Team leadership has been updated and the class roster is now in sync.",
      leaderField: "Team leader",
      leaderSaveButton: "Save leader",
      addMemberSuccess:
        "The selected student has been added to the team.",
      addMemberField: "Add student",
      addMemberButton: "Add member",
      noAvailableStudents: "No available students",
      leaderReassignHint: "Reassign the leader before attempting to move or remove this student.",
      moveTo: "Move to",
      noOtherTeams: "No other teams available",
      moveButton: "Move",
      moveSuccess: "The student has been moved to the target team and the class roster has refreshed.",
      removeButton: "Remove",
      removeSuccess: "The student has been removed from the team and the roster has refreshed.",
      footerNote:
        "Team deletion is intentionally blocked after round processing begins, so historical decisions and result records stay consistent for downstream reporting and grading.",
      fields: {
        teamName: "Team name",
        hotelName: "Hotel name",
        accentColor: "Accent color",
      },
    },
  },
} as const;

export function AdminTeamRosterManager({
  classRecord,
}: {
  classRecord: AdminTeamRosterClassRecord;
}) {
  const { locale } = useLocale();
  const copy = adminTeamRosterCopy[locale];
  const queryClient = useQueryClient();
  const [createLeaderUserId, setCreateLeaderUserId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSummary, setCsvSummary] = useState<RosterCsvMutationResponse | null>(null);
  const [csvIssues, setCsvIssues] = useState<RosterCsvIssue[]>([]);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const studentsQuery = useQuery({
    queryKey: ["admin-team-roster", "students"],
    queryFn: () => apiFetch<StudentUsersResponse>("/api/users?role=STUDENT"),
  });

  const rosterMutation = useMutation({
    mutationFn: async ({ url, method, payload }: TeamMutationRequest) =>
      apiFetch(url, {
        method,
        body: payload ? JSON.stringify(payload) : undefined,
      }),
    onSuccess: async (_, variables) => {
      setNotice({
        tone: "success",
        message: variables.successMessage,
      });

      // The parent class-detail screen already owns the canonical team roster
      // query. Invalidate that one shared record instead of inventing a second
      // admin-only cache branch that could drift from the teacher view.
      await queryClient.invalidateQueries({
        queryKey: ["teacher-class-detail", classRecord.id],
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : copy.notices.rosterUpdateFailed,
      });
    },
  });

  const csvMutation = useMutation({
    mutationFn: async (mode: "validate" | "apply") => {
      if (!csvFile) {
        throw new Error(copy.notices.selectCsvFirst);
      }

      // Keep file parsing client-side so the route can stay JSON-based and
      // reuse the same validate/apply contract whether the source is an upload,
      // pasted spreadsheet text, or a future drag-and-drop wrapper.
      const csvText = await csvFile.text();
      return apiFetch<RosterCsvMutationResponse>("/api/roster/csv", {
        method: "POST",
        body: JSON.stringify({
          classId: classRecord.id,
          csvText,
          mode,
        }),
      });
    },
    onSuccess: async (data) => {
      setCsvIssues([]);
      setCsvSummary(data);
      setNotice({
        tone: "success",
        message:
          data.mode === "apply"
            ? copy.notices.csvApplied(
                data.replacedTeamCount ?? 0,
                data.createdTeamCount ?? 0
              )
            : copy.notices.csvValidated,
      });

      if (data.mode === "apply") {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["teacher-class-detail", classRecord.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["admin-team-roster", "students"],
          }),
        ]);
      }
    },
    onError: (error) => {
      const issues =
        error instanceof ApiClientError &&
        error.details &&
        typeof error.details === "object" &&
        "issues" in error.details &&
        Array.isArray((error.details as { issues?: unknown }).issues)
          ? ((error.details as { issues: RosterCsvIssue[] }).issues ?? [])
          : [];

      setCsvIssues(issues);
      setNotice({
        tone: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : copy.notices.csvFailed,
      });
    },
  });

  const students = useMemo(
    () => sortStudents(studentsQuery.data?.users ?? [], locale),
    [locale, studentsQuery.data?.users]
  );

  // Treat the current class detail response as the source of truth for in-class
  // occupancy so create/add flows and move/remove flows all work from one
  // consistent roster snapshot after each invalidation.
  const assignedUserIds = useMemo(
    () =>
      new Set(
        classRecord.teams.flatMap((team) => team.members.map((member) => member.user.id))
      ),
    [classRecord.teams]
  );

  const availableStudents = useMemo(
    () => students.filter((student) => !assignedUserIds.has(student.id)),
    [assignedUserIds, students]
  );

  // Mirror the server-side setup gate in the UI so admins can see immediately
  // when bulk replacement and new-team creation are no longer legal.
  const setupLocked = classRecord.currentRound > 0;
  const remainingTeamSlots = Math.max(classRecord.maxTeams - classRecord.teams.length, 0);
  const assignedStudentCount = assignedUserIds.size;
  const otherTeamsLookup = useMemo(
    () =>
      // Precompute move targets once per render so each member row can offer a
      // simple "move to another team" selector without repeating the filter.
      new Map(
        classRecord.teams.map((team) => [
          team.id,
          classRecord.teams.filter((candidate) => candidate.id !== team.id),
        ])
      ),
    [classRecord.teams]
  );

  async function runMutation(request: TeamMutationRequest) {
    // Clear stale feedback before the next request so users only see the
    // result of the current action they just triggered.
    setNotice(null);
    await rosterMutation.mutateAsync(request);
  }

  return (
    <section className="grid gap-4" data-testid="admin-team-roster-manager">
      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.overview.title}</CardTitle>
            <CardDescription>
              {copy.overview.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.overview.metrics.teamsConfigured}
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {classRecord.teams.length} / {classRecord.maxTeams}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.overview.metrics.assignedStudents}
              </p>
              <p className="mt-2 text-2xl font-semibold">{assignedStudentCount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.overview.metrics.unassignedPool}
              </p>
              <p className="mt-2 text-2xl font-semibold">{availableStudents.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.overview.metrics.allowedTeamSize}
              </p>
              <p className="mt-2 text-sm font-medium">
                {copy.overview.teamSizeValue(
                  classRecord.minTeamSize,
                  classRecord.maxTeamSize
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.guardrails.title}</CardTitle>
            <CardDescription>
              {copy.guardrails.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">{copy.guardrails.rosterMode}</p>
              <p className="mt-2 text-lg font-semibold">
                {setupLocked
                  ? copy.guardrails.rosterModeLocked
                  : copy.guardrails.rosterModeOpen}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.guardrails.remainingTeamSlots}
              </p>
              <p className="mt-2 text-lg font-semibold">{remainingTeamSlots}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">{copy.guardrails.csvReplace}</p>
              <p className="mt-2 text-lg font-semibold">
                {setupLocked ? copy.guardrails.blocked : copy.guardrails.available}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {copy.guardrails.newTeamCreation}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {setupLocked ? copy.guardrails.blocked : copy.guardrails.available}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {notice ? (
        <Card
          className={
            notice.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/5 shadow-sm"
              : "border-destructive/40 bg-background/95 shadow-sm"
          }
        >
          <CardContent
            className={`p-4 text-sm ${
              notice.tone === "success" ? "text-emerald-700" : "text-destructive"
            }`}
          >
            {notice.message}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.csv.title}</CardTitle>
            <CardDescription>
              {copy.csv.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <a href="/api/roster/csv?template=true">
                  <Download className="size-4" />
                  {copy.csv.downloadTemplate}
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <a href={`/api/roster/csv?classId=${classRecord.id}`}>
                  <Download className="size-4" />
                  {copy.csv.exportCurrent}
                </a>
              </Button>
            </div>
            <div>
              <label htmlFor="admin-roster-csv-file" className="text-sm font-medium">
                {copy.csv.uploadLabel}
              </label>
              <Input
                id="admin-roster-csv-file"
                type="file"
                accept=".csv,text/csv"
                className="mt-2"
                onChange={(event) => {
                  setCsvSummary(null);
                  setCsvIssues([]);
                  setCsvFile(event.target.files?.[0] ?? null);
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.csv.uploadHint}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!csvFile || csvMutation.isPending}
                onClick={async () => {
                  setNotice(null);
                  await csvMutation.mutateAsync("validate");
                }}
              >
                {csvMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {copy.csv.validateButton}
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={!csvFile || csvMutation.isPending || setupLocked}
                onClick={async () => {
                  setNotice(null);
                  await csvMutation.mutateAsync("apply");
                }}
              >
                {csvMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {copy.csv.applyButton}
              </Button>
            </div>
            {csvFile ? (
              <p className="text-sm text-muted-foreground">
                {copy.csv.selectedFile(csvFile.name)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{copy.csv.noFile}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.csv.summaryTitle}</CardTitle>
            <CardDescription>
              {copy.csv.summaryDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {csvSummary ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.csv.metrics.teams}</p>
                    <p className="mt-2 text-2xl font-semibold">{csvSummary.summary.teams}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.csv.metrics.members}</p>
                    <p className="mt-2 text-2xl font-semibold">{csvSummary.summary.members}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{copy.csv.metrics.leaders}</p>
                    <p className="mt-2 text-2xl font-semibold">{csvSummary.summary.leaders}</p>
                  </div>
                </div>
                {csvSummary.preview.map((team) => (
                  <div
                    key={team.teamName}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{team.teamName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{team.hotelName}</p>
                      </div>
                      <Badge variant="outline">
                        {copy.csv.previewMembers(team.memberCount)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {copy.csv.leaderLabel(team.leaderLabel)}
                    </p>
                  </div>
                ))}
              </>
            ) : csvIssues.length > 0 ? (
              <div className="space-y-2">
                {csvIssues.map((issue, index) => (
                  <div
                    key={`${issue.rowNumber ?? "global"}-${issue.field ?? "form"}-${index}`}
                    className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                  >
                    <p className="font-medium">
                      {copy.csv.issueTitle(issue.rowNumber, issue.field)}
                    </p>
                    <p className="mt-1">{issue.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {copy.csv.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.create.title}</CardTitle>
            <CardDescription>
              {copy.create.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {setupLocked ? (
              <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                {copy.create.lockedNotice}
              </div>
            ) : null}
            <form
              className="grid gap-4"
              data-testid="admin-create-team-form"
              onSubmit={async (event) => {
                event.preventDefault();

                const formData = new FormData(event.currentTarget);
                const leaderUserId = String(formData.get("leaderUserId") ?? "");

                await runMutation({
                  url: "/api/teams",
                  method: "POST",
                  payload: {
                    classId: classRecord.id,
                    name: String(formData.get("name") ?? ""),
                    hotelName: String(formData.get("hotelName") ?? ""),
                    color: String(formData.get("color") ?? ""),
                    leaderUserId,
                    memberUserIds: formData
                      .getAll("memberUserIds")
                      .map((value) => String(value)),
                  },
                  successMessage: copy.create.createSuccess,
                });

                event.currentTarget.reset();
                setCreateLeaderUserId("");
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="admin-team-name" className="text-sm font-medium">
                    {copy.create.fields.teamName}
                  </label>
                  <Input id="admin-team-name" name="name" required />
                </div>
                <div>
                  <label htmlFor="admin-team-hotel-name" className="text-sm font-medium">
                    {copy.create.fields.hotelName}
                  </label>
                  <Input id="admin-team-hotel-name" name="hotelName" required />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[0.5fr_1.5fr]">
                <div>
                  <label htmlFor="admin-team-color" className="text-sm font-medium">
                    {copy.create.fields.accentColor}
                  </label>
                  <Input
                    id="admin-team-color"
                    name="color"
                    type="color"
                    defaultValue="#8B1A1A"
                    className="mt-2 h-11"
                  />
                </div>
                <div>
                  <label htmlFor="admin-team-leader" className="text-sm font-medium">
                    {copy.create.fields.leader}
                  </label>
                  <select
                    id="admin-team-leader"
                    name="leaderUserId"
                    className={selectClassName}
                    required
                    value={createLeaderUserId}
                    onChange={(event) => {
                      setCreateLeaderUserId(event.target.value);
                    }}
                  >
                    <option value="">{copy.create.leaderPlaceholder}</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {getStudentLabel(student)} ({student.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">{copy.create.additionalMembers}</p>
                <div className="mt-2 grid gap-2">
                  {availableStudents.length > 0 ? (
                    availableStudents
                      .filter((student) => student.id !== createLeaderUserId)
                      .map((student) => (
                        <label
                          key={student.id}
                          className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="memberUserIds"
                            value={student.id}
                            className="mt-1 size-4 rounded border-border"
                          />
                          <span className="space-y-1">
                            <span className="block font-medium text-foreground">
                              {getStudentLabel(student)}
                            </span>
                            <span className="block text-muted-foreground">
                              {student.studentId || student.email}
                            </span>
                          </span>
                        </label>
                      ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                      {studentsQuery.isLoading
                        ? copy.create.loadingPool
                        : copy.create.noUnassigned}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {copy.create.remainingSlots(remainingTeamSlots)}
                </p>
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={
                    rosterMutation.isPending ||
                    studentsQuery.isLoading ||
                    studentsQuery.isError ||
                    setupLocked ||
                    availableStudents.length === 0 ||
                    remainingTeamSlots === 0 ||
                    !createLeaderUserId
                  }
                >
                  {rosterMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {copy.create.submit}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{copy.studentPool.title}</CardTitle>
            <CardDescription>
              {copy.studentPool.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {studentsQuery.isLoading ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {copy.studentPool.loading}
              </div>
            ) : studentsQuery.error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {studentsQuery.error instanceof ApiClientError
                  ? studentsQuery.error.message
                  : copy.studentPool.loadError}
              </div>
            ) : availableStudents.length > 0 ? (
              availableStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {getStudentLabel(student)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student.email}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {student.studentId || copy.studentPool.noStudentId}
                    </Badge>
                  </div>
                  {student.teamMembers.length > 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {copy.studentPool.otherClassContext}{" "}
                      {student.teamMembers
                        .map(
                          (membership) =>
                            `${membership.class.name} / ${membership.team.name}`
                        )
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {copy.studentPool.noMemberships}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {copy.studentPool.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {classRecord.teams.length === 0 ? (
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.emptyTeams}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {classRecord.teams.map((team) => {
            const members = sortMembers(team.members, locale);
            const leader = members.find((member) => member.role === "LEADER") ?? null;
            const otherTeams = otherTeamsLookup.get(team.id) ?? [];

            return (
              <Card
                key={team.id}
                className="border-border/70 bg-background/95 shadow-sm"
                data-testid="admin-team-card"
                data-team-name={team.name}
              >
                <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                    </div>
                    <CardDescription>
                      {team.hotelName} | {copy.teamCard.members(members.length)} |{" "}
                      {copy.teamCard.currentLeader(
                        leader?.user.name ||
                          leader?.user.studentId ||
                          leader?.user.email ||
                          copy.teamCard.noLeader
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-destructive"
                    disabled={rosterMutation.isPending || setupLocked}
                    onClick={async () => {
                      await runMutation({
                        url: `/api/teams?teamId=${team.id}`,
                        method: "DELETE",
                        successMessage: copy.teamCard.deleteSuccess,
                      });
                    }}
                  >
                    {rosterMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {copy.teamCard.deleteButton}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <form
                      className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();

                        const formData = new FormData(event.currentTarget);
                        await runMutation({
                          url: "/api/teams",
                          method: "PATCH",
                          payload: {
                            action: "updateMeta",
                            teamId: team.id,
                            name: String(formData.get("name") ?? ""),
                            hotelName: String(formData.get("hotelName") ?? ""),
                            color: String(formData.get("color") ?? ""),
                          },
                          successMessage: copy.teamCard.profileSaveSuccess,
                        });
                      }}
                    >
                      <div>
                        <label
                          htmlFor={`admin-team-name-${team.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.teamCard.fields.teamName}
                        </label>
                        <Input
                          id={`admin-team-name-${team.id}`}
                          name="name"
                          defaultValue={team.name}
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`admin-hotel-name-${team.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.teamCard.fields.hotelName}
                        </label>
                        <Input
                          id={`admin-hotel-name-${team.id}`}
                          name="hotelName"
                          defaultValue={team.hotelName}
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`admin-team-color-${team.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.teamCard.fields.accentColor}
                        </label>
                        <Input
                          id={`admin-team-color-${team.id}`}
                          name="color"
                          type="color"
                          defaultValue={team.color}
                          className="mt-2 h-11"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="gap-2"
                        disabled={rosterMutation.isPending}
                      >
                        {rosterMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        {copy.teamCard.profileSaveButton}
                      </Button>
                    </form>

                    <div className="grid gap-4">
                      <form
                        className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                        onSubmit={async (event) => {
                          event.preventDefault();

                          const formData = new FormData(event.currentTarget);
                          await runMutation({
                            url: "/api/teams",
                            method: "PATCH",
                            payload: {
                              action: "setLeader",
                              teamId: team.id,
                              leaderUserId: String(formData.get("leaderUserId") ?? ""),
                            },
                            successMessage: copy.teamCard.leaderSaveSuccess,
                          });
                        }}
                      >
                        <label
                          htmlFor={`admin-team-leader-${team.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.teamCard.leaderField}
                        </label>
                        <select
                          id={`admin-team-leader-${team.id}`}
                          name="leaderUserId"
                          className={selectClassName}
                          defaultValue={leader?.user.id ?? ""}
                        >
                          {members.map((member) => (
                            <option key={member.user.id} value={member.user.id}>
                              {member.user.name || member.user.studentId || member.user.email}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          variant="outline"
                          className="mt-3 gap-2"
                          disabled={rosterMutation.isPending || members.length === 0}
                        >
                          {rosterMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Crown className="size-4" />
                          )}
                          {copy.teamCard.leaderSaveButton}
                        </Button>
                      </form>

                      <form
                        className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                        onSubmit={async (event) => {
                          event.preventDefault();

                          const formData = new FormData(event.currentTarget);
                          await runMutation({
                            url: "/api/teams",
                            method: "PATCH",
                            payload: {
                              action: "addMember",
                              teamId: team.id,
                              userId: String(formData.get("userId") ?? ""),
                            },
                            successMessage: copy.teamCard.addMemberSuccess,
                          });
                        }}
                      >
                        <label
                          htmlFor={`admin-team-add-member-${team.id}`}
                          className="text-sm font-medium"
                        >
                          {copy.teamCard.addMemberField}
                        </label>
                        <select
                          id={`admin-team-add-member-${team.id}`}
                          name="userId"
                          className={selectClassName}
                          defaultValue={availableStudents[0]?.id ?? ""}
                        >
                          {availableStudents.length > 0 ? (
                            availableStudents.map((student) => (
                              <option key={student.id} value={student.id}>
                                {getStudentLabel(student)} ({student.email})
                              </option>
                            ))
                          ) : (
                            <option value="">{copy.teamCard.noAvailableStudents}</option>
                          )}
                        </select>
                        <Button
                          type="submit"
                          variant="outline"
                          className="mt-3 gap-2"
                          disabled={
                            rosterMutation.isPending ||
                            studentsQuery.isLoading ||
                            studentsQuery.isError ||
                            availableStudents.length === 0
                          }
                        >
                          {rosterMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <UserPlus className="size-4" />
                          )}
                          {copy.teamCard.addMemberButton}
                        </Button>
                      </form>
                    </div>
                  </section>

                  <section className="grid gap-3">
                    {members.map((member) => {
                      const label =
                        member.user.name || member.user.studentId || member.user.email;

                      return (
                        <div
                          key={member.id}
                          className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{label}</p>
                                <Badge variant="outline">
                                  {getTeamMemberRoleLabel(locale, member.role)}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {member.user.studentId || member.user.email}
                              </p>
                            </div>
                            {member.role === "LEADER" ? (
                              <p className="text-sm text-muted-foreground">
                                {copy.teamCard.leaderReassignHint}
                              </p>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                <form
                                  className="flex flex-col gap-3 md:flex-row md:items-end"
                                  onSubmit={async (event) => {
                                    event.preventDefault();

                                    const formData = new FormData(event.currentTarget);
                                    await runMutation({
                                      url: "/api/teams",
                                      method: "PATCH",
                                      payload: {
                                        action: "moveMember",
                                        sourceTeamId: team.id,
                                        targetTeamId: String(
                                          formData.get("targetTeamId") ?? ""
                                        ),
                                        userId: member.user.id,
                                      },
                                      successMessage: copy.teamCard.moveSuccess,
                                    });
                                  }}
                                >
                                  <div>
                                    <label
                                      htmlFor={`admin-team-move-${team.id}-${member.id}`}
                                      className="text-sm font-medium"
                                    >
                                      {copy.teamCard.moveTo}
                                    </label>
                                    <select
                                      id={`admin-team-move-${team.id}-${member.id}`}
                                      name="targetTeamId"
                                      className={selectClassName}
                                      defaultValue={otherTeams[0]?.id ?? ""}
                                    >
                                      {otherTeams.length > 0 ? (
                                        otherTeams.map((otherTeam) => (
                                          <option key={otherTeam.id} value={otherTeam.id}>
                                            {otherTeam.name}
                                          </option>
                                        ))
                                      ) : (
                                        <option value="">{copy.teamCard.noOtherTeams}</option>
                                      )}
                                    </select>
                                  </div>
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    className="gap-2"
                                    disabled={
                                      rosterMutation.isPending || otherTeams.length === 0
                                    }
                                  >
                                    {rosterMutation.isPending ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <ArrowRightLeft className="size-4" />
                                    )}
                                    {copy.teamCard.moveButton}
                                  </Button>
                                </form>

                                <Button
                                  type="button"
                                  variant="outline"
                                  className="gap-2 text-destructive"
                                  disabled={rosterMutation.isPending}
                                  onClick={async () => {
                                    await runMutation({
                                      url: "/api/teams",
                                      method: "PATCH",
                                      payload: {
                                        action: "removeMember",
                                        teamId: team.id,
                                        userId: member.user.id,
                                      },
                                      successMessage: copy.teamCard.removeSuccess,
                                    });
                                  }}
                                >
                                  {rosterMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <UserX className="size-4" />
                                  )}
                                  {copy.teamCard.removeButton}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>

                  <p className="text-xs text-muted-foreground">
                    {copy.teamCard.footerNote}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </section>
  );
}
