"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, PlayCircle, Rocket } from "lucide-react";
import { AdminTeamRosterManager } from "@/components/admin/admin-team-roster-manager";
import { AdminWorkspaceHero } from "@/components/admin/admin-workspace-hero";
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
import {
  getClassStatusLabel,
  getDecisionStatusLabel,
  getRoundStatusLabel,
  getTeamMemberRoleLabel,
} from "@/i18n/status-labels";
import { useLocale } from "@/i18n/use-locale";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { getProcessReadiness } from "@/lib/simulation/process-readiness";
import { cn } from "@/lib/utils";

type ClassDetail = {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  totalRooms: number;
  maxTeams: number;
  minTeamSize: number;
  maxTeamSize: number;
  semester: {
    id: string;
    name: string;
    code: string;
  };
  teams: Array<{
    id: string;
    name: string;
    hotelName: string;
    color: string;
    members: Array<{
      id: string;
      role: string;
      user: {
        id: string;
        name: string | null;
        email: string;
        studentId: string | null;
      };
    }>;
    hotelState: {
      cashBalance: number;
      totalDebt: number;
      brandReputation: number;
      guestSatisfaction: number;
      esgScore: number;
    } | null;
  }>;
  rounds: Array<{
    id: string;
    roundNumber: number;
    status: string;
    deadline: string | null;
    processedAt: string | null;
  }>;
};

type ClassResponse = {
  class: ClassDetail;
};

type DecisionSummary = {
  id: string;
  status: string;
  team: {
    id: string;
    name: string;
    hotelName: string;
  };
  submittedAt: string | null;
  updatedAt: string;
};

type DecisionListResponse = {
  decisions: DecisionSummary[];
};

type LeaderboardEntry = {
  teamId: string;
  rankOverall: number;
  rankRevenue: number;
  rankProfit: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRevenue: number;
  netProfit: number;
  overallMarketShare: number;
  team: {
    id: string;
    name: string;
    hotelName: string;
    color: string;
  };
};

type ResultRow = {
  team: {
    id: string;
    name: string;
    hotelName: string;
  };
  guestSatisfactionEnd: number;
  esgScoreEnd: number;
  cashBalanceEnd: number;
};

type SimulationResultsResponse = {
  roundNumber: number | null;
  leaderboard: LeaderboardEntry[];
  results: ResultRow[];
};

type TeacherClassDetailPanelProps = {
  classId: string;
  viewer?: "teacher" | "admin";
};

