import { RulesetStatus } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export async function getActiveRuleset() {
  return cacheQuery(
    ["rulesets", "active"],
    () =>
      prisma.ruleset.findFirst({
        where: {
          status: RulesetStatus.ACTIVE,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
    {
      tags: [cacheTags.rulesets],
    }
  );
}

export async function listRulesets() {
  return cacheQuery(
    ["rulesets", "all"],
    () =>
      prisma.ruleset.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      }),
    {
      tags: [cacheTags.rulesets],
    }
  );
}

export async function getRulesetById(rulesetId: string) {
  return cacheQuery(
    ["rulesets", "detail", rulesetId],
    () =>
      prisma.ruleset.findUnique({
        where: { id: rulesetId },
      }),
    {
      tags: [cacheTags.rulesets],
    }
  );
}
