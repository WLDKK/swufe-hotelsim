import { revalidateTag, unstable_cache } from "next/cache";

type CacheKeyPart = string | number | boolean | null | undefined;

type CacheQueryOptions = {
  revalidate?: number;
  tags?: Array<string | null | undefined | false>;
};

const CACHE_NAMESPACE = "swufe-hotelsim";

function serializeKeyPart(part: CacheKeyPart) {
  if (part === null) {
    return "null";
  }

  if (part === undefined) {
    return "undefined";
  }

  return String(part);
}

function normalizeTags(tags: Array<string | null | undefined | false> = []) {
  return Array.from(
    new Set(
      tags.filter(
        (tag): tag is string => typeof tag === "string" && tag.trim().length > 0
      )
    )
  )
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function cacheQuery<T>(
  keyParts: readonly CacheKeyPart[],
  query: () => Promise<T>,
  options: CacheQueryOptions = {}
) {
  return unstable_cache(
    query,
    [CACHE_NAMESPACE, ...keyParts.map(serializeKeyPart)],
    {
      revalidate: options.revalidate ?? 30,
      tags: normalizeTags(options.tags),
    }
  )();
}

export function revalidateCacheTags(
  tags: Array<string | null | undefined | false>
) {
  for (const tag of normalizeTags(tags)) {
    try {
      revalidateTag(tag);
    } catch (error) {
      if (
        process.env.NODE_ENV === "test" ||
        (error instanceof Error &&
          error.message.toLowerCase().includes("static generation store missing"))
      ) {
        continue;
      }

      throw error;
    }
  }
}

export const cacheTags = {
  advancements: "advancements",
  audit: "audit",
  alerts: "alerts",
  announcements: "announcements",
  classes: "classes",
  class: (classId: string) => `class:${classId}`,
  classJoinCode: (joinCode: string) => `class-join-code:${joinCode}`,
  classResults: (classId: string) => `class-results:${classId}`,
  classRounds: (classId: string) => `class-rounds:${classId}`,
  classTeams: (classId: string) => `class-teams:${classId}`,
  competition: (competitionId: string) => `competition:${competitionId}`,
  competitions: "competitions",
  judgeAssignments: "judge-assignments",
  leaderboard: (classId: string) => `leaderboard:${classId}`,
  observability: "observability",
  rounds: "rounds",
  round: (roundId: string) => `round:${roundId}`,
  rulesets: "rulesets",
  semesters: "semesters",
  semester: (semesterId: string) => `semester:${semesterId}`,
  stage: (stageId: string) => `stage:${stageId}`,
  stages: "stages",
  teacherClasses: (teacherId: string) => `teacher-classes:${teacherId}`,
  teacherSemesters: (teacherId: string) => `teacher-semesters:${teacherId}`,
  team: (teamId: string) => `team:${teamId}`,
  teamResults: (teamId: string) => `team-results:${teamId}`,
  teamWorkspace: (userId: string) => `team-workspace:${userId}`,
  users: "users",
  user: (userId: string) => `user:${userId}`,
} as const;
