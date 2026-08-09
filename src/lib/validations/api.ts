import { type Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

const trimmedString = (label: string) =>
  z.string().trim().min(1, `${label} is required.`);

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  },
  z.string().optional()
);

const normalizedEmail = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please enter a valid email address.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password cannot be longer than 72 characters.");

const optionalNullableTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  },
  z.string().nullable().optional()
);

const optionalIsoDate = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? new Date(normalized) : undefined;
  },
  z.date().optional()
);

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.coerce.number().int().min(minimum).max(maximum).optional()
  );

const optionalNullableNumber = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    },
    z.coerce.number().min(minimum).max(maximum).nullable().optional()
  );

// Prisma JSON columns accept nested JSON values but not top-level null. Keep
// this recursive schema here so future class-level simulation settings stay
// type-safe all the way from request validation into Prisma writes.
const jsonValueSchema: z.ZodType<Prisma.InputJsonValue | null> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(
  z.string(),
  jsonValueSchema
);

export const semesterCreateSchema = z
  .object({
    name: trimmedString("Semester name").max(120, "Semester name is too long."),
    code: trimmedString("Semester code").max(80, "Semester code is too long."),
    description: optionalTrimmedString,
    creatorId: optionalTrimmedString,
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      value.endDate.getTime() < value.startDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export const classCreateSchema = z
  .object({
    semesterId: trimmedString("Semester ID"),
    name: trimmedString("Class name").max(120, "Class name is too long."),
    joinCode: optionalTrimmedString,
    // Teacher forms may omit these tuning fields. Normalize empty strings to
    // `undefined` here so the API preserves server-side defaults instead of
    // coercing blank form values into zero and failing validation.
    maxTeams: optionalInteger(1, 50),
    minTeamSize: optionalInteger(1, 20),
    maxTeamSize: optionalInteger(1, 20),
    totalRooms: optionalInteger(1, 5000),
    maxRounds: optionalInteger(1, 24),
    simParameters: jsonObjectSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const minTeamSize = value.minTeamSize ?? 3;
    const maxTeamSize = value.maxTeamSize ?? 6;

    if (minTeamSize > maxTeamSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxTeamSize"],
        message: "Max team size must be greater than or equal to min team size.",
      });
    }
  });

export const teamCreateSchema = z.object({
  classId: trimmedString("Class ID"),
  name: trimmedString("Team name").max(120, "Team name is too long."),
  hotelName: trimmedString("Hotel name").max(120, "Hotel name is too long."),
  color: optionalTrimmedString,
  leaderUserId: trimmedString("Leader user ID"),
  memberUserIds: z.array(z.string().trim().min(1)).optional(),
});

export const teamMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateMeta"),
    teamId: trimmedString("Team ID"),
    name: trimmedString("Team name").max(120, "Team name is too long."),
    hotelName: trimmedString("Hotel name").max(120, "Hotel name is too long."),
    color: optionalTrimmedString,
  }),
  z.object({
    action: z.literal("setLeader"),
    teamId: trimmedString("Team ID"),
    leaderUserId: trimmedString("Leader user ID"),
  }),
  z.object({
    action: z.literal("addMember"),
    teamId: trimmedString("Team ID"),
    userId: trimmedString("User ID"),
  }),
  z.object({
    action: z.literal("removeMember"),
    teamId: trimmedString("Team ID"),
    userId: trimmedString("User ID"),
  }),
  z.object({
    action: z.literal("moveMember"),
    sourceTeamId: trimmedString("Source team ID"),
    targetTeamId: trimmedString("Target team ID"),
    userId: trimmedString("User ID"),
  }),
]);

export const rosterCsvMutationSchema = z.object({
  classId: trimmedString("Class ID"),
  csvText: z
    .string()
    .trim()
    .min(1, "CSV content is required.")
    .max(1_000_000, "CSV content is too large."),
  mode: z.enum(["validate", "apply"]),
});

