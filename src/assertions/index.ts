import type { ProviderResponse } from "../providers/types.js";
import {
  assertContains,
  assertNotContains,
  assertRegex,
  assertStartsWith,
  assertEndsWith,
} from "./text.js";
import { assertMaxTokens, assertMinTokens } from "./tokens.js";
import { assertToolCalled, assertToolArgs } from "./tools.js";
import { assertJsonValid, assertJsonSchema } from "./json.js";
import {
  assertLlmJudge,
  assertSemanticSimilarity,
  assertSentiment,
} from "./judge.js";

export interface Assertion {
  type: string;
  value?: string | number;
  pattern?: string;
  name?: string;
  contains?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

export interface AssertionResult {
  passed: boolean;
  message: string;
}

type SyncAssertionFn = (
  response: ProviderResponse,
  assertion: Assertion
) => AssertionResult;

type AsyncAssertionFn = (
  response: ProviderResponse,
  assertion: Assertion
) => Promise<AssertionResult>;

type AssertionFn = SyncAssertionFn | AsyncAssertionFn;

const registry: Record<string, AssertionFn> = {
  // Sync (deterministic)
  contains: assertContains,
  not_contains: assertNotContains,
  regex: assertRegex,
  starts_with: assertStartsWith,
  ends_with: assertEndsWith,
  max_tokens: assertMaxTokens,
  min_tokens: assertMinTokens,
  tool_called: assertToolCalled,
  tool_args: assertToolArgs,
  json_valid: assertJsonValid,
  json_schema: assertJsonSchema,
  // Async (LLM-as-judge)
  llm_judge: assertLlmJudge,
  semantic_similarity: assertSemanticSimilarity,
  sentiment: assertSentiment,
};

export async function runAssertion(
  response: ProviderResponse,
  assertion: Assertion
): Promise<AssertionResult> {
  const fn = registry[assertion.type];
  if (!fn) {
    return {
      passed: false,
      message: `unknown assertion type: "${assertion.type}"`,
    };
  }
  return fn(response, assertion);
}

export function getAssertionTypes(): string[] {
  return Object.keys(registry);
}
