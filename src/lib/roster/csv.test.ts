import { describe, expect, it } from "vitest";
import {
  buildRosterCsvFromTeams,
  buildRosterCsvTemplate,
  parseRosterCsv,
} from "./csv";

describe("roster csv utilities", () => {
  it("builds a reusable template with the canonical roster headers", () => {
    const csv = buildRosterCsvTemplate();

    expect(csv).toContain("team_name,hotel_name,team_color,student_email,student_id,student_name,team_role");
    expect(csv).toContain("Team Atlas");
    expect(csv).toContain("LEADER");
  });

  it("parses a valid roster csv into team and member summaries", () => {
    const csv = [
      "team_name,hotel_name,team_color,student_email,student_id,student_name,team_role",
      "Team Harbor,Harbor Hotel,#1B3A5C,student01@hotelsim.example,2026001,Student One,LEADER",
      "Team Harbor,Harbor Hotel,#1B3A5C,student02@hotelsim.example,2026002,Student Two,MEMBER",
      "Team Aurora,Aurora Hotel,#2F5D50,student03@hotelsim.example,2026003,Student Three,LEADER",
      "Team Aurora,Aurora Hotel,#2F5D50,student04@hotelsim.example,2026004,Student Four,MEMBER",
    ].join("\r\n");

    const parsed = parseRosterCsv(csv);

    expect(parsed.issues).toEqual([]);
    expect(parsed.summary).toEqual({
      teams: 2,
      members: 4,
      leaders: 2,
    });
    expect(parsed.teams[0]?.teamName).toBe("Team Aurora");
    expect(parsed.teams[1]?.members).toHaveLength(2);
  });

  it("rejects header-only files and inconsistent team metadata", () => {
    const headerOnly = parseRosterCsv(
      "team_name,hotel_name,team_color,student_email,student_id,student_name,team_role"
    );
    expect(headerOnly.issues[0]?.message).toContain("does not contain any roster data rows");

    const inconsistent = parseRosterCsv(
      [
        "team_name,hotel_name,team_color,student_email,student_id,student_name,team_role",
        "Team Atlas,Atlas Hotel,#8B1A1A,student01@hotelsim.example,2026001,Student One,LEADER",
        "Team Atlas,Atlas Business Hotel,#8B1A1A,student02@hotelsim.example,2026002,Student Two,MEMBER",
      ].join("\r\n")
    );

    expect(inconsistent.issues.some((issue) => issue.field === "hotel_name")).toBe(true);
  });

  it("exports live team payloads back into roster csv rows", () => {
    const csv = buildRosterCsvFromTeams([
      {
        name: "Team Summit",
        hotelName: "Summit Grand Hotel",
        color: "#375A7F",
        members: [
          {
            role: "MEMBER",
            user: {
              email: "student02@hotelsim.example",
              studentId: "2026002",
              name: "Student Two",
            },
          },
          {
            role: "LEADER",
            user: {
              email: "student01@hotelsim.example",
              studentId: "2026001",
              name: "Student One",
            },
          },
        ],
      },
    ]);

    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("team_name");
    expect(lines[1]).toContain("LEADER");
    expect(lines[2]).toContain("MEMBER");
  });
});
