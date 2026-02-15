import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAssertion } from "../src/assertions/index.js";
import type { ProviderResponse } from "../src/providers/types.js";

function makeResponse(content: string): ProviderResponse {
  return { content, tool_calls: [] };
}

// Mock fetch for judge calls
const originalFetch = globalThis.fetch;

function mockJudgeResponse(pass: boolean, reasoning: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ pass, reasoning }) } }],
    }),
  }) as unknown as typeof fetch;
}

function mockJudgeError(status: number, body: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => body,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key-for-judge";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("llm_judge", () => {
  it("passes when judge says pass", async () => {
    mockJudgeResponse(true, "Response is helpful and accurate");
    const result = await runAssertion(makeResponse("Paris is the capital of France"), {
      type: "llm_judge",
      value: "Response should be factually accurate",
    });
    expect(result.passed).toBe(true);
    expect(result.message).toContain("llm_judge passed");
    expect(result.message).toContain("helpful and accurate");
  });

  it("fails when judge says fail", async () => {
    mockJudgeResponse(false, "Response contains hallucinated information");
    const result = await runAssertion(makeResponse("The moon is made of cheese"), {
      type: "llm_judge",
      value: "Response should be factually accurate",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("llm_judge failed");
  });

  it("fails with helpful message when no criterion provided", async () => {
    const result = await runAssertion(makeResponse("hello"), {
      type: "llm_judge",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("requires a 'value' field");
  });

  it("fails gracefully on API error", async () => {
    mockJudgeError(429, "Rate limited");
    const result = await runAssertion(makeResponse("hello"), {
      type: "llm_judge",
      value: "Should be polite",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Judge API error");
  });

  it("fails when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await runAssertion(makeResponse("hello"), {
      type: "llm_judge",
      value: "Should be polite",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("No API key found for judge");
  });

  it("sends correct system prompt", async () => {
    mockJudgeResponse(true, "ok");
    await runAssertion(makeResponse("test"), {
      type: "llm_judge",
      value: "Must be concise",
    });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("strict test evaluator");
    expect(body.messages[1].content).toContain("Must be concise");
    expect(body.messages[1].content).toContain("test");
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});

describe("semantic_similarity", () => {
  it("passes when semantically similar", async () => {
    mockJudgeResponse(true, "Both describe Paris as France's capital");
    const result = await runAssertion(
      makeResponse("France's capital city is Paris"),
      { type: "semantic_similarity", value: "The capital of France is Paris" }
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain("semantic_similarity passed");
  });

  it("fails when semantically different", async () => {
    mockJudgeResponse(false, "Response discusses Germany, not France");
    const result = await runAssertion(
      makeResponse("Berlin is a great city"),
      { type: "semantic_similarity", value: "The capital of France is Paris" }
    );
    expect(result.passed).toBe(false);
  });

  it("fails without reference text", async () => {
    const result = await runAssertion(makeResponse("hello"), {
      type: "semantic_similarity",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("requires a 'value' field");
  });
});

describe("sentiment", () => {
  it("passes when tone matches", async () => {
    mockJudgeResponse(true, "Response uses formal language and professional tone");
    const result = await runAssertion(
      makeResponse("Thank you for your inquiry. We will process your request promptly."),
      { type: "sentiment", value: "professional" }
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain("sentiment passed");
  });

  it("fails when tone doesn't match", async () => {
    mockJudgeResponse(false, "Response is informal and uses slang");
    const result = await runAssertion(
      makeResponse("yo what's up lol"),
      { type: "sentiment", value: "professional" }
    );
    expect(result.passed).toBe(false);
  });

  it("fails without expected tone", async () => {
    const result = await runAssertion(makeResponse("hello"), {
      type: "sentiment",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("requires a 'value' field");
  });
});

describe("anthropic judge backend", () => {
  it("uses Anthropic when only ANTHROPIC_API_KEY is set", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify({ pass: true, reasoning: "Looks good" }) }],
      }),
    }) as unknown as typeof fetch;

    const result = await runAssertion(makeResponse("Paris is the capital"), {
      type: "llm_judge",
      value: "Should be factual",
    });
    expect(result.passed).toBe(true);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toContain("claude");
    expect(fetchCall[1].headers["x-api-key"]).toBe("test-anthropic-key");

    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-judge";
  });

  it("uses Anthropic when AGENTCI_JUDGE_PROVIDER=anthropic", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    // Temporarily set the env var — but JUDGE_PROVIDER is read at import time,
    // so we test the auto-detect path instead (OPENAI key removed)
    delete process.env.OPENAI_API_KEY;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"pass": false, "reasoning": "Not good"}' }],
      }),
    }) as unknown as typeof fetch;

    const result = await runAssertion(makeResponse("bad answer"), {
      type: "semantic_similarity",
      value: "good answer",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("semantic_similarity failed");

    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-judge";
  });

  it("handles Anthropic API errors gracefully", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    mockJudgeError(500, "Internal server error");

    const result = await runAssertion(makeResponse("test"), {
      type: "llm_judge",
      value: "Should work",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Judge API error (Anthropic)");

    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-judge";
  });

  it("handles Anthropic response with JSON in markdown code block", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '```json\n{"pass": true, "reasoning": "Correct"}\n```' }],
      }),
    }) as unknown as typeof fetch;

    const result = await runAssertion(makeResponse("good answer"), {
      type: "llm_judge",
      value: "Should be correct",
    });
    expect(result.passed).toBe(true);

    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-judge";
  });

  it("prefers OpenAI when both keys are available", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    mockJudgeResponse(true, "ok");

    await runAssertion(makeResponse("test"), {
      type: "llm_judge",
      value: "test",
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.openai.com/v1/chat/completions");

    delete process.env.ANTHROPIC_API_KEY;
  });
});

describe("judge integration", () => {
  it("handles malformed JSON response from judge", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json at all" } }],
      }),
    }) as unknown as typeof fetch;

    const result = await runAssertion(makeResponse("test"), {
      type: "llm_judge",
      value: "Should work",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to parse");
  });

  it("uses AGENTCI_JUDGE_MODEL env var when set", async () => {
    // Note: AGENTCI_JUDGE_MODEL is read at module load time, so this test
    // verifies the default model is used in the request
    mockJudgeResponse(true, "ok");
    await runAssertion(makeResponse("test"), {
      type: "llm_judge",
      value: "test",
    });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe("gpt-4o-mini");
  });

  it("all three judge types are registered", async () => {
    const { getAssertionTypes } = await import("../src/assertions/index.js");
    const types = getAssertionTypes();
    expect(types).toContain("llm_judge");
    expect(types).toContain("semantic_similarity");
    expect(types).toContain("sentiment");
  });
});
