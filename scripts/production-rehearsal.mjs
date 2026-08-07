import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const CONFIRMATION = "RUN_200_PRODUCTION";
const RUN_CODE = "REHEARSAL-20260807";
const RUN_PREFIX = "rehearsal-20260807";
const PARTICIPANT_COUNT = 200;
const TEAM_COUNT = 40;
const TEAM_SIZE = 5;
const ROUND_COUNT = 6;
const JUDGE_COUNT = 3;
const BASE_URL = (process.env.REHEARSAL_BASE_URL ?? "").replace(/\/$/, "");
const RUN_ID = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;
const REQUEST_TIMEOUT_MS = 120_000;

if (process.env.REHEARSAL_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set REHEARSAL_CONFIRM=${CONFIRMATION} to run the production rehearsal.`);
}

if (BASE_URL !== "https://swufe-hotelsim.1310205058.workers.dev") {
  throw new Error("REHEARSAL_BASE_URL must point to the approved production Worker.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for rehearsal bootstrap and verification.");
}

const prisma = new PrismaClient();
const metrics = [];
const phaseTimings = [];

function log(message) {
  console.log(`[rehearsal:${RUN_CODE}] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

async function phase(name, callback) {
  const startedAt = performance.now();
  log(`${name} started.`);
  const value = await callback();
  const durationMs = Math.round(performance.now() - startedAt);
  phaseTimings.push({ name, durationMs });
  log(`${name} completed in ${durationMs} ms.`);
  return value;
}

function parseSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=]+=[^;,]+)/g);
}

class HttpSession {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  captureCookies(headers) {
    for (const cookieLine of parseSetCookie(headers)) {
      const pair = cookieLine.split(";", 1)[0];
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) continue;
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (value.length === 0) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async request(path, options = {}) {
    const method = options.method ?? "GET";
    const expectedStatuses = options.expectedStatuses ?? [200];
    const retries = method === "GET" ? options.retries ?? 2 : 0;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const startedAt = performance.now();
      let responseRecorded = false;
      try {
        const headers = new Headers(options.headers ?? {});
        headers.set("accept", options.accept ?? "application/json");
        headers.set("user-agent", `swufe-hotelsim-rehearsal/${RUN_CODE}`);
        headers.set("x-rehearsal-run", `${RUN_CODE}:${RUN_ID}`);
        const cookie = this.cookieHeader();
        if (cookie) headers.set("cookie", cookie);

        let body = options.body;
        if (options.json !== undefined) {
          headers.set("content-type", "application/json");
          body = JSON.stringify(options.json);
        }

        const response = await fetch(`${BASE_URL}${path}`, {
          method,
          headers,
          body,
          redirect: options.redirect ?? "manual",
          signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
        });
        this.captureCookies(response.headers);
        const text = await response.text();
        let payload = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = text;
          }
        }

        const durationMs = Math.round(performance.now() - startedAt);
        metrics.push({
          label: options.metricLabel ?? path,
          method,
          status: response.status,
          durationMs,
          expected: expectedStatuses.includes(response.status),
          attempt,
        });
        responseRecorded = true;

        if (expectedStatuses.includes(response.status)) {
          return { status: response.status, headers: response.headers, payload, text };
        }

        const retryable = [429, 500, 502, 503, 504].includes(response.status);
        if (attempt < retries && retryable) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }

