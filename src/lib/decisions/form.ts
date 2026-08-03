export const DEFAULT_DECISION_FORM_VALUES = {
  priceBusinessTransient: 580,
  priceBusinessGroup: 520,
  priceLeisureTransient: 480,
  priceLeisureGroup: 420,
  priceGovernment: 400,
  priceOnlineOTA: 450,
  priceAirlineCrew: 320,
  priceLongStay: 350,
  marketingTotal: 80,
  mktBudgetBusinessTransient: 15,
  mktBudgetBusinessGroup: 10,
  mktBudgetLeisureTransient: 15,
  mktBudgetLeisureGroup: 10,
  mktBudgetGovernment: 8,
  mktBudgetOnlineOTA: 12,
  mktBudgetAirlineCrew: 5,
  mktBudgetLongStay: 5,
  channelDirect: 30,
  channelOTA: 35,
  channelTravelAgent: 15,
  channelCorporate: 15,
  channelGDS: 5,
  opexRoomsMaintenance: 30,
  opexFoodBeverage: 25,
  opexFrontDesk: 15,
  opexHousekeeping: 20,
  opexUtilities: 18,
  opexStaffTraining: 8,
  opexStaffWelfare: 6,
  opexSecurity: 5,
  opexIT: 8,
  capexRenovation: 0,
  capexFurniture: 0,
  capexTechnology: 0,
  capexFacilities: 0,
  capexESGGreen: 0,
  newLoanAmount: 0,
  loanRepayment: 0,
  esgEnergyInvestment: 30,
  esgWasteManagement: 30,
  esgCommunityEngagement: 20,
  esgEmployeeDiversity: 20,
  taxStrategy: "STANDARD",
} as const;

type WidenDecisionValue<T> = T extends number
  ? number
  : T extends string
    ? string
    : T;

export type DecisionFormValues = {
  [Key in keyof typeof DEFAULT_DECISION_FORM_VALUES]: WidenDecisionValue<
    (typeof DEFAULT_DECISION_FORM_VALUES)[Key]
  >;
};

// Export the canonical field order once so every form builder, API payload
// mapper, and later validation layer iterates over the same decision keys.
export const DECISION_FORM_FIELDS = Object.keys(
  DEFAULT_DECISION_FORM_VALUES
) as Array<keyof DecisionFormValues>;

type DecisionFieldConfig = {
  name: keyof DecisionFormValues;
  label: string;
  step?: string;
  min?: number;
};

type DecisionFieldGroup = {
  title: string;
  description: string;
  fields: DecisionFieldConfig[];
};

