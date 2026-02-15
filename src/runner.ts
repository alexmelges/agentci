import type { AgentCIConfig, TestCase } from "./config.js";
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
} from "./providers/types.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createAnthropicProvider } from "./providers/anthropic.js";
import { runAssertion, type Assertion, type AssertionResult } from "./assertions/index.js";

export interface TestAssertionResult {
  assertion: Assertion;
  result: AssertionResult;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  assertions: TestAssertionResult[];
  response?: ProviderResponse;
  error?: string;
}

export interface RunResult {
  results: TestResult[];
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

function getProvider(
  providerName: string,
  baseUrl?: string,
  apiKey?: string
): Provider {
  switch (providerName) {
    case "openai":
      return createOpenAIProvider({
        apiKey,
        baseURL: baseUrl,
      });
    case "anthropic":
      return createAnthropicProvider({ apiKey });
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

export async function runTest(
  test: TestCase,
  config: AgentCIConfig,
  options?: { verbose?: boolean; providerOverride?: Provider }
): Promise<TestResult> {
  const start = Date.now();

  const providerName = test.provider || config.defaults.provider;
  const model = test.model || config.defaults.model;
  const baseUrl = test.base_url || config.defaults.base_url;

  try {
    const provider = options?.providerOverride ?? getProvider(providerName, baseUrl);

    const request: ProviderRequest = {
      model,
      system: test.system,
      prompt: test.prompt,
      temperature: test.temperature ?? config.defaults.temperature ?? 0,
      max_tokens: test.max_tokens ?? config.defaults.max_tokens ?? 500,
      tools: test.tools,
    };

    const response = await provider.chat(request);
    const duration = Date.now() - start;

    const assertionResults: TestAssertionResult[] = [];
    for (const assertion of test.assertions) {
      const result = await runAssertion(response, assertion);
      assertionResults.push({ assertion, result });
    }

    const allPassed = assertionResults.every((ar) => ar.result.passed);

    return {
      name: test.name,
      passed: allPassed,
      duration,
      assertions: assertionResults,
      response: options?.verbose ? response : undefined,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      name: test.name,
      passed: false,
      duration,
      assertions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runAllTests(
  config: AgentCIConfig,
  options?: { verbose?: boolean; providerOverride?: Provider }
): Promise<RunResult> {
  const start = Date.now();
  const results: TestResult[] = [];

  for (const test of config.tests) {
    const result = await runTest(test, config, options);
    results.push(result);
  }

  const duration = Date.now() - start;
  const passed = results.filter((r) => r.passed).length;

  return {
    results,
    total: results.length,
    passed,
    failed: results.length - passed,
    duration,
  };
}