export const decisionMutationSchema = z.object({
  teamId: trimmedString("Team ID"),
  roundId: trimmedString("Round ID"),
  mode: z.enum(["draft", "submit"]),
  priceBusinessTransient: z.number().finite().optional(),
  priceBusinessGroup: z.number().finite().optional(),
  priceLeisureTransient: z.number().finite().optional(),
  priceLeisureGroup: z.number().finite().optional(),
  priceGovernment: z.number().finite().optional(),
  priceOnlineOTA: z.number().finite().optional(),
  priceAirlineCrew: z.number().finite().optional(),
  priceLongStay: z.number().finite().optional(),
  marketingTotal: z.number().finite().optional(),
  mktBudgetBusinessTransient: z.number().finite().optional(),
  mktBudgetBusinessGroup: z.number().finite().optional(),
  mktBudgetLeisureTransient: z.number().finite().optional(),
  mktBudgetLeisureGroup: z.number().finite().optional(),
  mktBudgetGovernment: z.number().finite().optional(),
  mktBudgetOnlineOTA: z.number().finite().optional(),
  mktBudgetAirlineCrew: z.number().finite().optional(),
  mktBudgetLongStay: z.number().finite().optional(),
  channelDirect: z.number().finite().optional(),
  channelOTA: z.number().finite().optional(),
  channelTravelAgent: z.number().finite().optional(),
  channelCorporate: z.number().finite().optional(),
  channelGDS: z.number().finite().optional(),
  opexRoomsMaintenance: z.number().finite().optional(),
  opexFoodBeverage: z.number().finite().optional(),
  opexFrontDesk: z.number().finite().optional(),
  opexHousekeeping: z.number().finite().optional(),
  opexUtilities: z.number().finite().optional(),
  opexStaffTraining: z.number().finite().optional(),
  opexStaffWelfare: z.number().finite().optional(),
  opexSecurity: z.number().finite().optional(),
  opexIT: z.number().finite().optional(),
  capexRenovation: z.number().finite().optional(),
  capexFurniture: z.number().finite().optional(),
  capexTechnology: z.number().finite().optional(),
  capexFacilities: z.number().finite().optional(),
  capexESGGreen: z.number().finite().optional(),
  newLoanAmount: z.number().finite().optional(),
  loanRepayment: z.number().finite().optional(),
  esgEnergyInvestment: z.number().finite().optional(),
  esgWasteManagement: z.number().finite().optional(),
  esgCommunityEngagement: z.number().finite().optional(),
  esgEmployeeDiversity: z.number().finite().optional(),
  taxStrategy: optionalTrimmedString,
});

const roundEnvironmentShape = {
  seasonFactor: z.number().finite().min(0).max(10).optional(),
  economyFactor: z.number().finite().min(0).max(10).optional(),
  eventFactor: z.number().finite().min(0).max(10).optional(),
  eventDescription: z
    .string()
    .trim()
    .max(500, "Event description must be 500 characters or fewer.")
    .optional(),
  randomSeed: z
    .string()
    .trim()
    .max(200, "Random seed must be 200 characters or fewer.")
    .optional(),
} satisfies Record<string, z.ZodTypeAny>;

export const simulationRunSchema = z.object({
  classId: trimmedString("Class ID"),
  action: z.enum(["initialize", "process"]),
  ...roundEnvironmentShape,
});

