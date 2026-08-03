type DecisionStatusValue = string;

type ProcessReadinessInput = {
  currentRoundStatus: string | null | undefined;
  teamCount: number;
  decisionStatuses: DecisionStatusValue[];
};

type ProcessReadinessResult = {
  submittedCount: number;
  missingDecisionCount: number;
  nonSubmittedCount: number;
  canProcess: boolean;
};

// Keep the teacher UI aligned with the server-side `/api/simulation/run`
// contract in one place. The API is still the final authority, but this helper
// prevents the dashboard/detail buttons from advertising a process action
// before every team has a SUBMITTED decision for the current pending round.
export function getProcessReadiness({
  currentRoundStatus,
  teamCount,
  decisionStatuses,
}: ProcessReadinessInput): ProcessReadinessResult {
  const submittedCount = decisionStatuses.filter(
    (status) => status === "SUBMITTED"
  ).length;
  const missingDecisionCount = Math.max(teamCount - decisionStatuses.length, 0);
  const nonSubmittedCount = decisionStatuses.filter(
    (status) => status !== "SUBMITTED"
  ).length;

  return {
    submittedCount,
    missingDecisionCount,
    nonSubmittedCount,
    canProcess:
      currentRoundStatus === "PENDING" &&
      teamCount > 0 &&
      missingDecisionCount === 0 &&
      nonSubmittedCount === 0,
  };
}
