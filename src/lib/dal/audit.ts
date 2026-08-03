import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type ListRecentAuditLogsInput = {
  limit?: number;
  action?: string;
  entityType?: string;
};

const auditActorSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export async function listRecentAuditLogs(input: ListRecentAuditLogsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

  return cacheQuery(
    [
      "audit",
      "recent",
      limit,
      input.action ?? "all",
      input.entityType ?? "all",
    ],
    async () => {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          ...(input.action ? { action: input.action } : {}),
          ...(input.entityType ? { entityType: input.entityType } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      const actorIds = Array.from(
        new Set(
          auditLogs
            .map((auditLog) => auditLog.userId)
            .filter((userId): userId is string => Boolean(userId))
        )
      );

      const actors =
        actorIds.length > 0
          ? await prisma.user.findMany({
              where: {
                id: {
                  in: actorIds,
                },
              },
              select: auditActorSelect,
            })
          : [];
      const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

      // Keep the dashboard-facing shape explicit here so later admin pages can
      // reuse one audit snapshot without each route re-joining actor metadata.
      return auditLogs.map((auditLog) => ({
        ...auditLog,
        actor: auditLog.userId ? actorsById.get(auditLog.userId) ?? null : null,
      }));
    },
    {
      revalidate: 15,
      tags: [cacheTags.audit, cacheTags.users],
    }
  );
}
