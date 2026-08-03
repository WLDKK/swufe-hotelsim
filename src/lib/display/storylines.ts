import { formatCompactCurrency, formatPercent } from "@/lib/formatters";
import type { RoundEnvironmentRecommendation } from "@/lib/simulation/environment";

export type DisplayStoryline = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  tone: "sky" | "emerald" | "amber" | "rose";
};

type DisplaySnapshot = {
  roundNumber: number;
  class: {
    name: string;
  } | null;
};

type DisplayLeaderboardEntry = {
  rankOverall: number;
  finalScore: number | null;
  totalRevenue: number;
  netProfit: number;
  occupancyRate: number;
  team: {
    name: string;
    hotelName: string;
  };
};

type DisplayAnnouncement = {
  title: string;
  isPinned: boolean;
};

function formatMargin(value: number, revenue: number) {
  if (revenue <= 0) {
    return "0%";
  }

  return formatPercent(value / revenue);
}

export function buildDisplayStorylines(input: {
  snapshot: DisplaySnapshot | null;
  leaderboard: DisplayLeaderboardEntry[];
  announcements: DisplayAnnouncement[];
  environment?: RoundEnvironmentRecommendation | null;
}) {
  const topTeam = input.leaderboard[0] ?? null;
  const secondTeam = input.leaderboard[1] ?? null;
  const profitLeader =
    [...input.leaderboard].sort((left, right) => right.netProfit - left.netProfit)[0] ??
    null;
  const occupancyLeader =
    [...input.leaderboard].sort(
      (left, right) => right.occupancyRate - left.occupancyRate
    )[0] ?? null;
  const pinnedAnnouncement = input.announcements.find((item) => item.isPinned) ?? null;
  const scoreGap =
    topTeam && secondTeam
      ? Math.max(0, (topTeam.finalScore ?? 0) - (secondTeam.finalScore ?? 0))
      : 0;

  const stories: DisplayStoryline[] = [];

  if (input.environment) {
    stories.push({
      id: "environment",
      badge: "Round Signal",
      tone:
        input.environment.demandOutlook === "strong"
          ? "sky"
          : input.environment.demandOutlook === "soft"
            ? "rose"
            : "amber",
      title:
        input.environment.demandOutlook === "strong"
          ? `第 ${input.snapshot?.roundNumber ?? input.environment.roundNumber} 轮需求偏强`
          : input.environment.demandOutlook === "soft"
            ? `第 ${input.snapshot?.roundNumber ?? input.environment.roundNumber} 轮更偏防守`
            : `第 ${input.snapshot?.roundNumber ?? input.environment.roundNumber} 轮进入均衡窗口`,
      detail: `${input.environment.weatherLabel} / ${input.environment.economyLabel} / ${input.environment.eventLabel}。${input.environment.pricingHint}`,
    });
  }

  if (topTeam) {
    stories.push({
      id: "leader",
      badge: "Leader",
      tone: "sky",
      title: `${topTeam.team.name} 暂居榜首`,
      detail: `${topTeam.team.hotelName} 当前领先 ${scoreGap.toFixed(
        1
      )} 分，总营收 ${formatCompactCurrency(topTeam.totalRevenue)}。`,
    });
  }

  if (profitLeader) {
    stories.push({
      id: "profit",
      badge: "Profit",
      tone: "emerald",
      title: `${profitLeader.team.name} 的利润表现最亮眼`,
      detail: `净利润 ${formatCompactCurrency(
        profitLeader.netProfit
      )}，利润率 ${formatMargin(profitLeader.netProfit, profitLeader.totalRevenue)}。`,
    });
  }

  if (occupancyLeader) {
    stories.push({
      id: "occupancy",
      badge: "Occupancy",
      tone: "amber",
      title: `${occupancyLeader.team.name} 的入住率最高`,
      detail: `当前入住率 ${formatPercent(
        occupancyLeader.occupancyRate
      )}，这通常意味着他们更好地吃到了本轮需求窗口。`,
    });
  }

  if (pinnedAnnouncement) {
    stories.push({
      id: "announcement",
      badge: "Announcement",
      tone: "rose",
      title: pinnedAnnouncement.title,
      detail: "置顶公告会优先进入公开展示节奏，适合用作现场播报或阶段提示。",
    });
  }

  if (stories.length === 0) {
    stories.push({
      id: "empty",
      badge: "Standby",
      tone: "amber",
      title: "公开赛况还在等待数据",
      detail: "一旦轮次处理完成或公告发布，这里会自动切换为赛事播报模式。",
    });
  }

  return stories;
}
