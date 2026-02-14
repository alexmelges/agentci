import Ajv from "ajv";
import type { AssertionResult, Assertion } from "./index.js";
import type { ProviderResponse } from "../providers/types.js";

export function assertJsonValid(
  response: ProviderResponse,
  _assertion: Assertion
): AssertionResult {
  try {
    JSON.parse(response.content);
    return { passed: true, message: "response is valid JSON" };
  } catch {
    return { passed: false, message: "expected response to be valid JSON" };
  }
}

export function assertJsonSchema(
  response: ProviderResponse,
  assertion: Assertion
): AssertionResult {
  const schema = assertion.schema as Record<string, unknown>;

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    return {
      passed: false,
      message: "expected response to be valid JSON for schema validation",
    };
  }

  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return { passed: true, message: "response matches JSON schema" };
  }

  const errors = validate.errors
    ?.map((e) => `${e.instancePath || "/"}: ${e.message}`)
    .join("; ");
  return {
    passed: false,
    message: `JSON schema validation failed: ${errors}`,
  };
}
