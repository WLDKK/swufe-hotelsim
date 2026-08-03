-- Performance indexes for Stage 7 read-heavy paths.
-- These indexes target the current hottest filters and sorts used by
-- dashboards, simulation monitoring, results history, and audit screens.

-- User and semester directory filters
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "semesters_creatorId_idx" ON "semesters"("creatorId");

-- Teaching structure and round lifecycle filters
CREATE INDEX "classes_semesterId_idx" ON "classes"("semesterId");
CREATE INDEX "classes_status_idx" ON "classes"("status");
CREATE INDEX "rounds_classId_status_idx" ON "rounds"("classId", "status");
CREATE INDEX "decisions_roundId_status_idx" ON "decisions"("roundId", "status");

-- Results history and leaderboard lookups
CREATE INDEX "round_results_teamId_roundNumber_createdAt_idx"
ON "round_results"("teamId", "roundNumber", "createdAt");
CREATE INDEX "round_results_teacherScore_idx" ON "round_results"("teacherScore");

-- Audit and observability queries
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
CREATE INDEX "audit_logs_entityType_createdAt_idx"
ON "audit_logs"("entityType", "createdAt");
