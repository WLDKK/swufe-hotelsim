import { describe, expect, it } from "vitest";
import {
  buildRandomRoundEnvironment,
  buildRecommendedRoundEnvironment,
  describeRoundEnvironment,
  parseEnvironmentDescription,
} from "@/lib/simulation/environment";

describe("simulation environment fitting", () => {
  it("builds a recommended environment with serialized Chinese guidance", () => {
    const environment = buildRecommendedRoundEnvironment({
      roundNumber: 4,
      weatherId: "stable_clear",
      economyId: "growing",
      eventId: "expo",
    });

    expect(environment.seasonFactor).toBeGreaterThan(0);
    expect(environment.economyFactor).toBe(1.05);
    expect(environment.eventFactor).toBeGreaterThan(1);
    expect(environment.eventDescription).toContain("环境摘要");
    expect(environment.marketingHint).toContain("商务");
  });

  it("creates reproducible random environments from the same seed", () => {
    const first = buildRandomRoundEnvironment({
      roundNumber: 8,
      classId: "class-1",
      seed: "env:class-1:8:seed-a",
    });
    const second = buildRandomRoundEnvironment({
      roundNumber: 8,
      classId: "class-1",
      seed: "env:class-1:8:seed-a",
    });

    expect(second.weatherId).toBe(first.weatherId);
    expect(second.eventId).toBe(first.eventId);
    expect(second.economyId).toBe(first.economyId);
    expect(second.eventDescription).toBe(first.eventDescription);
  });

  it("parses saved environment descriptions back into readable labels", () => {
    const recommended = buildRecommendedRoundEnvironment({
      roundNumber: 6,
      weatherId: "rainy_spell",
      economyId: "steady",
      eventId: "concert",
    });

    const parsed = parseEnvironmentDescription(recommended.eventDescription);
    const described = describeRoundEnvironment({
      roundNumber: 6,
      seasonFactor: recommended.seasonFactor,
      economyFactor: recommended.economyFactor,
      eventFactor: recommended.eventFactor,
      eventDescription: recommended.eventDescription,
      randomSeed: "env:class-1:6:demo",
    });

    expect(parsed.weatherLabel).toBe("连续降雨");
    expect(described.weatherLabel).toBe("连续降雨");
    expect(described.eventLabel).toBe("演出/赛事");
    expect(described.totalDemandMultiplier).toBeGreaterThan(0);
  });
});