export const competitionCreateSchema = z
  .object({
    name: trimmedString("Competition name").max(
      160,
      "Competition name is too long."
    ),
    code: trimmedString("Competition code").max(
      80,
      "Competition code is too long."
    ),
    description: optionalTrimmedString,
    status: z
      .enum(["DRAFT", "READY", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .default("DRAFT"),
    legacySemesterId: optionalTrimmedString,
    rulesetId: optionalTrimmedString,
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      value.endDate.getTime() < value.startDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export const competitionStatusUpdateSchema = z.object({
  competitionId: trimmedString("Competition ID"),
  status: z.enum(["DRAFT", "READY", "ACTIVE", "COMPLETED", "ARCHIVED"]),
});

export const competitionStageCreateSchema = z.object({
  competitionId: trimmedString("Competition ID"),
  name: trimmedString("Stage name").max(160, "Stage name is too long."),
  stageOrder: z.coerce.number().int().min(1).max(99),
  description: optionalTrimmedString,
  status: z
    .enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"])
    .default("DRAFT"),
  maxRounds: optionalInteger(1, 48),
});

export const advancementCreateSchema = z.object({
  competitionId: trimmedString("Competition ID"),
  stageId: optionalTrimmedString,
  teamId: trimmedString("Team ID"),
  sourceRoundId: optionalTrimmedString,
  targetClassId: optionalTrimmedString,
  status: z
    .enum(["QUALIFIED", "ADVANCED", "ELIMINATED", "WAITLISTED"])
    .default("QUALIFIED"),
  note: optionalTrimmedString,
});

export const announcementCreateSchema = z.object({
  competitionId: optionalTrimmedString,
  title: trimmedString("Announcement title").max(
    180,
    "Announcement title is too long."
  ),
  content: trimmedString("Announcement content").max(
    8000,
    "Announcement content is too long."
  ),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  publishedAt: optionalIsoDate,
});

export const judgeAssignmentMutationSchema = z.object({
  competitionId: trimmedString("Competition ID"),
  judgeId: trimmedString("Judge ID"),
});

const simulationParameterPatchSchema = z
  .object({
    totalMarketDemandBase: z.number().finite().min(1000).max(12000).optional(),
    demandPerHotelBase: z.number().finite().min(100).max(2500).optional(),
    totalRooms: z.number().finite().min(50).max(3000).optional(),
    daysInMonth: z.number().finite().min(20).max(31).optional(),
    maxRoomNightsPerMonth: z.number().finite().min(1000).max(50000).optional(),
    fbRevenueRatio: z.number().finite().min(0).max(1).optional(),
    otherRevenueRatio: z.number().finite().min(0).max(1).optional(),
    basePropertyTaxRate: z.number().finite().min(0).max(0.2).optional(),
    corporateTaxRate: z.number().finite().min(0).max(0.5).optional(),
    vatRate: z.number().finite().min(0).max(0.3).optional(),
    depreciationRate: z.number().finite().min(0).max(0.2).optional(),
    randomnessFactor: z.number().finite().min(0).max(0.3).optional(),
    competitionIntensity: z.number().finite().min(0).max(1).optional(),
    brandDecayRate: z.number().finite().min(0).max(0.2).optional(),
    conditionDecayRate: z.number().finite().min(0).max(0.2).optional(),
    serviceStrainThreshold: z.number().finite().min(0.5).max(0.98).optional(),
    laborCostSensitivity: z.number().finite().min(0).max(0.6).optional(),
    weatherEnergySensitivity: z.number().finite().min(0).max(0.4).optional(),
    otaBillboardFactor: z.number().finite().min(0).max(0.2).optional(),
    directBookingLift: z.number().finite().min(0).max(0.25).optional(),
    facilitiesUpsellFactor: z.number().finite().min(0).max(0.3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one simulation parameter to update.",
  });

export const simulationParametersMutationSchema = z.object({
  classId: trimmedString("Class ID"),
  simParameters: simulationParameterPatchSchema,
});

export const roundCreateSchema = z.object({
  classId: trimmedString("Class ID"),
  roundNumber: z.coerce.number().int().min(1).optional(),
  deadline: optionalIsoDate,
  competitionStageId: optionalTrimmedString,
  ...roundEnvironmentShape,
});

export const roundUpdateSchema = z
  .object({
    roundId: trimmedString("Round ID"),
    competitionStageId: optionalNullableTrimmedString,
    ...roundEnvironmentShape,
  })
  .refine(
    (value) =>
      value.seasonFactor !== undefined ||
      value.economyFactor !== undefined ||
      value.eventFactor !== undefined ||
      value.eventDescription !== undefined ||
      value.randomSeed !== undefined ||
      value.competitionStageId !== undefined,
    {
      message: "Provide at least one round environment field to update.",
    }
  );

export const gradingMutationSchema = z
  .object({
    resultId: trimmedString("Result ID"),
    teacherScore: optionalNullableNumber(0, 100),
    teacherComment: optionalNullableTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (
      value.teacherScore === undefined &&
      value.teacherComment === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide teacherScore or teacherComment.",
      });
    }

    if (
      typeof value.teacherComment === "string" &&
      value.teacherComment.length > 2000
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teacherComment"],
        message: "Teacher comment must be 2000 characters or fewer.",
      });
    }
  });

export const judgeScoreMutationSchema = z
  .object({
    resultId: trimmedString("Result ID"),
    score: optionalNullableNumber(0, 100),
    comment: optionalNullableTrimmedString,
    breakdown: jsonObjectSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.score === undefined &&
      value.comment === undefined &&
      value.breakdown === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide score, comment, or breakdown.",
      });
    }

    if (typeof value.comment === "string" && value.comment.length > 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["comment"],
        message: "Judge comment must be 2000 characters or fewer.",
      });
    }
  });

export const adminUserCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(50, "Name cannot be longer than 50 characters."),
  email: normalizedEmail,
  password: passwordSchema,
  role: z.nativeEnum(UserRole),
  studentId: optionalTrimmedString,
});

export const adminUserRoleUpdateSchema = z.object({
  userId: trimmedString("User ID"),
  role: z.nativeEnum(UserRole),
});
