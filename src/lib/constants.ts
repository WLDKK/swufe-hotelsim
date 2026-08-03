// Stage 3 uses these market segments as the canonical order for pricing,
// marketing, demand capture, and result reporting. Once real data exists, keep
// ids stable so stored decisions/results remain compatible.
export const MARKET_SEGMENTS = [
  {
    id: "business_transient",
    nameZh: "\u5546\u52a1\u6563\u5ba2",
    nameEn: "Business Transient",
    baselineDemandShare: 0.2,
    priceElasticity: -1.2,
    qualitySensitivity: 0.8,
    marketingSensitivity: 0.6,
    seasonalPattern: [0.8, 0.7, 0.9, 1, 1.1, 0.9, 0.7, 0.7, 1, 1.1, 1.1, 0.8],
    defaultPrice: 580,
    priceFloor: 300,
    priceCeiling: 1200,
  },
  {
    id: "business_group",
    nameZh: "\u5546\u52a1\u56e2\u961f/\u4f1a\u8bae",
    nameEn: "Business Group/MICE",
    baselineDemandShare: 0.15,
    priceElasticity: -0.9,
    qualitySensitivity: 0.7,
    marketingSensitivity: 0.7,
    seasonalPattern: [0.6, 0.5, 0.9, 1.1, 1.2, 0.8, 0.5, 0.5, 1.1, 1.2, 1.1, 0.7],
    defaultPrice: 520,
    priceFloor: 280,
    priceCeiling: 1000,
  },
  {
    id: "leisure_transient",
    nameZh: "\u4f11\u95f2\u6563\u5ba2",
    nameEn: "Leisure Transient",
    baselineDemandShare: 0.18,
    priceElasticity: -1.5,
    qualitySensitivity: 0.9,
    marketingSensitivity: 0.8,
    seasonalPattern: [0.7, 0.9, 0.8, 0.9, 1.2, 1, 1.4, 1.4, 1, 1.3, 0.8, 0.7],
    defaultPrice: 480,
    priceFloor: 200,
    priceCeiling: 1000,
  },
  {
    id: "leisure_group",
    nameZh: "\u4f11\u95f2\u56e2\u961f/\u65c5\u884c\u793e",
    nameEn: "Leisure Group",
    baselineDemandShare: 0.12,
    priceElasticity: -1.8,
    qualitySensitivity: 0.6,
    marketingSensitivity: 0.9,
    seasonalPattern: [0.6, 0.8, 0.7, 0.9, 1.3, 1, 1.5, 1.5, 1, 1.4, 0.7, 0.6],
    defaultPrice: 420,
    priceFloor: 180,
    priceCeiling: 800,
  },
  {
    id: "government",
    nameZh: "\u653f\u5e9c/\u4e8b\u4e1a\u5355\u4f4d",
    nameEn: "Government",
    baselineDemandShare: 0.1,
    priceElasticity: -0.6,
    qualitySensitivity: 0.5,
    marketingSensitivity: 0.4,
    seasonalPattern: [0.7, 0.5, 1, 1.1, 1, 1, 0.6, 0.5, 1.1, 1, 1.1, 0.8],
    defaultPrice: 400,
    priceFloor: 250,
    priceCeiling: 600,
  },
  {
    id: "online_ota",
    nameZh: "OTA\u7ebf\u4e0a\u6e20\u9053",
    nameEn: "Online/OTA",
    baselineDemandShare: 0.12,
    priceElasticity: -2,
    qualitySensitivity: 1,
    marketingSensitivity: 0.5,
    seasonalPattern: [0.8, 0.9, 0.9, 1, 1.2, 1, 1.3, 1.3, 1, 1.1, 0.9, 0.8],
    defaultPrice: 450,
    priceFloor: 150,
    priceCeiling: 900,
  },
  {
    id: "airline_crew",
    nameZh: "\u822a\u7a7a\u673a\u7ec4",
    nameEn: "Airline Crew",
    baselineDemandShare: 0.05,
    priceElasticity: -0.4,
    qualitySensitivity: 0.3,
    marketingSensitivity: 0.2,
    seasonalPattern: [1, 1, 1, 1, 1, 1, 1.1, 1.1, 1, 1, 1, 1],
    defaultPrice: 320,
    priceFloor: 200,
    priceCeiling: 500,
  },
  {
    id: "long_stay",
    nameZh: "\u957f\u4f4f\u5ba2",
    nameEn: "Long Stay",
    baselineDemandShare: 0.08,
    priceElasticity: -1,
    qualitySensitivity: 0.7,
    marketingSensitivity: 0.3,
    seasonalPattern: [1, 1, 1, 1, 1, 1, 0.9, 0.9, 1, 1, 1, 1],
    defaultPrice: 350,
    priceFloor: 200,
    priceCeiling: 600,
  },
] as const;

