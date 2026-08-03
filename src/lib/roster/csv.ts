import { TeamRole } from "@prisma/client";
import { rowsToCsv } from "@/lib/export/csv";

export const rosterCsvHeaders = [
  "team_name",
  "hotel_name",
  "team_color",
  "student_email",
  "student_id",
  "student_name",
  "team_role",
] as const;

export type RosterCsvRow = Record<(typeof rosterCsvHeaders)[number], string>;

export type RosterCsvIssue = {
  rowNumber: number | null;
  field: string | null;
  message: string;
};

export type ParsedRosterImportMember = {
  rowNumber: number;
  studentEmail: string | null;
  studentId: string | null;
  studentName: string | null;
  teamRole: TeamRole;
};

export type ParsedRosterImportTeam = {
  teamName: string;
  hotelName: string;
  color: string | null;
  members: ParsedRosterImportMember[];
};

export type ParsedRosterImportPlan = {
  teams: ParsedRosterImportTeam[];
  issues: RosterCsvIssue[];
  summary: {
    teams: number;
    members: number;
    leaders: number;
  };
};

type TeamForRosterCsv = {
  name: string;
  hotelName: string;
  color: string;
  members: Array<{
    role: string;
    user: {
      email: string;
      studentId: string | null;
      name: string | null;
    };
  }>;
};

const teamRoleMap: Record<string, TeamRole> = {
  LEADER: TeamRole.LEADER,
  MEMBER: TeamRole.MEMBER,
  MARKETING_MANAGER: TeamRole.MARKETING_MANAGER,
  OPERATIONS_MANAGER: TeamRole.OPERATIONS_MANAGER,
  FINANCE_MANAGER: TeamRole.FINANCE_MANAGER,
  REVENUE_MANAGER: TeamRole.REVENUE_MANAGER,
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCell(value: string | undefined) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTeamRole(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized.length === 0) {
    return TeamRole.MEMBER;
  }

  return teamRoleMap[normalized] ?? null;
}

function parseCsvTable(csvText: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  const text = csvText.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      currentRow.push(currentCell);
      currentCell = "";

      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];

      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function rowsToRosterCsv(rows: RosterCsvRow[]) {
  if (rows.length === 0) {
    return rosterCsvHeaders.join(",");
  }

  return rowsToCsv(rows);
}

export function buildRosterCsvTemplate() {
  return rowsToRosterCsv([
    {
      team_name: "Team Atlas",
      hotel_name: "Atlas Grand Hotel",
      team_color: "#8B1A1A",
      student_email: "student01@hotelsim.example",
      student_id: "2026001",
      student_name: "Student Leader",
      team_role: "LEADER",
    },
    {
      team_name: "Team Atlas",
      hotel_name: "Atlas Grand Hotel",
      team_color: "#8B1A1A",
      student_email: "student02@hotelsim.example",
      student_id: "2026002",
      student_name: "Student Member",
      team_role: "MEMBER",
    },
  ]);
}

export function buildRosterCsvFromTeams(teams: TeamForRosterCsv[]) {
  const rows = teams.flatMap((team) =>
    [...team.members]
      .sort((left, right) => {
        if (left.role === right.role) {
          return (left.user.email ?? "").localeCompare(right.user.email ?? "", "en", {
            sensitivity: "base",
          });
        }

        if (left.role === TeamRole.LEADER) {
          return -1;
        }

        if (right.role === TeamRole.LEADER) {
          return 1;
        }

        return left.role.localeCompare(right.role, "en", {
          sensitivity: "base",
        });
      })
      .map((member) => ({
        team_name: team.name,
        hotel_name: team.hotelName,
        team_color: team.color,
        student_email: member.user.email,
        student_id: member.user.studentId ?? "",
        student_name: member.user.name ?? "",
        team_role: member.role,
      }))
  );

  return rowsToRosterCsv(rows);
}

