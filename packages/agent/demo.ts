import { run_demo, type Scenario } from "./index.js";

const scenarios: Scenario[] = ["safe", "injection", "over-budget", "low-rating"];
for (const scenario of scenarios) {
  const result = run_demo(scenario);
  console.log(`\n=== ${scenario.toUpperCase()} ===`);
  console.log(`${result.decision}: ${result.productName} — $${result.amount}`);
  console.log(result.agentNotes);
}
