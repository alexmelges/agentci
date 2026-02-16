/**
 * HTTP provider: a thin adapter for testing any HTTP endpoint.
 * Sends POST requests to a configurable URL, with configurable request body
 * and response parsing.
 */
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
} from "./types.js";

export interface HttpProviderOptions {
  /** Target URL for POST requests */
  baseURL: string;
  /** Custom headers (e.g. Authorization) */
  headers?: Record<string, string>;
  /** Custom request body template — a JSON object where string values can contain {{field}} placeholders */
  requestTemplate?: Record<string, unknown>;
  /** Dot-notation path to extract content from response JSON (default: "content") */
  responsePath?: string;
}

/**
 * Resolve a dot-notation path on an object.
 * e.g. getByPath({ a: { b: "hello" } }, "a.b") => "hello"
 */
export function getByPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Interpolate {{field}} placeholders in a string using the given values.
 */
function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = values[key];
    return val === undefined ? "" : String(val);
  });
}

/**
 * Recursively apply {{field}} interpolation to all string values in an object/array.
 * Non-string leaves are returned as-is.
 */
function interpolateTemplate(
  template: unknown,
  values: Record<string, unknown>
): unknown {
  if (typeof template === "string") {
    // If the entire string is a single placeholder like "{{prompt}}", preserve the original type
    const singleMatch = template.match(/^\{\{(\w+)\}\}$/);
    if (singleMatch) {
      const val = values[singleMatch[1]];
      return val === undefined ? "" : val;
    }
    return interpolate(template, values);
  }
  if (Array.isArray(template)) {
    return template.map((item) => interpolateTemplate(item, values));
  }
  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      result[k] = interpolateTemplate(v, values);
    }
    return result;
  }
  return template;
}

/**
 * Build the default request body from a ProviderRequest.
 */
function buildDefaultBody(request: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    model: request.model,
  };
  if (request.system !== undefined) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
  if (request.tools && request.tools.length > 0) body.tools = request.tools;
  return body;
}

export function createHttpProvider(options: HttpProviderOptions): Provider {
  const { baseURL, headers, requestTemplate, responsePath = "content" } = options;

  return {
    name: "http",
    async chat(request: ProviderRequest): Promise<ProviderResponse> {
      // Build request body
      let body: unknown;
      if (requestTemplate) {
        const values: Record<string, unknown> = {
          prompt: request.prompt,
          system: request.system,
          model: request.model,
          temperature: request.temperature,
          max_tokens: request.max_tokens,
          tools: request.tools,
        };
        body = interpolateTemplate(requestTemplate, values);
      } else {
        body = buildDefaultBody(request);
      }

      const response = await fetch(baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `HTTP provider error: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
        );
      }

      const json = await response.json();

      // Extract content using response_path
      const rawContent = getByPath(json, responsePath);
      const content = rawContent === undefined ? "" : String(rawContent);

      // Extract tool_calls if present at top level
      const toolCalls = Array.isArray(json.tool_calls) ? json.tool_calls : [];

      return {
        content,
        tool_calls: toolCalls,
        model: typeof json.model === "string" ? json.model : undefined,
        usage: json.usage ?? undefined,
      };
    },
  };
}
