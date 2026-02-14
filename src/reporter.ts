import chalk from "chalk";
import type { RunResult, TestResult } from "./runner.js";

export type OutputFormat = "text" | "json" | "markdown";

export function reportText(
  result: RunResult,
  options?: { verbose?: boolean }
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold(`AgentCI v0.1.0`) + chalk.dim(` — Running ${result.total} tests`)
  );
  lines.push("");

  for (const test of result.results) {
    if (test.passed) {
      lines.push(
        chalk.green(`  ✅ ${test.name}`) + chalk.dim(` (${test.duration}ms)`)
      );
    } else {
      lines.push(
        chalk.red(`  ❌ ${test.name}`) + chalk.dim(` (${test.duration}ms)`)
      );

      if (test.error) {
        lines.push(chalk.red(`     ✗ Error: ${test.error}`));
      }

      for (const ar of test.assertions) {
        if (!ar.result.passed) {
          lines.push(
            chalk.red(`     ✗ ${ar.assertion.type}: ${ar.result.message}`)
          );
        }
      }
    }

    if (options?.verbose && test.response) {
      lines.push(chalk.dim(`     Response: ${test.response.content.slice(0, 200)}${test.response.content.length > 200 ? "..." : ""}`));
      if (test.response.tool_calls.length > 0) {
        lines.push(
          chalk.dim(
            `     Tool calls: ${JSON.stringify(test.response.tool_calls)}`
          )
        );
      }
    }
  }

  lines.push("");

  const pct = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
  const summary = `Results: ${result.passed}/${result.total} passed (${pct}%)`;

  if (result.failed === 0) {
    lines.push(chalk.green.bold(summary));
  } else {
    lines.push(chalk.red.bold(summary));
  }

  lines.push("");

  return lines.join("\n");
}

export function reportJson(result: RunResult): string {
  return JSON.stringify(
    {
      version: "0.1.0",
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      duration: result.duration,
      tests: result.results.map((t) => ({
        name: t.name,
        passed: t.passed,
        duration: t.duration,
        error: t.error,
        assertions: t.assertions.map((a) => ({
          type: a.assertion.type,
          passed: a.result.passed,
          message: a.result.message,
        })),
      })),
    },
    null,
    2
  );
}

export function reportMarkdown(result: RunResult): string {
  const lines: string[] = [];
  const pct = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;

  lines.push(`# AgentCI Results`);
  lines.push("");
  lines.push(
    `**${result.passed}/${result.total} passed (${pct}%)** in ${result.duration}ms`
  );
  lines.push("");
  lines.push("| Test | Status | Duration |");
  lines.push("|------|--------|----------|");

  for (const test of result.results) {
    const icon = test.passed ? "✅" : "❌";
    lines.push(`| ${test.name} | ${icon} | ${test.duration}ms |`);
  }

  const failures = result.results.filter((t) => !t.passed);
  if (failures.length > 0) {
    lines.push("");
    lines.push("## Failures");
    lines.push("");

    for (const test of failures) {
      lines.push(`### ${test.name}`);
      if (test.error) {
        lines.push(`- **Error**: ${test.error}`);
      }
      for (const ar of test.assertions) {
        if (!ar.result.passed) {
          lines.push(`- **${ar.assertion.type}**: ${ar.result.message}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function report(
  result: RunResult,
  format: OutputFormat,
  options?: { verbose?: boolean }
): string {
  switch (format) {
    case "json":
      return reportJson(result);
    case "markdown":
      return reportMarkdown(result);
    default:
      return reportText(result, options);
  }
}
