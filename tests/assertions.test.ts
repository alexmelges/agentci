import { describe, it, expect } from "vitest";
import { runAssertion, getAssertionTypes } from "../src/assertions/index.js";
import type { ProviderResponse } from "../src/providers/types.js";

function makeResponse(
  content: string,
  tool_calls: ProviderResponse["tool_calls"] = []
): ProviderResponse {
  return { content, tool_calls };
}

describe("assertion registry", () => {
  it("has all expected assertion types", () => {
    const types = getAssertionTypes();
    expect(types).toContain("contains");
    expect(types).toContain("not_contains");
    expect(types).toContain("regex");
    expect(types).toContain("starts_with");
    expect(types).toContain("ends_with");
    expect(types).toContain("max_tokens");
    expect(types).toContain("min_tokens");
    expect(types).toContain("tool_called");
    expect(types).toContain("tool_args");
    expect(types).toContain("json_valid");
    expect(types).toContain("json_schema");
  });

  it("returns failure for unknown assertion type", () => {
    const result = runAssertion(makeResponse("hello"), {
      type: "nonexistent",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("unknown assertion type");
  });
});

describe("contains", () => {
  it("passes when response contains value (case-insensitive)", () => {
    const result = runAssertion(makeResponse("I can help you with that!"), {
      type: "contains",
      value: "help",
    });
    expect(result.passed).toBe(true);
  });

  it("passes case-insensitively", () => {
    const result = runAssertion(makeResponse("HELLO WORLD"), {
      type: "contains",
      value: "hello",
    });
    expect(result.passed).toBe(true);
  });

  it("fails when value not found", () => {
    const result = runAssertion(makeResponse("goodbye"), {
      type: "contains",
      value: "hello",
    });
    expect(result.passed).toBe(false);
  });
});

describe("not_contains", () => {
  it("passes when response does not contain value", () => {
    const result = runAssertion(makeResponse("I can help you!"), {
      type: "not_contains",
      value: "sorry",
    });
    expect(result.passed).toBe(true);
  });

  it("fails when response contains value", () => {
    const result = runAssertion(
      makeResponse("I'm just an AI assistant"),
      { type: "not_contains", value: "just an AI" }
    );
    expect(result.passed).toBe(false);
  });
});

describe("regex", () => {
  it("passes when response matches pattern", () => {
    const result = runAssertion(
      makeResponse("I can help you with your order"),
      { type: "regex", pattern: "(order|assist|help)" }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when response does not match", () => {
    const result = runAssertion(makeResponse("goodbye"), {
      type: "regex",
      pattern: "^hello",
    });
    expect(result.passed).toBe(false);
  });
});

describe("starts_with", () => {
  it("passes when response starts with value", () => {
    const result = runAssertion(makeResponse("Hello, how can I help?"), {
      type: "starts_with",
      value: "Hello",
    });
    expect(result.passed).toBe(true);
  });

  it("handles leading whitespace", () => {
    const result = runAssertion(makeResponse("  Hello world"), {
      type: "starts_with",
      value: "Hello",
    });
    expect(result.passed).toBe(true);
  });

  it("fails when response doesn't start with value", () => {
    const result = runAssertion(makeResponse("Goodbye"), {
      type: "starts_with",
      value: "Hello",
    });
    expect(result.passed).toBe(false);
  });
});

describe("ends_with", () => {
  it("passes when response ends with value", () => {
    const result = runAssertion(makeResponse("Let me help you."), {
      type: "ends_with",
      value: "help you.",
    });
    expect(result.passed).toBe(true);
  });

  it("fails when response doesn't end with value", () => {
    const result = runAssertion(makeResponse("Hello world"), {
      type: "ends_with",
      value: "goodbye",
    });
    expect(result.passed).toBe(false);
  });
});

describe("max_tokens", () => {
  it("passes when response is under token limit", () => {
    const result = runAssertion(makeResponse("short"), {
      type: "max_tokens",
      value: 100,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when response exceeds token limit", () => {
    const longText = Array(200).fill("word").join(" ");
    const result = runAssertion(makeResponse(longText), {
      type: "max_tokens",
      value: 10,
    });
    expect(result.passed).toBe(false);
  });
});

describe("min_tokens", () => {
  it("passes when response meets minimum", () => {
    const text = Array(50).fill("word").join(" ");
    const result = runAssertion(makeResponse(text), {
      type: "min_tokens",
      value: 10,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when response is too short", () => {
    const result = runAssertion(makeResponse("hi"), {
      type: "min_tokens",
      value: 100,
    });
    expect(result.passed).toBe(false);
  });
});

describe("tool_called", () => {
  it("passes when tool was called", () => {
    const result = runAssertion(
      makeResponse("", [
        { name: "get_weather", arguments: { city: "Paris" } },
      ]),
      { type: "tool_called", name: "get_weather" }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when tool was not called", () => {
    const result = runAssertion(makeResponse("The weather is nice"), {
      type: "tool_called",
      name: "get_weather",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("no tool calls made");
  });

  it("fails when different tool was called", () => {
    const result = runAssertion(
      makeResponse("", [
        { name: "search", arguments: {} },
      ]),
      { type: "tool_called", name: "get_weather" }
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("search");
  });
});

describe("tool_args", () => {
  it("passes when tool args match", () => {
    const result = runAssertion(
      makeResponse("", [
        { name: "get_weather", arguments: { city: "Paris", units: "celsius" } },
      ]),
      { type: "tool_args", name: "get_weather", contains: { city: "Paris" } }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when tool args don't match", () => {
    const result = runAssertion(
      makeResponse("", [
        { name: "get_weather", arguments: { city: "London" } },
      ]),
      { type: "tool_args", name: "get_weather", contains: { city: "Paris" } }
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("mismatch");
  });

  it("fails when tool not called", () => {
    const result = runAssertion(makeResponse("hello"), {
      type: "tool_args",
      name: "get_weather",
      contains: { city: "Paris" },
    });
    expect(result.passed).toBe(false);
  });
});

describe("json_valid", () => {
  it("passes for valid JSON", () => {
    const result = runAssertion(
      makeResponse('{"name": "test", "value": 42}'),
      { type: "json_valid" }
    );
    expect(result.passed).toBe(true);
  });

  it("fails for invalid JSON", () => {
    const result = runAssertion(makeResponse("not json at all"), {
      type: "json_valid",
    });
    expect(result.passed).toBe(false);
  });
});

describe("json_schema", () => {
  it("passes when response matches schema", () => {
    const result = runAssertion(
      makeResponse('{"name": "test", "age": 25}'),
      {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name", "age"],
        },
      }
    );
    expect(result.passed).toBe(true);
  });

  it("fails when response doesn't match schema", () => {
    const result = runAssertion(makeResponse('{"name": 123}'), {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("schema validation failed");
  });

  it("fails for invalid JSON", () => {
    const result = runAssertion(makeResponse("not json"), {
      type: "json_schema",
      schema: { type: "object" },
    });
    expect(result.passed).toBe(false);
  });
});