export function parseRosterCsv(csvText: string): ParsedRosterImportPlan {
  const issues: RosterCsvIssue[] = [];
  const csvRows = parseCsvTable(csvText);

  if (csvRows.length === 0) {
    return {
      teams: [],
      issues: [
        {
          rowNumber: null,
          field: null,
          message: "The CSV file is empty.",
        },
      ],
      summary: {
        teams: 0,
        members: 0,
        leaders: 0,
      },
    };
  }

  const headerRow = csvRows[0].map(normalizeHeader);
  const missingHeaders = rosterCsvHeaders.filter(
    (header) => !headerRow.includes(header)
  );

  if (missingHeaders.length > 0) {
    return {
      teams: [],
      issues: [
        {
          rowNumber: 1,
          field: "headers",
          message: `Missing required CSV headers: ${missingHeaders.join(", ")}.`,
        },
      ],
      summary: {
        teams: 0,
        members: 0,
        leaders: 0,
      },
    };
  }

  if (csvRows.length === 1) {
    return {
      teams: [],
      issues: [
        {
          rowNumber: null,
          field: null,
          message: "The CSV file does not contain any roster data rows.",
        },
      ],
      summary: {
        teams: 0,
        members: 0,
        leaders: 0,
      },
    };
  }

  const headerIndex = new Map(headerRow.map((header, index) => [header, index]));
  const teamsByName = new Map<string, ParsedRosterImportTeam>();
  const seenEmails = new Set<string>();
  const seenStudentIds = new Set<string>();

  for (let index = 1; index < csvRows.length; index += 1) {
    const csvRow = csvRows[index];
    const rowNumber = index + 1;
    const record = Object.fromEntries(
      rosterCsvHeaders.map((header) => [
        header,
        normalizeCell(csvRow[headerIndex.get(header) ?? -1]),
      ])
    ) as RosterCsvRow;

    const teamName = record.team_name;
    const hotelName = record.hotel_name;
    const teamColor = record.team_color || null;
    const studentEmail = record.student_email
      ? normalizeEmail(record.student_email)
      : null;
    const studentId = record.student_id || null;
    const studentName = record.student_name || null;
    const teamRole = normalizeTeamRole(record.team_role);

    if (!teamName) {
      issues.push({
        rowNumber,
        field: "team_name",
        message: "Team name is required.",
      });
    }

    if (!hotelName) {
      issues.push({
        rowNumber,
        field: "hotel_name",
        message: "Hotel name is required.",
      });
    }

    if (!studentEmail && !studentId) {
      issues.push({
        rowNumber,
        field: "student_email",
        message: "Provide at least one of student_email or student_id.",
      });
    }

    if (teamColor && !/^#[0-9A-Fa-f]{6}$/.test(teamColor)) {
      issues.push({
        rowNumber,
        field: "team_color",
        message: "Team color must be a hex color like #8B1A1A.",
      });
    }

    if (!teamRole) {
      issues.push({
        rowNumber,
        field: "team_role",
        message: "Team role must be a valid TeamRole value.",
      });
    }

    if (
      !teamName ||
      !hotelName ||
      (!studentEmail && !studentId) ||
      !teamRole ||
      (teamColor && !/^#[0-9A-Fa-f]{6}$/.test(teamColor))
    ) {
      continue;
    }

    if (studentEmail) {
      if (seenEmails.has(studentEmail)) {
        issues.push({
          rowNumber,
          field: "student_email",
          message: `Student email ${studentEmail} is duplicated in the CSV file.`,
        });
      } else {
        seenEmails.add(studentEmail);
      }
    }

    if (studentId) {
      if (seenStudentIds.has(studentId)) {
        issues.push({
          rowNumber,
          field: "student_id",
          message: `Student ID ${studentId} is duplicated in the CSV file.`,
        });
      } else {
        seenStudentIds.add(studentId);
      }
    }

    const teamKey = teamName.toLowerCase();
    const existingTeam = teamsByName.get(teamKey);

    if (!existingTeam) {
      teamsByName.set(teamKey, {
        teamName,
        hotelName,
        color: teamColor,
        members: teamRole
          ? [
              {
                rowNumber,
                studentEmail,
                studentId,
                studentName,
                teamRole,
              },
            ]
          : [],
      });
      continue;
    }

    if (existingTeam.teamName !== teamName) {
      issues.push({
        rowNumber,
        field: "team_name",
        message: `Team name casing must stay consistent for ${teamName}.`,
      });
    }

    if (existingTeam.hotelName !== hotelName) {
      issues.push({
        rowNumber,
        field: "hotel_name",
        message: `Hotel name must stay consistent for team ${teamName}.`,
      });
    }

    if ((existingTeam.color ?? "") !== (teamColor ?? "")) {
      issues.push({
        rowNumber,
        field: "team_color",
        message: `Team color must stay consistent for team ${teamName}.`,
      });
    }

    if (teamRole) {
      existingTeam.members.push({
        rowNumber,
        studentEmail,
        studentId,
        studentName,
        teamRole,
      });
    }
  }

  const teams = Array.from(teamsByName.values()).sort((left, right) =>
    left.teamName.localeCompare(right.teamName, "en", {
      sensitivity: "base",
    })
  );

  for (const team of teams) {
    const leaderCount = team.members.filter(
      (member: ParsedRosterImportMember) => member.teamRole === TeamRole.LEADER
    ).length;

    if (leaderCount !== 1) {
      issues.push({
        rowNumber: team.members[0]?.rowNumber ?? null,
        field: "team_role",
        message: `Team ${team.teamName} must contain exactly one LEADER row.`,
      });
    }
  }

  return {
    teams,
    issues,
    summary: {
      teams: teams.length,
      members: teams.reduce((sum, team) => sum + team.members.length, 0),
      leaders: teams.reduce(
        (sum, team) =>
          sum +
          team.members.filter(
            (member: ParsedRosterImportMember) => member.teamRole === TeamRole.LEADER
          ).length,
        0
      ),
    },
  };
}
