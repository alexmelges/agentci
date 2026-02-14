import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { runAllTests } from "./runner.js";
import { report, type OutputFormat } from "./reporter.js";

const program = new Command();

program
  .name("agentci")
  .description("Regression testing for AI agent workflows")
  .version("0.1.0")
  .option("-c, --config <path>", "config file path", "agentci.yaml")
  .option("-m, --model <model>", "override model for all tests")
  .option(
    "-f, --format <format>",
    "output format: text, json, markdown",
    "text"
  )
  .option("--dry-run", "validate config without calling LLM")
  .option("--verbose", "show full responses")
  .action(async (options) => {
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

program.parse();
