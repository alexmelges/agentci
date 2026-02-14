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

type AssertionFn = (
  response: ProviderResponse,
  assertion: Assertion
) => AssertionResult;

const registry: Record<string, AssertionFn> = {
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
};

export function runAssertion(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
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
