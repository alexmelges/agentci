import type { AssertionResult, Assertion } from "./index.js";
import type { ProviderResponse } from "../providers/types.js";

export function assertContains(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const value = assertion.value as string;
  const passed = response.content.toLowerCase().includes(value.toLowerCase());
  return {
    passed,
    message: passed
      ? `contains "${value}"`
      : `expected response to contain "${value}"`,
  };
}

export function assertNotContains(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const value = assertion.value as string;
  const passed = !response.content.toLowerCase().includes(value.toLowerCase());
  return {
    passed,
    message: passed
      ? `does not contain "${value}"`
      : `expected response to NOT contain "${value}"`,
  };
}

export function assertRegex(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const pattern = assertion.pattern as string;
  const re = new RegExp(pattern, "i");
  const passed = re.test(response.content);
  return {
    passed,
    message: passed
      ? `matches pattern /${pattern}/`
      : `expected response to match /${pattern}/`,
  };
}

export function assertStartsWith(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const value = assertion.value as string;
  const passed = response.content
    .trimStart()
    .toLowerCase()
    .startsWith(value.toLowerCase());
  return {
    passed,
    message: passed
      ? `starts with "${value}"`
      : `expected response to start with "${value}"`,
  };
}

export function assertEndsWith(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const value = assertion.value as string;
  const passed = response.content
    .trimEnd()
    .toLowerCase()
    .endsWith(value.toLowerCase());
  return {
    passed,
    message: passed
      ? `ends with "${value}"`
      : `expected response to end with "${value}"`,
  };
}
