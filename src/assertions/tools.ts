import type { AssertionResult, Assertion } from "./index.js";
import type { ProviderResponse } from "../providers/types.js";

export function assertToolCalled(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const toolName = assertion.name as string;
  const called = response.tool_calls.some((tc) => tc.name === toolName);
  const passed = called;
  return {
    passed,
    message: passed
      ? `tool "${toolName}" was called`
      : `expected ${toolName} to be called, but ${
          response.tool_calls.length === 0
            ? "no tool calls made"
            : `only [${response.tool_calls.map((tc) => tc.name).join(", ")}] called`
        }`,
  };
}

export function assertToolArgs(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const toolName = assertion.name as string;
  const expectedArgs = assertion.contains as Record<string, unknown>;

  const toolCall = response.tool_calls.find((tc) => tc.name === toolName);
  if (!toolCall) {
    return {
      passed: false,
      message: `expected ${toolName} to be called with specific args, but it was not called`,
    };
  }

  const mismatches: string[] = [];
  for (const [key, value] of Object.entries(expectedArgs)) {
    const actual = toolCall.arguments[key];
    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      mismatches.push(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`);
    }
  }

  const passed = mismatches.length === 0;
  return {
    passed,
    message: passed
      ? `tool "${toolName}" called with expected args`
      : `tool "${toolName}" args mismatch: ${mismatches.join("; ")}`,
  };
}
