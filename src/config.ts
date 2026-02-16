import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import type { Assertion } from "./assertions/index.js";
import type { ToolDefinition } from "./providers/types.js";

export interface TestCase {
  name: string;
  system?: string;
  context?: string;
  prompt: string;
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  base_url?: string;
  tools?: ToolDefinition[];
  assertions: Assertion[];
  // HTTP provider options
  headers?: Record<string, string>;
  request_template?: Record<string, unknown>;
  response_path?: string;
}

export interface Defaults {
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  base_url?: string;
  // HTTP provider options
  headers?: Record<string, string>;
  request_template?: Record<string, unknown>;
  response_path?: string;
}

export interface AgentCIConfig {
  version: number;
  defaults: Defaults;
  tests: TestCase[];
}

export function loadConfig(configPath: string): AgentCIConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);

  return validateConfig(parsed);
}

export function validateConfig(raw: unknown): AgentCIConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config must be a YAML object");
  }

  const config = raw as Record<string, unknown>;

  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}. Expected 1`);
  }

  if (!config.defaults || typeof config.defaults !== "object") {
    throw new Error("Config must have a 'defaults' section");
  }

  const defaults = config.defaults as Record<string, unknown>;
  if (!defaults.provider || typeof defaults.provider !== "string") {
    throw new Error("defaults.provider is required and must be a string");
  }
  if (!defaults.model || typeof defaults.model !== "string") {
    throw new Error("defaults.model is required and must be a string");
  }

  const validProviders = ["openai", "anthropic", "http"];
  if (!validProviders.includes(defaults.provider)) {
    throw new Error(
      `Invalid provider "${defaults.provider}". Must be one of: ${validProviders.join(", ")}`
    );
  }

  if (!Array.isArray(config.tests) || config.tests.length === 0) {
    throw new Error("Config must have at least one test");
  }

  const tests: TestCase[] = config.tests.map(
    (test: Record<string, unknown>, i: number) => {
      if (!test.name || typeof test.name !== "string") {
        throw new Error(`Test ${i + 1}: 'name' is required`);
      }
      if (!test.prompt || typeof test.prompt !== "string") {
        throw new Error(`Test "${test.name}": 'prompt' is required`);
      }
      if (!Array.isArray(test.assertions) || test.assertions.length === 0) {
        throw new Error(
          `Test "${test.name}": at least one assertion is required`
        );
      }

      const assertions: Assertion[] = test.assertions.map(
        (a: Record<string, unknown>, j: number) => {
          if (!a.type || typeof a.type !== "string") {
            throw new Error(
              `Test "${test.name}", assertion ${j + 1}: 'type' is required`
            );
          }
          return a as unknown as Assertion;
        }
      );

      let prompt = test.prompt as string;
      if (test.context) {
        prompt = `Context: ${test.context}\n\n${prompt}`;
      }

      return {
        name: test.name as string,
        system: test.system as string | undefined,
        context: test.context as string | undefined,
        prompt,
        provider: test.provider as string | undefined,
        model: test.model as string | undefined,
        temperature: test.temperature as number | undefined,
        max_tokens: test.max_tokens as number | undefined,
        base_url: test.base_url as string | undefined,
        tools: test.tools as ToolDefinition[] | undefined,
        assertions,
        headers: test.headers as Record<string, string> | undefined,
        request_template: test.request_template as Record<string, unknown> | undefined,
        response_path: test.response_path as string | undefined,
      };
    }
  );

  return {
    version: 1,
    defaults: {
      provider: defaults.provider as string,
      model: defaults.model as string,
      temperature: defaults.temperature as number | undefined,
      max_tokens: defaults.max_tokens as number | undefined,
      base_url: defaults.base_url as string | undefined,
      headers: defaults.headers as Record<string, string> | undefined,
      request_template: defaults.request_template as Record<string, unknown> | undefined,
      response_path: defaults.response_path as string | undefined,
    },
    tests,
  };
}
