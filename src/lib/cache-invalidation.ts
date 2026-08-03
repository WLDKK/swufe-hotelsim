import { cacheTags, revalidateCacheTags } from "@/lib/cache";

type ClassCacheScope = {
  classId: string;
  semesterId?: string | null;
  teacherId?: string | null;
  joinCode?: string | null;
};

type TeamCacheScope = {
  classId: string;
  teamId?: string | null;
  affectedUserIds?: string[];
};

type RoundCacheScope = {
  classId: string;
  roundId?: string | null;
  teamIds?: string[];
};

export function revalidateSemesterReadModels(input: {
  semesterId: string;
  teacherId?: string | null;
}) {
  revalidateCacheTags([
    cacheTags.semesters,
    cacheTags.semester(input.semesterId),
    input.teacherId ? cacheTags.teacherSemesters(input.teacherId) : null,
    cacheTags.classes,
  ]);
}

export function revalidateClassReadModels(input: ClassCacheScope) {
  revalidateCacheTags([
    cacheTags.classes,
    cacheTags.class(input.classId),
    cacheTags.classRounds(input.classId),
    cacheTags.classTeams(input.classId),
    cacheTags.classResults(input.classId),
    cacheTags.leaderboard(input.classId),
    input.semesterId ? cacheTags.semester(input.semesterId) : null,
    input.teacherId ? cacheTags.teacherClasses(input.teacherId) : null,
    input.joinCode ? cacheTags.classJoinCode(input.joinCode) : null,
    cacheTags.rounds,
    cacheTags.observability,
    cacheTags.alerts,
  ]);
}

export function revalidateTeamReadModels(input: TeamCacheScope) {
  revalidateCacheTags([
    cacheTags.class(input.classId),
    cacheTags.classTeams(input.classId),
    cacheTags.classResults(input.classId),
    cacheTags.classRounds(input.classId),
    cacheTags.leaderboard(input.classId),
    input.teamId ? cacheTags.team(input.teamId) : null,
    ...(input.affectedUserIds ?? []).map((userId) => cacheTags.teamWorkspace(userId)),
    cacheTags.observability,
    cacheTags.alerts,
  ]);
}

export function revalidateTeamWorkspaceReadModels(userIds: string[] = []) {
  revalidateCacheTags(userIds.map((userId) => cacheTags.teamWorkspace(userId)));
}

export function revalidateRoundReadModels(input: RoundCacheScope) {
  revalidateCacheTags([
    cacheTags.class(input.classId),
    cacheTags.classRounds(input.classId),
    cacheTags.classResults(input.classId),
    cacheTags.leaderboard(input.classId),
    input.roundId ? cacheTags.round(input.roundId) : null,
    ...(input.teamIds ?? []).flatMap((teamId) => [
      cacheTags.team(teamId),
      cacheTags.teamResults(teamId),
    ]),
    cacheTags.observability,
    cacheTags.alerts,
  ]);
}

export function revalidateUserReadModels(userIds: string[] = []) {
  revalidateCacheTags([
    cacheTags.users,
    ...userIds.map((userId) => cacheTags.user(userId)),
    ...userIds.map((userId) => cacheTags.teamWorkspace(userId)),
  ]);
}

export function revalidateAlertReadModels() {
  revalidateCacheTags([cacheTags.alerts, cacheTags.observability, cacheTags.audit]);
}
