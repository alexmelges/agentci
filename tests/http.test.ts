import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHttpProvider, getByPath } from "../src/providers/http.js";
import { validateConfig } from "../src/config.js";
import type { ProviderRequest } from "../src/providers/types.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(responseBody: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Bad Request",
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const baseRequest: ProviderRequest = {
  model: "my-agent",
  prompt: "What is 2+2?",
  system: "You are helpful.",
  temperature: 0,
  max_tokens: 500,
};

// --- getByPath ---

describe("getByPath", () => {
  it("resolves a top-level key", () => {
    expect(getByPath({ content: "hello" }, "content")).toBe("hello");
  });

  it("resolves a nested path", () => {
    expect(getByPath({ data: { reply: { text: "hi" } } }, "data.reply.text")).toBe("hi");
  });

  it("returns undefined for missing path", () => {
    expect(getByPath({ a: 1 }, "b.c")).toBeUndefined();
  });

  it("returns undefined for null input", () => {
    expect(getByPath(null, "a")).toBeUndefined();
  });
});

// --- createHttpProvider: request construction ---

describe("createHttpProvider — request construction", () => {
  it("sends default body with correct fields", async () => {
    const fetchMock = mockFetch({ content: "4" });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    await provider.chat(baseRequest);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/chat");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.prompt).toBe("What is 2+2?");
    expect(body.model).toBe("my-agent");
    expect(body.system).toBe("You are helpful.");
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(500);
  });

  it("omits undefined optional fields in default body", async () => {
    const fetchMock = mockFetch({ content: "hi" });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    await provider.chat({ model: "m", prompt: "hello" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("system");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("tools");
  });

  it("sends custom headers", async () => {
    const fetchMock = mockFetch({ content: "ok" });
    const provider = createHttpProvider({
      baseURL: "http://localhost:8000/chat",
      headers: { Authorization: "Bearer my-token", "X-Custom": "value" },
    });

    await provider.chat(baseRequest);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer my-token");
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("applies request_template with interpolation", async () => {
    const fetchMock = mockFetch({ content: "ok" });
    const provider = createHttpProvider({
      baseURL: "http://localhost:8000/chat",
      requestTemplate: {
        messages: [{ role: "user", content: "{{prompt}}" }],
        settings: { temp: "{{temperature}}" },
      },
    });

    await provider.chat(baseRequest);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe("What is 2+2?");
    // Single placeholder preserves original type
    expect(body.settings.temp).toBe(0);
  });

  it("preserves non-string values in request_template", async () => {
    const fetchMock = mockFetch({ content: "ok" });
    const provider = createHttpProvider({
      baseURL: "http://localhost:8000/chat",
      requestTemplate: {
        text: "{{prompt}}",
        stream: false,
        n: 1,
      },
    });

    await provider.chat(baseRequest);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
    expect(body.n).toBe(1);
  });
});

// --- createHttpProvider: response parsing ---

describe("createHttpProvider — response parsing", () => {
  it("extracts content from default path", async () => {
    mockFetch({ content: "The answer is 4" });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    const response = await provider.chat(baseRequest);
    expect(response.content).toBe("The answer is 4");
  });

  it("extracts content from custom response_path", async () => {
    mockFetch({ data: { reply: { text: "four" } } });
    const provider = createHttpProvider({
      baseURL: "http://localhost:8000/chat",
      responsePath: "data.reply.text",
    });

    const response = await provider.chat(baseRequest);
    expect(response.content).toBe("four");
  });

  it("returns empty string when response_path not found", async () => {
    mockFetch({ other: "stuff" });
    const provider = createHttpProvider({
      baseURL: "http://localhost:8000/chat",
      responsePath: "data.missing",
    });

    const response = await provider.chat(baseRequest);
    expect(response.content).toBe("");
  });

  it("extracts tool_calls if present", async () => {
    mockFetch({
      content: "",
      tool_calls: [{ name: "search", arguments: { q: "test" } }],
    });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    const response = await provider.chat(baseRequest);
    expect(response.tool_calls).toHaveLength(1);
    expect(response.tool_calls[0].name).toBe("search");
  });

  it("returns empty tool_calls when not present", async () => {
    mockFetch({ content: "hi" });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    const response = await provider.chat(baseRequest);
    expect(response.tool_calls).toEqual([]);
  });

  it("extracts model and usage if present", async () => {
    mockFetch({
      content: "hi",
      model: "custom-v1",
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    const response = await provider.chat(baseRequest);
    expect(response.model).toBe("custom-v1");
    expect(response.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
  });
});

// --- Error handling ---

describe("createHttpProvider — error handling", () => {
  it("throws on non-OK response", async () => {
    mockFetch({ error: "bad request" }, 400);
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    await expect(provider.chat(baseRequest)).rejects.toThrow("HTTP provider error: 400");
  });

  it("includes response body in error message", async () => {
    mockFetch({ error: "unauthorized" }, 401);
    const provider = createHttpProvider({ baseURL: "http://localhost:8000/chat" });

    await expect(provider.chat(baseRequest)).rejects.toThrow("unauthorized");
  });
});

// --- Config validation ---

describe("config validation — http provider", () => {
  it("accepts http as a valid provider", () => {
    const config = validateConfig({
      version: 1,
      defaults: {
        provider: "http",
        model: "my-agent",
        base_url: "http://localhost:8000/api/chat",
      },
      tests: [
        {
          name: "basic test",
          prompt: "hello",
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.defaults.provider).toBe("http");
    expect(config.defaults.base_url).toBe("http://localhost:8000/api/chat");
  });

  it("preserves headers in defaults", () => {
    const config = validateConfig({
      version: 1,
      defaults: {
        provider: "http",
        model: "my-agent",
        base_url: "http://localhost:8000/api/chat",
        headers: { Authorization: "Bearer token123" },
      },
      tests: [
        {
          name: "test",
          prompt: "hello",
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.defaults.headers).toEqual({ Authorization: "Bearer token123" });
  });

  it("preserves response_path in defaults", () => {
    const config = validateConfig({
      version: 1,
      defaults: {
        provider: "http",
        model: "my-agent",
        base_url: "http://localhost:8000/chat",
        response_path: "data.reply.text",
      },
      tests: [
        {
          name: "test",
          prompt: "hello",
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.defaults.response_path).toBe("data.reply.text");
  });

  it("preserves HTTP options in test cases", () => {
    const config = validateConfig({
      version: 1,
      defaults: { provider: "http", model: "my-agent", base_url: "http://localhost:8000/chat" },
      tests: [
        {
          name: "custom test",
          prompt: "hello",
          headers: { "X-Test": "true" },
          response_path: "output.text",
          request_template: { input: "{{prompt}}" },
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.tests[0].headers).toEqual({ "X-Test": "true" });
    expect(config.tests[0].response_path).toBe("output.text");
    expect(config.tests[0].request_template).toEqual({ input: "{{prompt}}" });
  });
});
