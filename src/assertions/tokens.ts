import type { AssertionResult, Assertion } from "./index.js";
import type { ProviderResponse } from "../providers/types.js";

function estimateTokens(text: string): number {
  // Approximate: word count / 0.75 as specified in spec
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  return Math.ceil(words / 0.75);
}

export function assertMaxTokens(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const maxTokens = assertion.value as number;
  const estimated = estimateTokens(response.content);
  const passed = estimated <= maxTokens;
  return {
    passed,
    message: passed
      ? `response ~${estimated} tokens <= ${maxTokens} max`
      : `expected response to be under ${maxTokens} tokens, but got ~${estimated}`,
  };
}

export function assertMinTokens(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const minTokens = assertion.value as number;
  const estimated = estimateTokens(response.content);
  const passed = estimated >= minTokens;
  return {
    passed,
    message: passed
      ? `response ~${estimated} tokens >= ${minTokens} min`
      : `expected response to be at least ${minTokens} tokens, but got ~${estimated}`,
  };
}
