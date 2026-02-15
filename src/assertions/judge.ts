import type { ProviderResponse } from "../providers/types.js";
import type { Assertion, AssertionResult } from "./index.js";

/**
 * LLM-as-judge assertions for AgentCI v2.
 *
 * Three assertion types:
 * - llm_judge: Free-form criterion evaluated by an LLM
 * - semantic_similarity: Checks if response is semantically similar to a reference
 * - sentiment: Checks if response has expected sentiment/tone
 *
 * All use OpenAI by default (gpt-4o-mini for cost efficiency).
 * Judge model configurable via AGENTCI_JUDGE_MODEL env var.
 */

interface JudgeResponse {
  passed: boolean;
  reasoning: string;
}

const JUDGE_MODEL = process.env.AGENTCI_JUDGE_MODEL || "gpt-4o-mini";

async function callJudge(systemPrompt: string, userPrompt: string): Promise<JudgeResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { passed: false, reasoning: "OPENAI_API_KEY not set (required for LLM judge assertions)" };
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { passed: false, reasoning: `Judge API error: ${resp.status} ${text.slice(0, 200)}` };
  }

  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content) as { pass?: boolean; passed?: boolean; reasoning?: string; reason?: string };
    return {
      passed: !!(parsed.pass ?? parsed.passed),
      reasoning: (parsed.reasoning ?? parsed.reason ?? "No reasoning provided").slice(0, 500),
    };
  } catch {
    return { passed: false, reasoning: `Failed to parse judge response: ${content.slice(0, 200)}` };
  }
}

/**
 * llm_judge assertion — evaluates response against a free-form criterion.
 *
 * YAML usage:
 *   - type: llm_judge
 *     value: "Response should be helpful and not hallucinate facts"
 */
export async function assertLlmJudge(
  response: ProviderResponse,
  assertion: Assertion
): Promise<AssertionResult> {
  const criterion = assertion.value as string;
  if (!criterion) {
    return { passed: false, message: "llm_judge requires a 'value' field with the evaluation criterion" };
  }

  const systemPrompt = `You are a strict test evaluator. Given an AI agent's response and a criterion, determine if the response meets the criterion.

Respond with JSON: {"pass": true/false, "reasoning": "brief explanation"}

Be strict but fair. If the criterion is ambiguous, interpret it reasonably.`;

  const userPrompt = `## Criterion
${criterion}

## Agent Response
${response.content}`;

  const judge = await callJudge(systemPrompt, userPrompt);
  return {
    passed: judge.passed,
    message: judge.passed
      ? `llm_judge passed: ${judge.reasoning}`
      : `llm_judge failed: ${judge.reasoning}`,
  };
}

/**
 * semantic_similarity assertion — checks if response is semantically similar to a reference.
 *
 * YAML usage:
 *   - type: semantic_similarity
 *     value: "The capital of France is Paris"
 */
export async function assertSemanticSimilarity(
  response: ProviderResponse,
  assertion: Assertion
): Promise<AssertionResult> {
  const reference = assertion.value as string;
  if (!reference) {
    return { passed: false, message: "semantic_similarity requires a 'value' field with the reference text" };
  }

  const systemPrompt = `You are a semantic similarity evaluator. Compare two texts and determine if they convey the same core meaning, even if worded differently.

Respond with JSON: {"pass": true/false, "reasoning": "brief explanation"}

Pass if the core meaning/answer is equivalent. Fail if the meaning differs substantively. Ignore minor stylistic differences, extra detail, or different phrasing.`;

  const userPrompt = `## Reference (expected meaning)
${reference}

## Actual Response
${response.content}`;

  const judge = await callJudge(systemPrompt, userPrompt);
  return {
    passed: judge.passed,
    message: judge.passed
      ? `semantic_similarity passed: ${judge.reasoning}`
      : `semantic_similarity failed: ${judge.reasoning}`,
  };
}

/**
 * sentiment assertion — checks if response has expected sentiment/tone.
 *
 * YAML usage:
 *   - type: sentiment
 *     value: "professional"  # or "friendly", "neutral", "empathetic", etc.
 */
export async function assertSentiment(
  response: ProviderResponse,
  assertion: Assertion
): Promise<AssertionResult> {
  const expectedTone = assertion.value as string;
  if (!expectedTone) {
    return { passed: false, message: "sentiment requires a 'value' field with the expected tone" };
  }

  const systemPrompt = `You are a tone/sentiment evaluator. Determine if a text matches the expected tone or sentiment.

Respond with JSON: {"pass": true/false, "reasoning": "brief explanation"}

Common tones: professional, friendly, neutral, empathetic, formal, casual, helpful, apologetic, confident, cautious.
Be reasonable — the text doesn't need to be a perfect example, just broadly matching the expected tone.`;

  const userPrompt = `## Expected Tone
${expectedTone}

## Text to Evaluate
${response.content}`;

  const judge = await callJudge(systemPrompt, userPrompt);
  return {
    passed: judge.passed,
    message: judge.passed
      ? `sentiment passed: ${judge.reasoning}`
      : `sentiment failed: ${judge.reasoning}`,
  };
}
