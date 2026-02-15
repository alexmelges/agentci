import { Command } from "commander";
import { resolve } from "node:path";
import { writeFileSync, existsSync } from "node:fs";
import { loadConfig, validateConfig, type AgentCIConfig } from "./config.js";
import { runAllTests } from "./runner.js";
import { report, type OutputFormat } from "./reporter.js";
import { createDemoProvider } from "./providers/demo.js";

const STARTER_CONFIG = `# AgentCI configuration
# Docs: https://github.com/alexmelges/agentci
version: 1

defaults:
  provider: openai
  model: gpt-4o-mini
  temperature: 0

tests:
  - name: "greeting response"
    system: "You are a helpful customer support agent."
    prompt: "Hello, I need help"
    assertions:
      - type: contains
        value: "help"
      - type: not_contains
        value: "error"

  - name: "stays on topic"
    system: "You are a customer support agent. Only discuss our products."
    prompt: "Write me a poem about the ocean"
    assertions:
      - type: not_contains
        value: "ocean waves"
      - type: contains
        value: "help"
`;

const DEMO_CONFIG: AgentCIConfig = {
  version: 1,
  defaults: { provider: "demo", model: "demo-model", temperature: 0 },
  tests: [
    {
      name: "greeting is friendly",
      system: "You are a customer support agent.",
      prompt: "Hello, I need some help with my order",
      assertions: [
        { type: "contains" as const, value: "help" },
        { type: "not_contains" as const, value: "error" },
        { type: "regex" as const, pattern: "\\b(hello|hi|welcome)\\b", flags: "i" },
      ],
    },
    {
      name: "refund request is handled",
      prompt: "I want a refund for my last purchase",
      assertions: [
        { type: "contains" as const, value: "refund" },
        { type: "contains" as const, value: "order number" },
        { type: "max_tokens" as const, value: 500 },
      ],
    },
    {
      name: "pricing info is accurate",
      prompt: "What are your pricing plans?",
      assertions: [
        { type: "contains" as const, value: "$" },
        { type: "regex" as const, pattern: "\\d+/month", flags: "i" },
        { type: "contains" as const, value: "Basic" },
      ],
    },
    {
      name: "tech support asks good questions",
      prompt: "My account is not working and I keep getting errors",
      assertions: [
        { type: "contains" as const, value: "sorry" },
        { type: "regex" as const, pattern: "(error|issue|problem)", flags: "i" },
        { type: "not_contains" as const, value: "your fault" },
      ],
    },
    {
      name: "shipping info is provided",
      prompt: "How long does shipping take?",
      assertions: [
        { type: "regex" as const, pattern: "\\d+.*days", flags: "i" },
        { type: "contains" as const, value: "shipping" },
      ],
    },
  ],
};

const program = new Command();

program
  .name("agentci")
  .description("Regression testing for AI agent workflows")
  .version("0.2.0")
  .option("-c, --config <path>", "config file path", "agentci.yaml")
  .option("-m, --model <model>", "override model for all tests")
  .option(
    "-f, --format <format>",
    "output format: text, json, markdown",
    "text"
  )
  .option("--dry-run", "validate config without calling LLM")
  .option("--verbose", "show full responses")
  .option("--demo", "run demo tests against a built-in mock agent (no API key needed)")
  .action(async (options) => {
    if (options.demo) {
      await runDemoMode(options);
      return;
    }

    const configPath = resolve(options.config);

    try {
      const config = loadConfig(configPath);

      if (options.model) {
        config.defaults.model = options.model;
      }

      if (options.dryRun) {
        console.log(
          `Config valid: ${config.tests.length} test(s) found in ${configPath}`
        );

        for (const test of config.tests) {
          console.log(
            `  - ${test.name} (${test.assertions.length} assertion(s))`
          );
        }

        process.exit(0);
      }

      const result = await runAllTests(config, {
        verbose: options.verbose,
      });

      const output = report(result, options.format as OutputFormat, {
        verbose: options.verbose,
      });

      console.log(output);

      process.exit(result.failed > 0 ? 1 : 0);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

// Init command
program
  .command("init")
  .description("Generate a starter agentci.yaml config file")
  .option("-o, --output <path>", "output file path", "agentci.yaml")
  .action((options) => {
    const outPath = resolve(options.output);
    if (existsSync(outPath)) {
      console.error(`Error: ${outPath} already exists. Remove it first or use -o to specify a different path.`);
      process.exit(1);
    }
    writeFileSync(outPath, STARTER_CONFIG, "utf-8");
    console.log(`✅ Created ${options.output}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Edit ${options.output} with your agent's tests`);
    console.log(`  2. Run: npx agentci`);
    console.log(`\nOr try the demo: npx agentci --demo`);
  });

async function runDemoMode(options: { format?: string; verbose?: boolean }) {
  console.log("🧪 AgentCI Demo Mode");
  console.log("Running 5 test cases against a mock customer support agent...\n");

  // Patch runner to use demo provider
  const config = DEMO_CONFIG;
  const result = await runAllTests(config, {
    verbose: options.verbose,
    providerOverride: createDemoProvider(),
  });

  const output = report(result, (options.format ?? "text") as OutputFormat, {
    verbose: options.verbose,
  });

  console.log(output);

  console.log("\n---");
  console.log("This was a demo against a mock agent.");
  console.log("To test YOUR agent: agentci init && agentci");
}

program.parse();
