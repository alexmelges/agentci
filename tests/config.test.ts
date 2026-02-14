import { describe, it, expect } from "vitest";
import { validateConfig, loadConfig } from "../src/config.js";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("validateConfig", () => {
  it("validates a minimal valid config", () => {
    const config = validateConfig({
      version: 1,
      defaults: {
        provider: "openai",
        model: "gpt-4o-mini",
      },
      tests: [
        {
          name: "test1",
          prompt: "hello",
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.version).toBe(1);
    expect(config.defaults.provider).toBe("openai");
    expect(config.defaults.model).toBe("gpt-4o-mini");
    expect(config.tests).toHaveLength(1);
    expect(config.tests[0].name).toBe("test1");
  });

  it("validates config with all defaults", () => {
    const config = validateConfig({
      version: 1,
      defaults: {
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 500,
      },
      tests: [
        {
          name: "test1",
          prompt: "hello",
          assertions: [{ type: "contains", value: "hi" }],
        },
      ],
    });

    expect(config.defaults.temperature).toBe(0);
    expect(config.defaults.max_tokens).toBe(500);
  });

  it("prepends context to prompt when context is provided", () => {
    const config = validateConfig({
      version: 1,
      defaults: { provider: "openai", model: "gpt-4o-mini" },
      tests: [
        {
          name: "context test",
          context: "Acme Corp was founded in 2010.",
          prompt: "When was it founded?",
          assertions: [{ type: "contains", value: "2010" }],
        },
      ],
    });

    expect(config.tests[0].prompt).toContain("Context: Acme Corp");
    expect(config.tests[0].prompt).toContain("When was it founded?");
  });

  it("rejects missing version", () => {
    expect(() =>
      validateConfig({
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [
          {
            name: "t",
            prompt: "p",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("Unsupported config version");
  });

  it("rejects wrong version", () => {
    expect(() =>
      validateConfig({
        version: 2,
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [
          {
            name: "t",
            prompt: "p",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("Unsupported config version");
  });

  it("rejects missing defaults", () => {
    expect(() =>
      validateConfig({
        version: 1,
        tests: [
          {
            name: "t",
            prompt: "p",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("defaults");
  });

  it("rejects invalid provider", () => {
    expect(() =>
      validateConfig({
        version: 1,
        defaults: { provider: "invalid", model: "m" },
        tests: [
          {
            name: "t",
            prompt: "p",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("Invalid provider");
  });

  it("rejects empty tests array", () => {
    expect(() =>
      validateConfig({
        version: 1,
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [],
      })
    ).toThrow("at least one test");
  });

  it("rejects test without name", () => {
    expect(() =>
      validateConfig({
        version: 1,
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [
          {
            prompt: "p",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("name");
  });

  it("rejects test without prompt", () => {
    expect(() =>
      validateConfig({
        version: 1,
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [
          {
            name: "t",
            assertions: [{ type: "contains", value: "v" }],
          },
        ],
      })
    ).toThrow("prompt");
  });

  it("rejects test without assertions", () => {
    expect(() =>
      validateConfig({
        version: 1,
        defaults: { provider: "openai", model: "gpt-4o-mini" },
        tests: [
          {
            name: "t",
            prompt: "p",
            assertions: [],
          },
        ],
      })
    ).toThrow("assertion");
  });

  it("validates anthropic provider", () => {
    const config = validateConfig({
      version: 1,
      defaults: { provider: "anthropic", model: "claude-sonnet-4-5-20250929" },
      tests: [
        {
          name: "t",
          prompt: "p",
          assertions: [{ type: "contains", value: "v" }],
        },
      ],
    });
    expect(config.defaults.provider).toBe("anthropic");
  });

  it("preserves tools in test", () => {
    const config = validateConfig({
      version: 1,
      defaults: { provider: "openai", model: "gpt-4o-mini" },
      tests: [
        {
          name: "tool test",
          prompt: "p",
          tools: [
            {
              name: "get_weather",
              description: "Get weather",
              parameters: { type: "object", properties: { city: { type: "string" } } },
            },
          ],
          assertions: [{ type: "tool_called", name: "get_weather" }],
        },
      ],
    });
    expect(config.tests[0].tools).toHaveLength(1);
    expect(config.tests[0].tools![0].name).toBe("get_weather");
  });
});

describe("loadConfig", () => {
  it("throws for missing file", () => {
    expect(() => loadConfig("/nonexistent/path.yaml")).toThrow("not found");
  });

  it("loads and parses a valid YAML file", () => {
    const tmpDir = mkdirSync(join(tmpdir(), "agentci-test-" + Date.now()), {
      recursive: true,
    });
    const tmpFile = join(tmpDir as string, "test.yaml");
    writeFileSync(
      tmpFile,
      `
version: 1
defaults:
  provider: openai
  model: gpt-4o-mini
tests:
  - name: "test1"
    prompt: "hello"
    assertions:
      - type: contains
        value: "hi"
`
    );

    const config = loadConfig(tmpFile);
    expect(config.tests).toHaveLength(1);
    expect(config.tests[0].name).toBe("test1");

    unlinkSync(tmpFile);
  });
});