// These are the default engine knobs. Stage 1 stores per-class overrides in
// Class.simParameters so Stage 3 can evolve formulas without another schema
// migration for every tuning parameter.
export const DEFAULT_SIM_PARAMETERS = {
  totalMarketDemandBase: 4500,
  demandPerHotelBase: 600,
  totalRooms: 500,
  daysInMonth: 30,
  maxRoomNightsPerMonth: 15000,
  fbRevenueRatio: 0.2,
  otherRevenueRatio: 0.08,
  basePropertyTaxRate: 0.012,
  corporateTaxRate: 0.25,
  vatRate: 0.06,
  depreciationRate: 0.02,
  randomnessFactor: 0.03,
  competitionIntensity: 0.76,
  brandDecayRate: 0.012,
  conditionDecayRate: 0.004,
  // Occupancy above this threshold tends to create front-desk, housekeeping,
  // and recovery pressure unless the team invests enough in people and tools.
  serviceStrainThreshold: 0.78,
  // Captures overtime, temp labor, and operating inefficiency when demand is
  // high but staffing support is thin.
  laborCostSensitivity: 0.16,
  // Weather-sensitive properties see utilities swing with HVAC load and
  // climate stress, especially during heatwaves and cold snaps.
  weatherEnergySensitivity: 0.1,
  // OTAs can still create discovery value, but only as a mild billboard
  // effect rather than a dominant source of incremental demand.
  otaBillboardFactor: 0.04,
  // Strong direct/corporate capability usually monetizes better than pure OTA
  // volume when brand and technology are in place.
  directBookingLift: 0.06,
  // Meeting rooms, banquet space, and public-area upgrades improve group and
  // event monetization rather than generic transient demand.
  facilitiesUpsellFactor: 0.08,
} as const;

// Shared brand colors keep the landing page and remaining admin scaffolds
// visually aligned with the course theme until the admin experience is built.
export const SWUFE_COLORS = {
  primary: "#8B1A1A",
  secondary: "#C9A84C",
  accent: "#1B3A5C",
  background: "#F8F6F1",
  surface: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280",
} as const;

// Use ASCII-safe Unicode escapes here so the file remains readable even in
// terminals with a mismatched Windows code page.
export const ROLE_LABELS: Record<string, string> = {
  STUDENT: "\u5b66\u751f",
  TEACHER: "\u6559\u5e08",
  JUDGE: "\u88c1\u5224",
  SPECTATOR: "\u89c2\u8d5b",
  ADMIN: "\u7ba1\u7406\u5458",
  LEADER: "\u961f\u957f",
  MARKETING_MANAGER: "\u5e02\u573a\u8425\u9500\u7ecf\u7406",
  OPERATIONS_MANAGER: "\u8fd0\u8425\u7ecf\u7406",
  FINANCE_MANAGER: "\u8d22\u52a1\u7ecf\u7406",
  REVENUE_MANAGER: "\u6536\u76ca\u7ba1\u7406\u7ecf\u7406",
  MEMBER: "\u961f\u5458",
};

// Round 1 maps to January and round 12 maps to December in the original plan.
export const ROUND_MONTH_MAP = [
  "\u4e00\u6708",
  "\u4e8c\u6708",
  "\u4e09\u6708",
  "\u56db\u6708",
  "\u4e94\u6708",
  "\u516d\u6708",
  "\u4e03\u6708",
  "\u516b\u6708",
  "\u4e5d\u6708",
  "\u5341\u6708",
  "\u5341\u4e00\u6708",
  "\u5341\u4e8c\u6708",
] as const;

export type MarketSegment = (typeof MARKET_SEGMENTS)[number];
export type MarketSegmentId = MarketSegment["id"];
export type SimParameters = {
  [Key in keyof typeof DEFAULT_SIM_PARAMETERS]: number;
};