        throw new Error(
          `${this.label} ${method} ${path} returned ${response.status}: ${text.slice(0, 500)}`
        );
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        if (!responseRecorded) {
          metrics.push({
            label: options.metricLabel ?? path,
            method,
            status: 0,
            durationMs,
            expected: false,
            attempt,
          });
        }
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError;
  }

  async login(email, password) {
    const csrfResponse = await this.request("/api/auth/csrf", {
      metricLabel: "auth.csrf",
    });
    const csrfToken = csrfResponse.payload?.csrfToken;
    assert(typeof csrfToken === "string" && csrfToken.length > 0, `${email} did not receive a CSRF token.`);

    const form = new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE_URL}/`,
      redirectTo: `${BASE_URL}/`,
    });
    await this.request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      expectedStatuses: [200, 302, 303],
      metricLabel: "auth.credentials",
    });

    const sessionResponse = await this.request("/api/auth/session", {
      metricLabel: "auth.session",
    });
    assert(
      sessionResponse.payload?.user?.email === email,
      `Authentication session mismatch for ${email}.`
    );
    return sessionResponse.payload;
  }
}

async function mapLimit(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function requireData(response, key) {
  assert(response.payload?.status === "ok", `Expected an ok API envelope for ${key}.`);
  const value = response.payload?.data?.[key];
  assert(value !== undefined && value !== null, `Response did not contain data.${key}.`);
  return value;
}

function studentIdentity(index) {
  const number = String(index + 1).padStart(3, "0");
  return {
    name: `演练学生 ${number}`,
    email: `${RUN_PREFIX}-student-${number}@hotelsim.example`,
    studentId: `SIM26${number}`,
    role: "STUDENT",
  };
}

function buildDecision(teamIndex, roundNumber, mode) {
  const strategy = teamIndex % 5;
  const priceShift = strategy * 18 + roundNumber * 7;
  const marketingTotal = 84 + strategy * 4 + roundNumber * 2;
  const allocationWeights = [16, 12, 16, 10, 8, 13, 7, 8];
  const allocationBase = allocationWeights.reduce((sum, value) => sum + value, 0);
  const allocations = allocationWeights.map((weight) =>
    Number(((weight / allocationBase) * marketingTotal).toFixed(2))
  );
  allocations[allocations.length - 1] = Number(
    (marketingTotal - allocations.slice(0, -1).reduce((sum, value) => sum + value, 0)).toFixed(2)
  );

  return {
    mode,
    priceBusinessTransient: 535 + priceShift,
    priceBusinessGroup: 480 + priceShift * 0.8,
    priceLeisureTransient: 445 + priceShift * 0.7,
    priceLeisureGroup: 395 + priceShift * 0.55,
    priceGovernment: 360 + priceShift * 0.35,
    priceOnlineOTA: 425 + priceShift * 0.65,
    priceAirlineCrew: 295 + priceShift * 0.25,
    priceLongStay: 325 + priceShift * 0.3,
    marketingTotal,
    mktBudgetBusinessTransient: allocations[0],
    mktBudgetBusinessGroup: allocations[1],
    mktBudgetLeisureTransient: allocations[2],
    mktBudgetLeisureGroup: allocations[3],
    mktBudgetGovernment: allocations[4],
    mktBudgetOnlineOTA: allocations[5],
    mktBudgetAirlineCrew: allocations[6],
    mktBudgetLongStay: allocations[7],
    channelDirect: 28 + strategy,
    channelOTA: 30 - strategy,
    channelTravelAgent: 12,
    channelCorporate: 22,
    channelGDS: 8,
    opexRoomsMaintenance: 30 + roundNumber,
    opexFoodBeverage: 25 + strategy,
    opexFrontDesk: 15 + strategy * 0.5,
    opexHousekeeping: 21 + roundNumber * 0.5,
    opexUtilities: 18 + roundNumber,
    opexStaffTraining: 8 + (teamIndex % 4),
    opexStaffWelfare: 7 + (teamIndex % 3),
    opexSecurity: 5 + (roundNumber % 2),
    opexIT: 8 + strategy,
    capexRenovation: roundNumber <= 2 ? 8 + strategy : 2,
    capexFurniture: roundNumber % 2 === 0 ? 5 + strategy : 2,
    capexTechnology: 4 + strategy + roundNumber,
    capexFacilities: 3 + (teamIndex % 3),
    capexESGGreen: 4 + ((teamIndex + roundNumber) % 5),
    newLoanAmount: roundNumber === 1 && strategy === 4 ? 8 : 0,
    loanRepayment: roundNumber >= 4 ? 3 + strategy : 0,
    esgEnergyInvestment: 36 + strategy * 5,
    esgWasteManagement: 34 + roundNumber * 2,
    esgCommunityEngagement: 25 + strategy * 3,
    esgEmployeeDiversity: 26 + (teamIndex % 6),
    taxStrategy: ["STANDARD", "COMPLIANCE_FIRST", "STANDARD", "INCENTIVE_FOCUS", "STANDARD"][strategy],
  };
}

async function resetOwnedNamespace() {
  await prisma.$transaction(async (tx) => {
    await tx.competition.deleteMany({ where: { code: RUN_CODE } });
    await tx.semester.deleteMany({ where: { code: RUN_CODE } });
    await tx.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: `${RUN_PREFIX}-` } },
          { email: `${RUN_PREFIX}-admin@hotelsim.example` },
        ],
      },
    });
  });
}

async function createTemporaryAdmin(password) {
  const email = `${RUN_PREFIX}-admin@hotelsim.example`;
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: "生产演练临时管理员",
      email,
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  });
  return { id: user.id, email };
}

async function createUser(adminClient, password, identity) {
  const response = await adminClient.request("/api/users", {
    method: "POST",
    json: { ...identity, password },
    expectedStatuses: [201],
    metricLabel: "admin.user.create",
  });
  return requireData(response, "user");
}

async function runRehearsal(adminPassword) {
  const publicClient = new HttpSession("public");
  await publicClient.request("/api/competitions", {
    expectedStatuses: [401],
    retries: 0,
    metricLabel: "permission.unauthenticated",
  });

  const adminClient = new HttpSession("admin");
  await phase("Temporary administrator login", () =>
    adminClient.login(`${RUN_PREFIX}-admin@hotelsim.example`, adminPassword)
  );

  const accountPassword = `${randomBytes(24).toString("base64url")}Aa1!`;
  const students = await phase("Create 200 student accounts", async () => {
    const identities = Array.from({ length: PARTICIPANT_COUNT }, (_, index) => studentIdentity(index));
    return mapLimit(identities, 4, async (identity, index) => {
      const user = await createUser(adminClient, accountPassword, identity);
      if ((index + 1) % 25 === 0) log(`Created ${index + 1}/${PARTICIPANT_COUNT} student accounts.`);
      return { ...user, password: accountPassword };
    });
  });

  const teacher = await createUser(adminClient, accountPassword, {
    name: "生产演练总教练",
    email: `${RUN_PREFIX}-teacher@hotelsim.example`,
    role: "TEACHER",
  });
  const judges = await mapLimit(
    Array.from({ length: JUDGE_COUNT }, (_, index) => index),
    JUDGE_COUNT,
    (index) =>
      createUser(adminClient, accountPassword, {
        name: `演练评委 ${index + 1}`,
        email: `${RUN_PREFIX}-judge-${index + 1}@hotelsim.example`,
        role: "JUDGE",
      })
  );

  const teacherClient = new HttpSession("teacher");
  const judgeClients = judges.map((judge, index) => ({
    judge,
    client: new HttpSession(`judge-${index + 1}`),
  }));
  await phase("Teacher and judge login", async () => {
    await Promise.all([
      teacherClient.login(teacher.email, accountPassword),
      ...judgeClients.map(({ judge, client }) => client.login(judge.email, accountPassword)),
    ]);
  });

  const semesterResponse = await adminClient.request("/api/semesters", {
    method: "POST",
    json: {
      name: "2026 竞赛级 200 人生产演练",
      code: RUN_CODE,
      description: "保留在生产展示端的六轮、四十队、两百人完整演练记录。",
      creatorId: teacher.id,
      startDate: "2026-08-07T00:00:00.000Z",
      endDate: "2026-08-31T23:59:59.000Z",
    },
    expectedStatuses: [201],
    metricLabel: "semester.create",
  });
  const semester = requireData(semesterResponse, "semester");

  const classResponse = await teacherClient.request("/api/classes", {
    method: "POST",
    json: {
      semesterId: semester.id,
      name: "200 人竞赛实战主赛场",
      joinCode: "SIM200-20260807",
      maxTeams: TEAM_COUNT,
      minTeamSize: 4,
      maxTeamSize: 6,
      totalRooms: 500,
      maxRounds: ROUND_COUNT,
      simParameters: {
        totalMarketDemandBase: 12000,
        demandPerHotelBase: 820,
        totalRooms: 500,
        maxRoomNightsPerMonth: 15500,
        randomnessFactor: 0.08,
        competitionIntensity: 0.78,
      },
    },
    expectedStatuses: [201],
    metricLabel: "class.create",
  });
  const classRecord = requireData(classResponse, "class");

  await teacherClient.request("/api/simulation/parameters", {
    method: "PATCH",
    json: {
      classId: classRecord.id,
      simParameters: {
        totalMarketDemandBase: 12000,
        demandPerHotelBase: 820,
        totalRooms: 500,
        maxRoomNightsPerMonth: 15500,
        randomnessFactor: 0.08,
        competitionIntensity: 0.78,
        directBookingLift: 0.12,
        otaBillboardFactor: 0.08,
      },
    },
    metricLabel: "simulation.parameters.update",
  });
  await teacherClient.request(`/api/simulation/parameters?classId=${classRecord.id}`, {
    metricLabel: "simulation.parameters.read",
  });

  const competitionResponse = await teacherClient.request("/api/competitions", {
    method: "POST",
    json: {
      name: "SWUFE HotelSim 2026 竞赛级 200 人实战演练",
      code: RUN_CODE,
      description: "40 支酒店团队、200 名参赛者、3 名评委连续完成 6 轮经营决策。",
      status: "DRAFT",
      legacySemesterId: semester.id,
      startDate: "2026-08-07T00:00:00.000Z",
      endDate: "2026-08-31T23:59:59.000Z",
    },
    expectedStatuses: [201],
    metricLabel: "competition.create",
  });
  const competition = requireData(competitionResponse, "competition");

  const stageDefinitions = [
    ["预选经营赛", "需求识别与基础经营", 1],
    ["晋级攻坚赛", "品牌、渠道与成本协同", 2],
    ["冠军决胜赛", "复杂环境下的长期价值", 3],
  ];
  const stages = await mapLimit(stageDefinitions, 1, async ([name, description, stageOrder]) => {
    const response = await teacherClient.request("/api/competition-stages", {
      method: "POST",
      json: {
        competitionId: competition.id,
        name,
        description,
        stageOrder,
        status: "ACTIVE",
        maxRounds: 2,
      },
      expectedStatuses: [201],
      metricLabel: "competition.stage.create",
    });
    return requireData(response, "stage");
  });

  await mapLimit(judges, JUDGE_COUNT, (judge) =>
    adminClient.request("/api/judge-assignments", {
      method: "POST",
      json: { competitionId: competition.id, judgeId: judge.id },
      expectedStatuses: [201],
      metricLabel: "judge.assignment.create",
    })
  );

  await teacherClient.request("/api/competitions", {
    method: "PATCH",
    json: { competitionId: competition.id, status: "READY" },
    metricLabel: "competition.ready",
  });
  await teacherClient.request("/api/competitions", {
    method: "PATCH",
    json: { competitionId: competition.id, status: "ACTIVE" },
    metricLabel: "competition.active",
  });

  await teacherClient.request("/api/announcements", {
    method: "POST",
    json: {
      competitionId: competition.id,
      title: "200 人生产实战演练正式启动",
      content: "本场演练包含 200 名参赛者、40 支酒店团队、3 名评委和 6 个完整经营轮次；所有结果均由线上系统真实计算并持久化。",
      isPinned: true,
      isPublished: true,
    },
    expectedStatuses: [201],
    metricLabel: "announcement.create",
  });

  let teams = await phase("Create 40 five-person teams", () =>
    mapLimit(
      Array.from({ length: TEAM_COUNT }, (_, index) => index),
      6,
      async (teamIndex) => {
        const members = students.slice(teamIndex * TEAM_SIZE, (teamIndex + 1) * TEAM_SIZE);
        const response = await teacherClient.request("/api/teams", {
          method: "POST",
          json: {
            classId: classRecord.id,
            name: `实战经营 ${String(teamIndex + 1).padStart(2, "0")} 组`,
            hotelName: `西财云栖酒店 ${String(teamIndex + 1).padStart(2, "0")} 号`,
            color: ["#8B1A1A", "#0F4C81", "#B7791F", "#2563EB", "#047857", "#7C3AED", "#BE123C", "#334155"][teamIndex % 8],
            leaderUserId: members[0].id,
            memberUserIds: members.slice(1).map((member) => member.id),
          },
          expectedStatuses: [201],
          metricLabel: "team.create",
        });
        return requireData(response, "team");
      }
    )
  );

  const rosterExport = await adminClient.request(`/api/roster/csv?classId=${classRecord.id}`, {
    accept: "text/csv",
    metricLabel: "roster.export",
  });
  assert(rosterExport.text.includes("student_email"), "Roster CSV export is missing its header.");
  const rosterValidation = await adminClient.request("/api/roster/csv", {
    method: "POST",
    json: { classId: classRecord.id, csvText: rosterExport.text, mode: "validate" },
    metricLabel: "roster.validate",
  });
  assert(rosterValidation.payload?.data?.summary?.members === PARTICIPANT_COUNT, "Roster validation did not resolve 200 members.");
  await adminClient.request("/api/roster/csv", {
    method: "POST",
    json: { classId: classRecord.id, csvText: rosterExport.text, mode: "apply" },
    metricLabel: "roster.apply",
  });

  const teamsResponse = await teacherClient.request(`/api/teams?classId=${classRecord.id}`, {
    metricLabel: "teams.list",
  });
  teams = requireData(teamsResponse, "teams");
  assert(teams.length === TEAM_COUNT, `Expected ${TEAM_COUNT} teams after roster round-trip.`);

  const firstTeam = teams[0];
  const firstMembers = firstTeam.members;
  assert(firstMembers.length === TEAM_SIZE, "The first team does not contain five members.");
  const originalLeader = firstMembers.find((member) => member.role === "LEADER");
  const alternateLeader = firstMembers.find((member) => member.userId !== originalLeader.userId);
  await teacherClient.request("/api/teams", {
    method: "PATCH",
    json: {
      action: "updateMeta",
      teamId: firstTeam.id,
      name: firstTeam.name,
      hotelName: `${firstTeam.hotelName}（运营样板）`,
      color: firstTeam.color,
    },
    metricLabel: "team.meta.update",
  });
  await teacherClient.request("/api/teams", {
    method: "PATCH",
    json: { action: "setLeader", teamId: firstTeam.id, leaderUserId: alternateLeader.userId },
    metricLabel: "team.leader.change",
  });
  await teacherClient.request("/api/teams", {
    method: "PATCH",
    json: { action: "setLeader", teamId: firstTeam.id, leaderUserId: originalLeader.userId },
    metricLabel: "team.leader.restore",
  });

  const teamByUserId = new Map();
  for (const team of teams) {
    for (const member of team.members) teamByUserId.set(member.userId, team);
  }
  assert(teamByUserId.size === PARTICIPANT_COUNT, "Not every rehearsal student belongs to one team.");

  const studentClients = await phase("Login all 200 students", () =>
    mapLimit(students, 12, async (student, index) => {
      const client = new HttpSession(`student-${index + 1}`);
      await client.login(student.email, student.password);
      const team = teamByUserId.get(student.id);
      assert(team, `No team mapping exists for ${student.email}.`);
      return { student, client, team };
    })
  );

  await studentClients[0].client.request("/api/users", {
    expectedStatuses: [403],
    retries: 0,
    metricLabel: "permission.student-admin-api",
  });
  await studentClients[0].client.request(`/api/teams?teamId=${teams[1].id}`, {
    expectedStatuses: [404],
    retries: 0,
    metricLabel: "permission.cross-team",
  });

  const initializeResponse = await teacherClient.request("/api/simulation/run", {
    method: "POST",
    json: {
      classId: classRecord.id,
      action: "initialize",
      seasonFactor: 0.96,
      economyFactor: 1.02,
      eventFactor: 1.08,
      eventDescription: "生产演练第 1 轮：会展需求启动，市场进入预热期。",
      randomSeed: `${RUN_CODE}-ROUND-1`,
    },
    expectedStatuses: [201],
    timeoutMs: 180_000,
    metricLabel: "simulation.initialize",
  });
  assert(requireData(initializeResponse, "round").roundNumber === 1, "Round 1 initialization failed.");

  let latestLeaderboard = [];
  let latestRound = null;

  for (let roundNumber = 1; roundNumber <= ROUND_COUNT; roundNumber += 1) {
    await phase(`Round ${roundNumber} full operation`, async () => {
      const roundsResponse = await teacherClient.request(`/api/rounds?classId=${classRecord.id}`, {
        metricLabel: "rounds.list",
      });
      const roundData = roundsResponse.payload?.data;
      const round = roundData?.rounds?.find((item) => item.roundNumber === roundNumber);
      assert(round, `Round ${roundNumber} was not found.`);
      assert(roundData.currentRoundNumber === roundNumber, `Class pointer is not on round ${roundNumber}.`);
      latestRound = round;

      const stage = stages[Math.floor((roundNumber - 1) / 2)];
      const environment = [
        [0.96, 1.02, 1.08, "会展需求启动，市场进入预热期"],
        [1.08, 1.04, 1.12, "暑期休闲需求上升，渠道竞争加剧"],
        [0.92, 0.98, 0.94, "连续降雨与商务需求放缓"],
        [1.16, 1.06, 1.18, "大型国际会议带来需求高峰"],
        [1.02, 0.95, 0.9, "成本上涨与市场价格承压"],
        [1.2, 1.08, 1.24, "冠军决胜周，城市节庆与会展叠加"],
      ][roundNumber - 1];

      await teacherClient.request("/api/rounds", {
        method: "PATCH",
        json: {
          roundId: round.id,
          competitionStageId: stage.id,
          seasonFactor: environment[0],
          economyFactor: environment[1],
          eventFactor: environment[2],
          eventDescription: `生产演练第 ${roundNumber} 轮：${environment[3]}。`,
          randomSeed: `${RUN_CODE}-ROUND-${roundNumber}`,
        },
        metricLabel: "round.environment.update",
      });

      await mapLimit(studentClients, 25, async ({ client, team }) => {
        await client.request(`/api/teams?teamId=${team.id}`, {
          metricLabel: "student.team.read",
        });
        await client.request(`/api/decisions?teamId=${team.id}&roundId=${round.id}`, {
          metricLabel: "student.decision.read",
        });
      });

      const leaderClients = teams.map((team) => {
        const leader = team.members.find((member) => member.role === "LEADER");
        const session = studentClients.find((entry) => entry.student.id === leader.userId);
        assert(session, `No authenticated leader session exists for ${team.name}.`);
        return { team, client: session.client };
      });

      await mapLimit(leaderClients, 10, ({ team, client }, teamIndex) =>
        client.request("/api/decisions", {
          method: "POST",
          json: {
            teamId: team.id,
            roundId: round.id,
            ...buildDecision(teamIndex, roundNumber, "draft"),
          },
          expectedStatuses: [201],
          metricLabel: "decision.draft",
        })
      );

      if (roundNumber === 1) {
        await teacherClient.request("/api/simulation/run", {
          method: "POST",
          json: { classId: classRecord.id, action: "process" },
          expectedStatuses: [409],
          metricLabel: "guard.reject-drafts",
        });
      }

      await mapLimit(leaderClients, 10, ({ team, client }, teamIndex) =>
        client.request("/api/decisions", {
          method: "POST",
          json: {
            teamId: team.id,
            roundId: round.id,
            ...buildDecision(teamIndex, roundNumber, "submit"),
          },
          expectedStatuses: [200],
          metricLabel: "decision.submit",
        })
      );

      const decisionMonitor = await teacherClient.request(`/api/decisions?roundId=${round.id}`, {
        metricLabel: "decision.monitor",
      });
      const monitoredDecisions = requireData(decisionMonitor, "decisions");
      assert(monitoredDecisions.length === TEAM_COUNT, `Round ${roundNumber} does not have 40 decisions.`);
      assert(monitoredDecisions.every((decision) => decision.status === "SUBMITTED"), `Round ${roundNumber} has non-submitted decisions.`);

      const processPayload = { classId: classRecord.id, action: "process" };
      if (roundNumber === 3) {
        const raceResponses = await Promise.all([
          teacherClient.request("/api/simulation/run", {
            method: "POST",
            json: processPayload,
            expectedStatuses: [200, 409],
            timeoutMs: 240_000,
            metricLabel: "simulation.process.race",
          }),
          teacherClient.request("/api/simulation/run", {
            method: "POST",
            json: processPayload,
            expectedStatuses: [200, 409],
            timeoutMs: 240_000,
            metricLabel: "simulation.process.race",
          }),
        ]);
        const statuses = raceResponses.map((response) => response.status).sort();
        assert(statuses[0] === 200 && statuses[1] === 409, `Round processing race returned ${statuses.join(", ")}.`);
      } else {
        await teacherClient.request("/api/simulation/run", {
          method: "POST",
          json: processPayload,
          timeoutMs: 240_000,
          metricLabel: "simulation.process",
        });
      }

      await leaderClients[0].client.request("/api/decisions", {
        method: "POST",
        json: {
          teamId: leaderClients[0].team.id,
          roundId: round.id,
          ...buildDecision(0, roundNumber, "draft"),
        },
        expectedStatuses: [409],
        metricLabel: "guard.locked-decision",
      });

      const resultsResponse = await teacherClient.request(
        `/api/simulation/results?classId=${classRecord.id}&roundNumber=${roundNumber}`,
        { metricLabel: "results.teacher.read" }
      );
      const roundResults = requireData(resultsResponse, "results");
      latestLeaderboard = requireData(resultsResponse, "leaderboard");
      assert(roundResults.length === TEAM_COUNT, `Round ${roundNumber} does not have 40 results.`);
      assert(latestLeaderboard.length === TEAM_COUNT, `Round ${roundNumber} leaderboard does not have 40 teams.`);

      await mapLimit(judgeClients, JUDGE_COUNT, async ({ client }, judgeIndex) => {
        const judgeResults = await client.request(
          `/api/simulation/results?classId=${classRecord.id}&roundNumber=${roundNumber}`,
          { metricLabel: "results.judge.read" }
        );
        const accessibleResults = requireData(judgeResults, "results");
        assert(accessibleResults.length === TEAM_COUNT, `Judge ${judgeIndex + 1} cannot access all round results.`);
        await mapLimit(accessibleResults.slice(0, 12), 6, (result, resultIndex) =>
          client.request("/api/judge-scores", {
            method: "PATCH",
            json: {
              resultId: result.id,
              score: Number((78 + judgeIndex * 2.4 + (12 - resultIndex) * 0.65 + roundNumber * 0.35).toFixed(2)),
              comment: `第 ${roundNumber} 轮评审：经营逻辑完整，建议继续优化收益质量与长期韧性。`,
              breakdown: {
                strategy: 80 + judgeIndex,
                operations: 79 + roundNumber,
                finance: 78 + (resultIndex % 4),
                esg: 77 + ((teamByUserId.size + resultIndex) % 5),
              },
            },
            metricLabel: "judge.score.save",
          })
        );
      });

      await mapLimit(roundResults.slice(0, 5), 5, (result, resultIndex) =>
        teacherClient.request("/api/grading", {
          method: "PATCH",
          json: {
            resultId: result.id,
            teacherScore: Number((88 - resultIndex * 0.8 + roundNumber * 0.25).toFixed(2)),
            teacherComment: `第 ${roundNumber} 轮教师复核完成：关键经营指标、风险控制和决策解释均已检查。`,
          },
          metricLabel: "teacher.grading.save",
        })
      );

      await mapLimit(studentClients, 25, async ({ client, team }) => {
        const response = await client.request(`/api/simulation/results?teamId=${team.id}`, {
          metricLabel: "results.student.read",
        });
        const history = requireData(response, "results");
        assert(history.length === roundNumber, `Student result history should contain ${roundNumber} rounds.`);
      });

      await teacherClient.request("/api/announcements", {
        method: "POST",
        json: {
          competitionId: competition.id,
          title: `第 ${roundNumber} 轮演练完成`,
          content: `40 支团队已完成第 ${roundNumber} 轮决策提交、引擎计算、排行榜生成与评审抽查；累计覆盖 ${PARTICIPANT_COUNT} 名参赛者。`,
          isPinned: false,
          isPublished: true,
        },
        expectedStatuses: [201],
        metricLabel: "announcement.round-complete",
      });
    });
  }

  assert(latestRound, "No completed rehearsal round is available for advancement.");
  await phase("Advancement and export workflows", async () => {
    await mapLimit(latestLeaderboard.slice(0, 12), 6, (entry, index) =>
      teacherClient.request("/api/advancements", {
        method: "POST",
        json: {
          competitionId: competition.id,
          stageId: stages[2].id,
          teamId: entry.team.id,
          sourceRoundId: latestRound.id,
          targetClassId: classRecord.id,
          status: index < 8 ? "ADVANCED" : "QUALIFIED",
          note: `基于第 ${ROUND_COUNT} 轮综合排名生成的生产演练晋级记录。`,
        },
        expectedStatuses: [201],
        metricLabel: "advancement.create",
      })
    );

    const exportPaths = [
      `/api/export?classId=${classRecord.id}&roundNumber=${ROUND_COUNT}&scope=results&format=json`,
      `/api/export?classId=${classRecord.id}&roundNumber=${ROUND_COUNT}&scope=leaderboard&format=json`,
      `/api/export?classId=${classRecord.id}&roundNumber=${ROUND_COUNT}&scope=decisions&format=json`,
      `/api/export/grades?classId=${classRecord.id}&roundNumber=${ROUND_COUNT}&format=json`,
    ];
    await mapLimit(exportPaths, 4, async (path) => {
      const response = await teacherClient.request(path, { metricLabel: "export.read" });
      assert(response.payload?.data?.rows?.length === TEAM_COUNT, `${path} did not export 40 rows.`);
    });
  });

  await teacherClient.request("/api/announcements", {
    method: "POST",
    json: {
      competitionId: competition.id,
      title: "六轮 200 人生产演练全部通过",
      content: "本次演练完成 200 个学生账号登录、40 支团队六轮决策、240 份经营结果、评委评分、教师复核、并发冲突保护、晋级与导出校验。记录保留用于公开展示。",
      isPinned: true,
      isPublished: true,
    },
    expectedStatuses: [201],
    metricLabel: "announcement.final",
  });

  await adminClient.request("/api/audit-logs?limit=50", { metricLabel: "audit.read" });
  await adminClient.request("/api/observability", { metricLabel: "observability.read" });
  await adminClient.request("/api/alerts?limit=50", { metricLabel: "alerts.read" });
  await adminClient.request(`/api/judge-assignments?competitionId=${competition.id}`, {
    metricLabel: "judge.assignment.read",
  });
  await teacherClient.request(`/api/advancements?competitionId=${competition.id}`, {
    metricLabel: "advancement.read",
  });

  const publicChecks = [
    ["/display", "SWUFE HotelSim 2026 竞赛级 200 人实战演练"],
    ["/display/leaderboard", "第 6 轮公开成绩"],
    ["/display/announcements", "六轮 200 人生产演练全部通过"],
  ];
  await mapLimit(publicChecks, 3, async ([path, expectedText]) => {
    const response = await publicClient.request(`${path}?run=${RUN_ID}`, {
      accept: "text/html",
      metricLabel: `public${path}`,
    });
    assert(response.text.includes(expectedText), `${path} does not contain the expected rehearsal marker.`);
  });

  return { semester, classRecord, competition, students, teacher, judges, teams };
}

async function verifyDatabase(context) {
  const [studentCount, teacherCount, judgeCount, teamCount, memberCount, roundCount, decisionCount, resultCount, judgeScoreCount, announcementCount, advancementCount, hotelStateCount, competition, classRecord, rounds] = await Promise.all([
    prisma.user.count({ where: { email: { startsWith: `${RUN_PREFIX}-student-` } } }),
    prisma.user.count({ where: { email: `${RUN_PREFIX}-teacher@hotelsim.example` } }),
    prisma.user.count({ where: { email: { startsWith: `${RUN_PREFIX}-judge-` } } }),
    prisma.team.count({ where: { classId: context.classRecord.id } }),
    prisma.teamMember.count({ where: { classId: context.classRecord.id } }),
    prisma.round.count({ where: { classId: context.classRecord.id, status: "COMPLETED" } }),
    prisma.decision.count({ where: { round: { classId: context.classRecord.id }, status: "LOCKED" } }),
    prisma.roundResult.count({ where: { round: { classId: context.classRecord.id } } }),
    prisma.judgeScore.count({ where: { result: { round: { classId: context.classRecord.id } } } }),
    prisma.announcement.count({ where: { competitionId: context.competition.id, isPublished: true } }),
    prisma.advancement.count({ where: { competitionId: context.competition.id } }),
    prisma.hotelState.count({ where: { team: { classId: context.classRecord.id }, lastUpdatedRound: ROUND_COUNT } }),
    prisma.competition.findUnique({ where: { id: context.competition.id }, select: { status: true, code: true } }),
    prisma.class.findUnique({ where: { id: context.classRecord.id }, select: { status: true, currentRound: true, maxRounds: true } }),
    prisma.round.findMany({
      where: { classId: context.classRecord.id },
      select: {
        roundNumber: true,
        status: true,
        competitionStageId: true,
        _count: { select: { decisions: true, results: true } },
        results: { select: { rankOverall: true, finalScore: true } },
      },
      orderBy: { roundNumber: "asc" },
    }),
  ]);

  const counts = {
    students: studentCount,
    teachers: teacherCount,
    judges: judgeCount,
    teams: teamCount,
    members: memberCount,
    completedRounds: roundCount,
    lockedDecisions: decisionCount,
    results: resultCount,
    judgeScores: judgeScoreCount,
    announcements: announcementCount,
    advancements: advancementCount,
    finalHotelStates: hotelStateCount,
  };

  assert(studentCount === PARTICIPANT_COUNT, "Database student count invariant failed.");
  assert(teacherCount === 1 && judgeCount === JUDGE_COUNT, "Database staff count invariant failed.");
  assert(teamCount === TEAM_COUNT && memberCount === PARTICIPANT_COUNT, "Database roster invariant failed.");
  assert(roundCount === ROUND_COUNT, "Database completed round count invariant failed.");
  assert(decisionCount === TEAM_COUNT * ROUND_COUNT, "Database decision count invariant failed.");
  assert(resultCount === TEAM_COUNT * ROUND_COUNT, "Database result count invariant failed.");
  assert(judgeScoreCount === (12 * JUDGE_COUNT + 5) * ROUND_COUNT, "Database judge score count invariant failed.");
  assert(announcementCount === ROUND_COUNT + 2, "Database announcement count invariant failed.");
  assert(advancementCount === 12, "Database advancement count invariant failed.");
  assert(hotelStateCount === TEAM_COUNT, "Hotel states did not all advance to round 6.");
  assert(competition?.status === "ACTIVE" && competition.code === RUN_CODE, "Competition is not active for display.");
  assert(classRecord?.status === "COMPLETED" && classRecord.currentRound === ROUND_COUNT, "Class did not finish on round 6.");
  assert(rounds.length === ROUND_COUNT, "Unexpected round records were created.");

  for (const round of rounds) {
    assert(round.status === "COMPLETED", `Round ${round.roundNumber} is not completed.`);
    assert(round.competitionStageId, `Round ${round.roundNumber} is not linked to a competition stage.`);
    assert(round._count.decisions === TEAM_COUNT && round._count.results === TEAM_COUNT, `Round ${round.roundNumber} row counts are inconsistent.`);
    const ranks = round.results.map((result) => result.rankOverall).sort((a, b) => a - b);
    assert(ranks.every((rank, index) => rank === index + 1), `Round ${round.roundNumber} rankings are not a complete 1..40 sequence.`);
    assert(round.results.every((result) => Number.isFinite(result.finalScore)), `Round ${round.roundNumber} contains an invalid final score.`);
  }

  return counts;
}

function buildSummary(counts) {
  const durations = metrics.map((entry) => entry.durationMs);
  const statusCounts = Object.fromEntries(
    Array.from(new Set(metrics.map((entry) => entry.status)))
      .sort((a, b) => a - b)
      .map((status) => [String(status), metrics.filter((entry) => entry.status === status).length])
  );
  const serverErrors = metrics.filter((entry) => entry.status >= 500 || entry.status === 0);
  const unexpected = metrics.filter((entry) => !entry.expected);
  assert(serverErrors.length === 0, `Observed ${serverErrors.length} network/5xx responses.`);
  assert(unexpected.length === 0, `Observed ${unexpected.length} unexpected HTTP responses.`);

  return {
    runCode: RUN_CODE,
    runId: RUN_ID,
    baseUrl: BASE_URL,
    completedAt: new Date().toISOString(),
    requestMetrics: {
      total: metrics.length,
      statusCounts,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      p99Ms: percentile(durations, 99),
      maxMs: Math.max(...durations),
      networkOr5xxErrors: serverErrors.length,
      unexpectedResponses: unexpected.length,
    },
    databaseCounts: counts,
    phaseTimings,
    displayPaths: ["/display", "/display/leaderboard", "/display/announcements"],
  };
}

function writeGitHubSummary(summary) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const rows = summary.phaseTimings
    .map((entry) => `| ${entry.name} | ${(entry.durationMs / 1000).toFixed(1)} s |`)
    .join("\n");
  appendFileSync(
    summaryPath,
    `# SWUFE HotelSim 200-person production rehearsal\n\n` +
      `- Run: \`${summary.runCode}\`\n` +
      `- Requests: **${summary.requestMetrics.total}**\n` +
      `- HTTP/network 5xx failures: **${summary.requestMetrics.networkOr5xxErrors}**\n` +
      `- p50 / p95 / p99: **${summary.requestMetrics.p50Ms} / ${summary.requestMetrics.p95Ms} / ${summary.requestMetrics.p99Ms} ms**\n` +
      `- Persisted: **${summary.databaseCounts.students} students, ${summary.databaseCounts.teams} teams, ${summary.databaseCounts.completedRounds} rounds, ${summary.databaseCounts.results} results**\n\n` +
      `| Phase | Duration |\n| --- | ---: |\n${rows}\n`
  );
}

async function main() {
  let temporaryAdmin = null;
  try {
    await phase("Reset owned rehearsal namespace", resetOwnedNamespace);
    const adminPassword = `${randomBytes(30).toString("base64url")}Aa1!`;
    temporaryAdmin = await phase("Create temporary administrator", () =>
      createTemporaryAdmin(adminPassword)
    );
    const context = await runRehearsal(adminPassword);
    const counts = await phase("Verify production database invariants", () =>
      verifyDatabase(context)
    );
    const summary = buildSummary(counts);
    writeGitHubSummary(summary);
    log(`SUCCESS ${JSON.stringify(summary)}`);
  } finally {
    if (temporaryAdmin) {
      await prisma.user.deleteMany({ where: { id: temporaryAdmin.id } });
      log("Temporary administrator removed; persistent rehearsal records were retained.");
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`[rehearsal:${RUN_CODE}] FAILED`, error);
  process.exitCode = 1;
});
