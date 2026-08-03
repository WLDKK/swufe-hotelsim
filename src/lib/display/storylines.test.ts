import { describe, expect, it } from "vitest";
import { buildRecommendedRoundEnvironment } from "@/lib/simulation/environment";
import { buildDisplayStorylines } from "@/lib/display/storylines";

describe("buildDisplayStorylines", () => {
  it("includes an environment-led storyline when round context is available", () => {
    const stories = buildDisplayStorylines({
      snapshot: {
        roundNumber: 3,
        class: {
          name: "酒店经营模拟 A 班",
        },
      },
      leaderboard: [],
      announcements: [],
      environment: buildRecommendedRoundEnvironment({
        roundNumber: 3,
        economyId: "growing",
        eventId: "expo",
        weatherId: "stable_clear",
      }),
    });

    expect(stories[0]?.id).toBe("environment");
    expect(stories[0]?.title).toContain("第 3 轮");
  });

  it("summarizes leaderboard leaders and pinned announcements", () => {
    const stories = buildDisplayStorylines({
      snapshot: {
        roundNumber: 4,
        class: {
          name: "酒店经营模拟 B 班",
        },
      },
      leaderboard: [
        {
          rankOverall: 1,
          finalScore: 91.5,
          totalRevenue: 5_200_000,
          netProfit: 1_180_000,
          occupancyRate: 0.84,
          team: {
            name: "云栖酒店",
            hotelName: "云栖酒店",
          },
        },
        {
          rankOverall: 2,
          finalScore: 88.4,
          totalRevenue: 5_000_000,
          netProfit: 1_020_000,
          occupancyRate: 0.8,
          team: {
            name: "海岚酒店",
            hotelName: "海岚酒店",
          },
        },
      ],
      announcements: [
        {
          title: "第 4 轮成绩已发布",
          isPinned: true,
        },
      ],
    });

    expect(stories.some((story) => story.id === "leader")).toBe(true);
    expect(stories.some((story) => story.id === "announcement")).toBe(true);
  });
});