export const DECISION_FORM_GROUPS: DecisionFieldGroup[] = [
  {
    title: "Pricing",
    description: "Set room rates for each market segment.",
    fields: [
      { name: "priceBusinessTransient", label: "Business Transient", step: "1", min: 0 },
      { name: "priceBusinessGroup", label: "Business Group", step: "1", min: 0 },
      { name: "priceLeisureTransient", label: "Leisure Transient", step: "1", min: 0 },
      { name: "priceLeisureGroup", label: "Leisure Group", step: "1", min: 0 },
      { name: "priceGovernment", label: "Government", step: "1", min: 0 },
      { name: "priceOnlineOTA", label: "Online / OTA", step: "1", min: 0 },
      { name: "priceAirlineCrew", label: "Airline Crew", step: "1", min: 0 },
      { name: "priceLongStay", label: "Long Stay", step: "1", min: 0 },
    ],
  },
  {
    title: "Marketing",
    description: "Allocate the overall marketing budget across target segments.",
    fields: [
      { name: "marketingTotal", label: "Marketing Total", step: "1", min: 0 },
      { name: "mktBudgetBusinessTransient", label: "Business Transient", step: "0.1", min: 0 },
      { name: "mktBudgetBusinessGroup", label: "Business Group", step: "0.1", min: 0 },
      { name: "mktBudgetLeisureTransient", label: "Leisure Transient", step: "0.1", min: 0 },
      { name: "mktBudgetLeisureGroup", label: "Leisure Group", step: "0.1", min: 0 },
      { name: "mktBudgetGovernment", label: "Government", step: "0.1", min: 0 },
      { name: "mktBudgetOnlineOTA", label: "Online / OTA", step: "0.1", min: 0 },
      { name: "mktBudgetAirlineCrew", label: "Airline Crew", step: "0.1", min: 0 },
      { name: "mktBudgetLongStay", label: "Long Stay", step: "0.1", min: 0 },
    ],
  },
  {
    title: "Channels",
    description: "Define the demand mix by booking channel in percentages.",
    fields: [
      { name: "channelDirect", label: "Direct", step: "0.1", min: 0 },
      { name: "channelOTA", label: "OTA", step: "0.1", min: 0 },
      { name: "channelTravelAgent", label: "Travel Agent", step: "0.1", min: 0 },
      { name: "channelCorporate", label: "Corporate", step: "0.1", min: 0 },
      { name: "channelGDS", label: "GDS", step: "0.1", min: 0 },
    ],
  },
  {
    title: "Operating Costs",
    description: "Monthly operating spend levels in 10k RMB.",
    fields: [
      { name: "opexRoomsMaintenance", label: "Rooms Maintenance", step: "0.1", min: 0 },
      { name: "opexFoodBeverage", label: "Food & Beverage", step: "0.1", min: 0 },
      { name: "opexFrontDesk", label: "Front Desk", step: "0.1", min: 0 },
      { name: "opexHousekeeping", label: "Housekeeping", step: "0.1", min: 0 },
      { name: "opexUtilities", label: "Utilities", step: "0.1", min: 0 },
      { name: "opexStaffTraining", label: "Staff Training", step: "0.1", min: 0 },
      { name: "opexStaffWelfare", label: "Staff Welfare", step: "0.1", min: 0 },
      { name: "opexSecurity", label: "Security", step: "0.1", min: 0 },
      { name: "opexIT", label: "IT", step: "0.1", min: 0 },
    ],
  },
  {
    title: "Capital & Financing",
    description: "Longer-term investment and financing decisions for this round.",
    fields: [
      { name: "capexRenovation", label: "Renovation", step: "0.1", min: 0 },
      { name: "capexFurniture", label: "Furniture", step: "0.1", min: 0 },
      { name: "capexTechnology", label: "Technology", step: "0.1", min: 0 },
      { name: "capexFacilities", label: "Facilities", step: "0.1", min: 0 },
      { name: "capexESGGreen", label: "ESG / Green", step: "0.1", min: 0 },
      { name: "newLoanAmount", label: "New Loan Amount", step: "0.1", min: 0 },
      { name: "loanRepayment", label: "Loan Repayment", step: "0.1", min: 0 },
    ],
  },
  {
    title: "ESG",
    description: "ESG intensity levels for the current operating cycle.",
    fields: [
      { name: "esgEnergyInvestment", label: "Energy Investment", step: "0.1", min: 0 },
      { name: "esgWasteManagement", label: "Waste Management", step: "0.1", min: 0 },
      { name: "esgCommunityEngagement", label: "Community Engagement", step: "0.1", min: 0 },
      { name: "esgEmployeeDiversity", label: "Employee Diversity", step: "0.1", min: 0 },
    ],
  },
];

export const TAX_STRATEGY_OPTIONS = [
  { value: "STANDARD", label: "Standard" },
  { value: "INCENTIVE_FOCUS", label: "Incentive Focus" },
  { value: "COMPLIANCE_FIRST", label: "Compliance First" },
] as const;

export function mergeDecisionFormValues(
  value?: Partial<Record<keyof DecisionFormValues, number | string | null>>
) {
  return {
    ...DEFAULT_DECISION_FORM_VALUES,
    ...value,
  } as DecisionFormValues;
}

export function coerceDecisionFieldValue(
  field: keyof DecisionFormValues,
  rawValue: string
) {
  if (field === "taxStrategy") {
    return (rawValue.trim() || DEFAULT_DECISION_FORM_VALUES.taxStrategy) as DecisionFormValues[typeof field];
  }

  const parsed = Number(rawValue);

  return (Number.isFinite(parsed)
    ? parsed
    : DEFAULT_DECISION_FORM_VALUES[field]) as DecisionFormValues[typeof field];
}