// The Stage 7 delivery baseline keeps the shared class-detail copy local to
// this page because the content is tightly coupled to the teacher/admin
// operations shown below. That makes later handoff edits safer than expanding
// the global message catalog with long, route-specific operational prose.
const teacherClassDetailCopy = {
  "zh-CN": {
    viewer: {
      teacher: {
        badge: "教师 / 班级详情",
        backHref: "/teacher/classes",
        backLabel: "返回班级列表",
        submissionDescription: "教师视角的当前轮次提交状态会集中展示在这里。",
        heroTitlePrefix: "班级实时控制台：",
        heroDescription:
          "这个共享详情页整合班级、决策、结果与运行信息，教师无需跳出当前上下文就能完成初始化、处理轮次与进入评分。",
        statusTitle: "教学闭环",
        setupStatusBody:
          "名册准备完成后即可初始化第 1 轮。在此之前，班级会保持在待配置阶段。",
        pendingStatusBody: (roundNumber: number, submittedCount: number, teamCount: number) =>
          `当前可编辑的是第 ${roundNumber} 轮，已有 ${submittedCount} / ${teamCount} 支队伍完成提交。`,
        lockedStatusBody:
          "当前轮次已经不可编辑。请先查看下方结果与导出数据，再决定下一步处理。",
        summaryLabels: {
          semester: "学期",
          round: "轮次",
          teams: "队伍",
          latestResults: "最新结果",
        },
        roundHint: (roundNumber: number, status: string) =>
          `当前可编辑轮次：第 ${roundNumber} 轮（${status}）`,
        roundPendingHint: "班级尚未初始化到模拟循环。",
        teamsHint: (memberCount: number) => `本班当前共编组 ${memberCount} 名学生。`,
        latestResultsPending: "待生成",
        latestResultsHint: (submittedCount: number, teamCount: number) =>
          `当前提交进度 ${submittedCount} / ${teamCount}`,
        actions: {
          simulation: "打开模拟",
          grading: "打开评分",
          classes: "打开班级",
          dashboard: "打开总览",
        },
      },
      admin: {
        badge: "管理 / 班级详情",
        backHref: "/admin/classes",
        backLabel: "返回管理班级",
        submissionDescription: "管理视角的当前轮次提交状态会集中展示在这里。",
        heroTitlePrefix: "管理视角班级详情：",
        heroDescription:
          "这个共享详情页让管理端与教师端共用同一套班级工作流，同时在下方补上仅管理端可见的 roster 控制台，便于 setup 阶段做最后治理。",
        statusTitle: "配置治理",
        lockedStatusBody:
          "班级已经进入轮次循环。下方仍会展示现有 roster，但批量 CSV 替换与新建队伍等仅限 setup 的动作现已锁定。",
        setupStatusBody:
          "班级仍处于 setup 阶段，管理端可以在这里完成队伍校验、CSV 导入检查，或直接初始化首轮。",
        summaryLabels: {
          status: "状态",
          teams: "队伍",
          students: "学生",
          rosterMode: "名册模式",
        },
        teamsHint: (remainingTeamSlots: number) => `剩余可创建队伍名额 ${remainingTeamSlots}。`,
        studentsHint: "当前已编入所有已配置队伍的学生人数。",
        rosterModeLocked: "已锁定",
        rosterModeOpen: "可配置",
        rosterModeLockedHint: "轮次开始后，新增队伍与 CSV 替换都会被阻止。",
        rosterModeOpenHint: "仅 setup 阶段的 roster 操作仍可继续。",
        actions: {
          classes: "打开班级",
          dashboard: "打开总览",
          semesters: "打开学期",
          users: "打开用户",
        },
      },
    },
    loading: "正在加载班级详情...",
    loadError: "班级详情加载失败。",
    sections: {
      operations: {
        title: "班级操作",
        description:
          "轮次控制、导出以及常用路由入口集中在这里，确保教师端与管理端可以共用同一套详情操作面。",
        metrics: {
          joinCode: "加入码",
          currentRound: "当前轮次",
          submissionState: "提交状态",
          latestResults: "最新结果",
          latestResultsPending: "待生成",
        },
        initializeRound: "初始化第 1 轮",
        processRound: "处理当前轮次",
        exportResultsCsv: "导出结果 CSV",
        exportLeaderboardJson: "导出排行榜 JSON",
        processGateHint:
          "只有当每支队伍在当前轮次都拥有 1 份 `SUBMITTED` 状态的决策后，处理动作才会解锁，这与服务端模拟门禁保持一致。",
      },
      configuration: {
        title: "班级配置",
        description:
          "核心班级元数据与实时操作分开展示，后续交接若要调整 setup 参数，不会误伤上方的轮次处理链路。",
        status: "状态",
        semester: "学期",
        roomsPerHotel: "每家酒店房间数",
        allowedTeamSize: "允许队伍人数",
      },
      simulationError: "模拟动作执行失败。",
      timeline: {
        title: "轮次时间线",
        description: "集中展示轮次、状态与截止时间，便于教师和管理员同步掌握课堂进度。",
        roundLabel: (roundNumber: number) => `第 ${roundNumber} 轮`,
        roundMeta: (deadline: string, processedAt: string) =>
          `截止 ${deadline} | 处理于 ${processedAt}`,
        empty: "这个班级尚未初始化到模拟循环。",
      },
      submissions: {
        title: "当前轮次提交状态",
        progress: "提交进度",
        currentRoundLabel: (roundNumber: number, status: string) =>
          `当前可编辑轮次：第 ${roundNumber} 轮（${status}）`,
        noActiveRound: "当前还没有可用的活动轮次。",
        loading: "正在加载当前轮次决策...",
        updatedAt: (hotelName: string, updatedAt: string) => `${hotelName} | 更新于 ${updatedAt}`,
        empty: "当前轮次还没有记录到任何决策。",
      },
      roster: {
        title: "队伍名册与酒店状态",
        description: "集中展示当前班级的队伍名册与酒店状态。",
        cash: "现金",
        debt: "负债",
        brand: "品牌",
        esg: "ESG",
      },
      results: {
        title: "最近已完成轮次结果",
        description: "这里会展示最近已完成轮次的结果摘要。",
        loading: "正在加载模拟输出...",
        latestCompletedRound: "最近已完成轮次",
        latestCompletedRoundValue: (roundNumber: number) => `第 ${roundNumber} 轮`,
        marketShare: (value: string) => `市场份额 ${value}`,
        revenueProfit: (revenue: string, profit: string) => `收入 ${revenue} | 利润 ${profit}`,
        occupancyAdr: (occupancy: string, adr: string) => `入住率 ${occupancy} | ADR ${adr}`,
        guestSatisfactionEsg: (guestSatisfaction: string, esg: string) =>
          `顾客满意度 ${guestSatisfaction} | ESG ${esg}`,
        empty:
          "当前还没有任何已处理轮次结果。请先初始化班级、收集提交并处理一轮后，这里才会出现结果。",
      },
    },
  },
  "en-US": {
    viewer: {
      teacher: {
        badge: "Teacher / Class Detail",
        backHref: "/teacher/classes",
        backLabel: "Back to classes",
        submissionDescription: "Teacher monitoring for the current round is summarized here.",
        heroTitlePrefix: "Live class control for ",
        heroDescription:
          "This shared detail route keeps class, decision, result, and run information in one place so instructors can move from setup into processing and grading without losing context.",
        statusTitle: "Teaching loop",
        setupStatusBody:
          "Initialize round 1 once the roster is ready. Until then, the class stays in setup mode.",
        pendingStatusBody: (roundNumber: number, submittedCount: number, teamCount: number) =>
          `Round ${roundNumber} is the current editable cycle, with ${submittedCount} of ${teamCount} teams already submitted.`,
        lockedStatusBody:
          "The current round is no longer editable. Review the result outputs and exports below before the next step.",
        summaryLabels: {
          semester: "Semester",
          round: "Round",
          teams: "Teams",
          latestResults: "Latest results",
        },
        roundHint: (roundNumber: number, status: string) =>
          `Editable round ${roundNumber} (${status})`,
        roundPendingHint: "The class has not been initialized yet.",
        teamsHint: (memberCount: number) => `${memberCount} rostered students across the class.`,
        latestResultsPending: "Pending",
        latestResultsHint: (submittedCount: number, teamCount: number) =>
          `Submitted ${submittedCount} / ${teamCount}`,
        actions: {
          simulation: "Open simulation",
          grading: "Open grading",
          classes: "Open classes",
          dashboard: "Open dashboard",
        },
      },
      admin: {
        badge: "Admin / Class Detail",
        backHref: "/admin/classes",
        backLabel: "Back to admin classes",
        submissionDescription: "Admin oversight for the current round is summarized here.",
        heroTitlePrefix: "Admin oversight for ",
        heroDescription:
          "This shared detail route keeps admin oversight on the same class workflow used by teaching operations while adding the admin-only roster console below.",
        statusTitle: "Setup governance",
        lockedStatusBody:
          "The class already entered the round loop. Existing roster edits remain visible below, but setup-only actions such as bulk CSV replacement and new-team creation are now locked.",
        setupStatusBody:
          "The class is still in setup mode, so admins can finalize teams, validate CSV imports, or initialize the first round from this shared detail route.",
        summaryLabels: {
          status: "Status",
          teams: "Teams",
          students: "Students",
          rosterMode: "Roster mode",
        },
        teamsHint: (remainingTeamSlots: number) => `Remaining setup slots ${remainingTeamSlots}.`,
        studentsHint: "Current rostered members across all configured teams.",
        rosterModeLocked: "Locked",
        rosterModeOpen: "Setup open",
        rosterModeLockedHint: "New teams and CSV replace are blocked after round start.",
        rosterModeOpenHint: "Setup-only roster actions are still available.",
        actions: {
          classes: "Open classes",
          dashboard: "Open dashboard",
          semesters: "Open semesters",
          users: "Open users",
        },
      },
    },
    loading: "Loading class detail...",
    loadError: "Failed to load class detail.",
    sections: {
      operations: {
        title: "Class operations",
        description:
          "Round control, exports, and route shortcuts stay grouped here so the detail page can support both teacher and admin viewers without forking the operational surface.",
        metrics: {
          joinCode: "Join code",
          currentRound: "Current round",
          submissionState: "Submission state",
          latestResults: "Latest results",
          latestResultsPending: "Pending",
        },
        initializeRound: "Initialize round 1",
        processRound: "Process current round",
        exportResultsCsv: "Export results CSV",
        exportLeaderboardJson: "Export leaderboard JSON",
        processGateHint:
          "Processing stays locked until every team has one current-round decision in `SUBMITTED` status, matching the server-side simulation gate.",
      },
      configuration: {
        title: "Class configuration",
        description:
          "Core class metadata is kept separate from the live operation controls so later handoff work can evolve setup parameters without touching the round-processing actions above.",
        status: "Status",
        semester: "Semester",
        roomsPerHotel: "Rooms / hotel",
        allowedTeamSize: "Allowed team size",
      },
      simulationError: "Simulation action failed.",
      timeline: {
        title: "Round timeline",
        description: "Live class detail with current round status, deadlines, and result checkpoints.",
        roundLabel: (roundNumber: number) => `Round ${roundNumber}`,
        roundMeta: (deadline: string, processedAt: string) =>
          `Deadline ${deadline} | Processed ${processedAt}`,
        empty: "This class has not been initialized into the simulation cycle yet.",
      },
      submissions: {
        title: "Current round submission state",
        progress: "Submission progress",
        currentRoundLabel: (roundNumber: number, status: string) =>
          `Current editable round: ${roundNumber} (${status})`,
        noActiveRound: "No active round is available yet.",
        loading: "Loading current round decisions...",
        updatedAt: (hotelName: string, updatedAt: string) => `${hotelName} | Updated ${updatedAt}`,
        empty: "No current-round decisions have been recorded yet.",
      },
      roster: {
        title: "Team roster & hotel state",
        description: "Class roster and hotel status are summarized here for quick review.",
        cash: "Cash",
        debt: "Debt",
        brand: "Brand",
        esg: "ESG",
      },
      results: {
        title: "Latest completed round results",
        description: "The latest completed-round outcomes are summarized here.",
        loading: "Loading simulation outputs...",
        latestCompletedRound: "Latest completed round",
        latestCompletedRoundValue: (roundNumber: number) => `Round ${roundNumber}`,
        marketShare: (value: string) => `Market share ${value}`,
        revenueProfit: (revenue: string, profit: string) => `Revenue ${revenue} | Profit ${profit}`,
        occupancyAdr: (occupancy: string, adr: string) => `Occupancy ${occupancy} | ADR ${adr}`,
        guestSatisfactionEsg: (guestSatisfaction: string, esg: string) =>
          `Guest satisfaction ${guestSatisfaction} | ESG ${esg}`,
        empty:
          "No processed round results exist yet. Initialize the class, collect submissions, and process a round to populate this panel.",
      },
    },
  },
} as const;

