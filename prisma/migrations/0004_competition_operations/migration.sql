CREATE TABLE "competition_judge_assignments" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competition_judge_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_judge_assignments_competitionId_judgeId_key"
ON "competition_judge_assignments"("competitionId", "judgeId");

CREATE INDEX "competition_judge_assignments_judgeId_createdAt_idx"
ON "competition_judge_assignments"("judgeId", "createdAt");

ALTER TABLE "competition_judge_assignments"
ADD CONSTRAINT "competition_judge_assignments_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_judge_assignments"
ADD CONSTRAINT "competition_judge_assignments_judgeId_fkey"
FOREIGN KEY ("judgeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_judge_assignments"
ADD CONSTRAINT "competition_judge_assignments_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
