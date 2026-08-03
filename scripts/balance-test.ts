import { runBalanceTest } from "@/lib/simulation/balance-test";

const report = runBalanceTest();

console.log("Simulation balance test");
console.log(JSON.stringify(report.summary, null, 2));

if (report.warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of report.warnings) {
    console.log(`- [${warning.severity}] ${warning.code}: ${warning.message}`);
  }
} else {
  console.log("Warnings: none");
}

if (!report.passed) {
  process.exitCode = 1;
}