export function TeacherClassDetailPanel({
  classId,
  viewer = "teacher",
}: TeacherClassDetailPanelProps) {
  const queryClient = useQueryClient();
  const { locale } = useLocale();
  const copy = teacherClassDetailCopy[locale];
  const teacherViewerCopy = copy.viewer.teacher;
  const adminViewerCopy = copy.viewer.admin;
  const classQuery = useQuery({
    queryKey: ["teacher-class-detail", classId],
    queryFn: () => apiFetch<ClassResponse>(`/api/classes?classId=${classId}`),
  });
  const resultsQuery = useQuery({
    queryKey: ["teacher-class-results", classId],
    queryFn: () =>
      apiFetch<SimulationResultsResponse>(`/api/simulation/results?classId=${classId}`),
  });

  const classRecord = classQuery.data?.class;
  const currentRound =
    classRecord?.rounds.find((round) => round.roundNumber === classRecord.currentRound) ??
    null;

  const decisionsQuery = useQuery({
    queryKey: ["teacher-class-decisions", classId, currentRound?.id],
    queryFn: () =>
      apiFetch<DecisionListResponse>(`/api/decisions?roundId=${currentRound?.id}`),
    enabled: Boolean(currentRound?.id),
  });

  const simulationMutation = useMutation({
    mutationFn: (action: "initialize" | "process") =>
      apiFetch("/api/simulation/run", {
        method: "POST",
        body: JSON.stringify({
          classId,
          action,
        }),
      }),
    onSuccess: async () => {
      // Round actions change class metadata, editable decisions, and latest
      // result outputs together, so refresh the full local chain in one place.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-class-detail", classId] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-class-results", classId] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-class-decisions", classId] }),
      ]);
    },
  });

  const decisions = decisionsQuery.data?.decisions ?? [];
  const processReadiness = getProcessReadiness({
    currentRoundStatus: currentRound?.status,
    teamCount: classRecord?.teams.length ?? 0,
    decisionStatuses: decisions.map((decision) => decision.status),
  });
  const submittedCount = processReadiness.submittedCount;
  const totalMembers =
    classRecord?.teams.reduce((sum, team) => sum + team.members.length, 0) ?? 0;
  const latestCompletedRound = resultsQuery.data?.roundNumber ?? null;
  const remainingTeamSlots = classRecord
    ? Math.max(classRecord.maxTeams - classRecord.teams.length, 0)
    : 0;
  const setupLocked = (classRecord?.currentRound ?? 0) > 0;
  const classStatusLabel = getClassStatusLabel(locale, classRecord?.status);
  const currentRoundStatusLabel = getRoundStatusLabel(locale, currentRound?.status);
  const latestResultsLabel = latestCompletedRound
    ? copy.sections.results.latestCompletedRoundValue(latestCompletedRound)
    : copy.sections.operations.metrics.latestResultsPending;

  return (
    // The teacher dashboard layout supplies the outer shell. This component
    // focuses on the live class detail, round control, and Stage 3 reporting
    // for both teacher and admin workspaces.
    <div className="flex flex-col gap-6">
      {classQuery.isLoading ? (
          <Card className="dashboard-card-surface">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : classQuery.error || !classRecord ? (
        <Card className="dashboard-card-alert">
          <CardContent className="p-6 text-sm text-destructive">
            {classQuery.error instanceof ApiClientError
              ? classQuery.error.message
              : copy.loadError}
          </CardContent>
        </Card>
      ) : (
        <>
          {viewer === "teacher" ? (
            <TeacherWorkspaceHero
              badgeLabel={teacherViewerCopy.badge}
              title={`${teacherViewerCopy.heroTitlePrefix}${classRecord.name}`}
              description={teacherViewerCopy.heroDescription}
              statusTitle={teacherViewerCopy.statusTitle}
              statusBody={
                classRecord.currentRound <= 0
                  ? teacherViewerCopy.setupStatusBody
                  : currentRound?.status === "PENDING"
                    ? teacherViewerCopy.pendingStatusBody(
                        currentRound.roundNumber,
                        submittedCount,
                        classRecord.teams.length
                      )
                    : teacherViewerCopy.lockedStatusBody
              }
              summaryItems={[
                {
                  label: teacherViewerCopy.summaryLabels.semester,
                  value: classRecord.semester.code,
                  hint: classRecord.semester.name,
                },
                {
                  label: teacherViewerCopy.summaryLabels.round,
                  value: `${classRecord.currentRound} / ${classRecord.maxRounds}`,
                  hint: currentRound
                    ? teacherViewerCopy.roundHint(
                        currentRound.roundNumber,
                        currentRoundStatusLabel
                      )
                    : teacherViewerCopy.roundPendingHint,
                },
                {
                  label: teacherViewerCopy.summaryLabels.teams,
                  value: `${classRecord.teams.length} / ${classRecord.maxTeams}`,
                  hint: teacherViewerCopy.teamsHint(totalMembers),
                },
                {
                  label: teacherViewerCopy.summaryLabels.latestResults,
                  value: latestResultsLabel,
                  hint: teacherViewerCopy.latestResultsHint(
                    submittedCount,
                    classRecord.teams.length
                  ),
                },
              ]}
              actions={[
                {
                  href: `/teacher/simulation?classId=${classRecord.id}`,
                  label: teacherViewerCopy.actions.simulation,
                  variant: "default",
                },
                {
                  href: `/teacher/grading?classId=${classRecord.id}`,
                  label: teacherViewerCopy.actions.grading,
                },
                { href: "/teacher/classes", label: teacherViewerCopy.actions.classes },
                { href: "/teacher/dashboard", label: teacherViewerCopy.actions.dashboard },
              ]}
            />
          ) : (
            <AdminWorkspaceHero
              badgeLabel={adminViewerCopy.badge}
              title={`${adminViewerCopy.heroTitlePrefix}${classRecord.name}`}
              description={adminViewerCopy.heroDescription}
              statusTitle={adminViewerCopy.statusTitle}
              statusBody={
                setupLocked
                  ? adminViewerCopy.lockedStatusBody
                  : adminViewerCopy.setupStatusBody
              }
              summaryItems={[
                {
                  label: adminViewerCopy.summaryLabels.status,
                  value: classStatusLabel,
                  hint: `${classRecord.semester.name} (${classRecord.semester.code})`,
                },
                {
                  label: adminViewerCopy.summaryLabels.teams,
                  value: `${classRecord.teams.length} / ${classRecord.maxTeams}`,
                  hint: adminViewerCopy.teamsHint(remainingTeamSlots),
                },
                {
                  label: adminViewerCopy.summaryLabels.students,
                  value: String(totalMembers),
                  hint: adminViewerCopy.studentsHint,
                },
                {
                  label: adminViewerCopy.summaryLabels.rosterMode,
                  value: setupLocked
                    ? adminViewerCopy.rosterModeLocked
                    : adminViewerCopy.rosterModeOpen,
                  hint: setupLocked
                    ? adminViewerCopy.rosterModeLockedHint
                    : adminViewerCopy.rosterModeOpenHint,
                },
              ]}
              actions={[
                {
                  href: "/admin/classes",
                  label: adminViewerCopy.actions.classes,
                  variant: "default",
                },
                { href: "/admin/dashboard", label: adminViewerCopy.actions.dashboard },
                { href: "/admin/semesters", label: adminViewerCopy.actions.semesters },
                { href: "/admin/users", label: adminViewerCopy.actions.users },
              ]}
            />
          )}

          <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.operations.title}</CardTitle>
                <CardDescription>
                  {copy.sections.operations.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">
                      {copy.sections.operations.metrics.joinCode}
                    </p>
                    <p className="mt-2 text-lg font-semibold">{classRecord.joinCode}</p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">
                      {copy.sections.operations.metrics.currentRound}
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {classRecord.currentRound} / {classRecord.maxRounds}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">
                      {copy.sections.operations.metrics.submissionState}
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {submittedCount} / {classRecord.teams.length}
                    </p>
                  </div>
                  <div className="dashboard-panel">
                    <p className="text-sm text-muted-foreground">
                      {copy.sections.operations.metrics.latestResults}
                    </p>
                    <p className="mt-2 text-lg font-semibold">{latestResultsLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Keep the mutation button labels stable because the live
                      Stage 3 acceptance flow and human runbooks reference these
                      exact controls when initializing and processing rounds. */}
                  {classRecord.currentRound <= 0 ? (
                    <Button
                      className="gap-2"
                      onClick={() => {
                        simulationMutation.mutate("initialize");
                      }}
                      disabled={simulationMutation.isPending}
                    >
                      {simulationMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Rocket className="size-4" />
                      )}
                      {copy.sections.operations.initializeRound}
                    </Button>
                  ) : (
                    <Button
                      className="gap-2"
                      onClick={() => {
                        simulationMutation.mutate("process");
                      }}
                      disabled={
                        simulationMutation.isPending ||
                        !currentRound ||
                        !processReadiness.canProcess
                      }
                    >
                      {simulationMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PlayCircle className="size-4" />
                      )}
                      {copy.sections.operations.processRound}
                    </Button>
                  )}
                  {resultsQuery.data?.roundNumber ? (
                    <>
                      <a
                        href={`/api/export?classId=${classId}&scope=results&format=csv&roundNumber=${resultsQuery.data.roundNumber}`}
                        className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                      >
                        <Download className="size-4" />
                        {copy.sections.operations.exportResultsCsv}
                      </a>
                      <a
                        href={`/api/export?classId=${classId}&scope=leaderboard&format=json&roundNumber=${resultsQuery.data.roundNumber}`}
                        className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                      >
                        <Download className="size-4" />
                        {copy.sections.operations.exportLeaderboardJson}
                      </a>
                    </>
                  ) : null}
                </div>
                {classRecord.currentRound > 0 && !processReadiness.canProcess ? (
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.operations.processGateHint}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.configuration.title}</CardTitle>
                <CardDescription>
                  {copy.sections.configuration.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.configuration.status}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{classStatusLabel}</p>
                </div>
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.configuration.semester}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {classRecord.semester.code}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {classRecord.semester.name}
                  </p>
                </div>
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.configuration.roomsPerHotel}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{classRecord.totalRooms}</p>
                </div>
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.configuration.allowedTeamSize}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {classRecord.minTeamSize} - {classRecord.maxTeamSize}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {simulationMutation.error ? (
            <Card className="dashboard-card-alert">
              <CardContent className="p-6 text-sm text-destructive">
                {simulationMutation.error instanceof ApiClientError
                  ? simulationMutation.error.message
                  : copy.sections.simulationError}
              </CardContent>
            </Card>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.timeline.title}</CardTitle>
                <CardDescription>
                  {copy.sections.timeline.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {classRecord.rounds.length > 0 ? (
                  classRecord.rounds.map((round) => (
                    <div
                      key={round.id}
                      className="dashboard-panel"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {copy.sections.timeline.roundLabel(round.roundNumber)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {copy.sections.timeline.roundMeta(
                              formatDate(round.deadline),
                              formatDate(round.processedAt)
                            )}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getRoundStatusLabel(locale, round.status)}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-panel-dashed">
                    {copy.sections.timeline.empty}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.submissions.title}</CardTitle>
                <CardDescription>
                  {viewer === "teacher"
                    ? teacherViewerCopy.submissionDescription
                    : adminViewerCopy.submissionDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="dashboard-panel">
                  <p className="text-sm text-muted-foreground">
                    {copy.sections.submissions.progress}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {submittedCount} / {classRecord.teams.length}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {currentRound
                      ? copy.sections.submissions.currentRoundLabel(
                          currentRound.roundNumber,
                          currentRoundStatusLabel
                        )
                      : copy.sections.submissions.noActiveRound}
                  </p>
                </div>
                {decisionsQuery.isLoading ? (
                  <div className="dashboard-panel text-sm text-muted-foreground">
                    {copy.sections.submissions.loading}
                  </div>
                ) : decisions.length > 0 ? (
                  decisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="dashboard-panel"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {decision.team.name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {copy.sections.submissions.updatedAt(
                              decision.team.hotelName,
                              formatDate(decision.updatedAt)
                            )}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getDecisionStatusLabel(locale, decision.status)}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-panel-dashed">
                    {copy.sections.submissions.empty}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.roster.title}</CardTitle>
                <CardDescription>
                  {copy.sections.roster.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {classRecord.teams.map((team) => (
                  <div
                    key={team.id}
                    className="dashboard-panel interactive-lift"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <p className="font-medium text-foreground">{team.name}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {team.hotelName}
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <span>
                          {copy.sections.roster.cash}{" "}
                          {formatCompactCurrency(team.hotelState?.cashBalance)}
                        </span>
                        <span>
                          {copy.sections.roster.debt}{" "}
                          {formatCompactCurrency(team.hotelState?.totalDebt)}
                        </span>
                        <span>
                          {copy.sections.roster.brand}{" "}
                          {formatNumber(team.hotelState?.brandReputation)}
                        </span>
                        <span>
                          {copy.sections.roster.esg}{" "}
                          {formatNumber(team.hotelState?.esgScore)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="dashboard-panel-subtle"
                        >
                          <p className="font-medium text-foreground">
                            {member.user.name || member.user.email}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {getTeamMemberRoleLabel(locale, member.role)}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {member.user.studentId || member.user.email}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="dashboard-card-surface">
              <CardHeader>
                <CardTitle className="text-xl">{copy.sections.results.title}</CardTitle>
                <CardDescription>
                  {copy.sections.results.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {resultsQuery.isLoading ? (
                  <div className="dashboard-panel text-sm text-muted-foreground">
                    {copy.sections.results.loading}
                  </div>
                ) : resultsQuery.data?.roundNumber ? (
                  <>
                    <div className="dashboard-panel">
                      <p className="text-sm text-muted-foreground">
                        {copy.sections.results.latestCompletedRound}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {copy.sections.results.latestCompletedRoundValue(
                          resultsQuery.data.roundNumber
                        )}
                      </p>
                    </div>
                    {resultsQuery.data.leaderboard.map((entry) => {
                      const detail = resultsQuery.data?.results.find(
                        (result) => result.team.id === entry.teamId
                      );

                      return (
                        <div
                          key={entry.teamId}
                          className="dashboard-panel"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                #{entry.rankOverall} {entry.team.name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.team.hotelName}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {copy.sections.results.marketShare(
                                formatPercent(entry.overallMarketShare)
                              )}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                            <span>
                              {copy.sections.results.revenueProfit(
                                formatCurrency(entry.totalRevenue),
                                formatCurrency(entry.netProfit)
                              )}
                            </span>
                            <span>
                              {copy.sections.results.occupancyAdr(
                                formatPercent(entry.occupancyRate),
                                formatCurrency(entry.adr)
                              )}
                            </span>
                            <span>
                              {copy.sections.results.guestSatisfactionEsg(
                                formatNumber(detail?.guestSatisfactionEnd ?? null),
                                formatNumber(detail?.esgScoreEnd ?? null)
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="dashboard-panel-dashed">
                    {copy.sections.results.empty}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {viewer === "admin" ? (
            // Admin class detail extends the shared teacher-grade monitoring
            // view with a live roster console instead of forking the whole page.
            <AdminTeamRosterManager classRecord={classRecord} />
          ) : null}

          <div className="flex justify-start">
            <Link
              href={viewer === "teacher" ? teacherViewerCopy.backHref : adminViewerCopy.backHref}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              {viewer === "teacher" ? teacherViewerCopy.backLabel : adminViewerCopy.backLabel}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
