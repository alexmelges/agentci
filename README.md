# AgentCI

**Regression testing for AI agents — pytest for prompts.**

[![npm version](https://img.shields.io/npm/v/agentci.svg)](https://www.npmjs.com/package/agentci)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/alexmelges/agentci/actions/workflows/ci.yml/badge.svg)](https://github.com/alexmelges/agentci/actions/workflows/ci.yml)

AgentCI runs behavioral tests against your AI agents and prompts on every commit. Define expected behaviors in YAML, run them in CI, catch regressions before they ship.

## Quick Start

```bash
# Try it instantly — no API keys needed
npx agentci --demo

# Or test your own agent
npx agentci init       # generates agentci.yaml
npx agentci            # runs the tests
```

### Full Setup

```bash
# Install
npm install -D agentci

# Create a test file
cat > agentci.yaml << 'EOF'
version: 1
defaults:
  provider: openai
  model: gpt-4o-mini
  temperature: 0
  max_tokens: 500

tests:
  - name: "greeting response"
    prompt: "Hello, I need help with my order"
    assertions:
      - type: contains
        value: "help"
      - type: not_contains
        value: "I'm just an AI"
EOF

# Run tests (requires OPENAI_API_KEY env var)
npx agentci
```

Output:

```
AgentCI v0.1.0 — Running 1 tests

  ✅ greeting response (312ms)

Results: 1/1 passed (100%)
```

## YAML Schema Reference

```yaml
# agentci.yaml
version: 1

# Default settings applied to all tests
defaults:
  provider: openai          # "openai" or "anthropic"
  model: gpt-4o-mini        # model name
  temperature: 0            # 0-2, lower = more deterministic
  max_tokens: 500           # max response tokens
  base_url: null             # custom OpenAI-compatible endpoint

tests:
  - name: "test name"         # required — unique test identifier
    prompt: "user message"     # required — the prompt to send
    system: "system prompt"    # optional — system message
    context: "grounding text"  # optional — prepended as "Context: ..." to prompt

    # Per-test overrides (optional)
    provider: openai
    model: gpt-4o
    temperature: 0
    max_tokens: 1000
    base_url: https://my-proxy.example.com/v1

    # Tool definitions for function calling tests (optional)
    tools:
      - name: get_weather
        description: "Get weather for a city"
        parameters:
          type: object
          properties:
            city: { type: string }

    # Assertions — at least one required
    assertions:
      - type: contains
        value: "expected text"
```

## Assertion Types

AgentCI ships with 14 assertion types — 11 deterministic + 3 LLM-as-judge:

### Text Assertions

| Type | Fields | Description |
|------|--------|-------------|
| `contains` | `value` | Response contains string (case-insensitive) |
| `not_contains` | `value` | Response does NOT contain string |
| `regex` | `pattern` | Response matches regex pattern |
| `starts_with` | `value` | Response starts with string (case-insensitive, trims whitespace) |
| `ends_with` | `value` | Response ends with string (case-insensitive, trims whitespace) |

```yaml
assertions:
  - type: contains
    value: "30 days"
  - type: not_contains
    value: "I don't know"
  - type: regex
    pattern: "(refund|return|exchange)"
  - type: starts_with
    value: "Sure"
  - type: ends_with
    value: "help?"
```

### Token Assertions

| Type | Fields | Description |
|------|--------|-------------|
| `max_tokens` | `value` | Response is under N tokens (estimated via word count / 0.75) |
| `min_tokens` | `value` | Response is at least N tokens |

```yaml
assertions:
  - type: max_tokens
    value: 200
  - type: min_tokens
    value: 10
```

### Tool Call Assertions

| Type | Fields | Description |
|------|--------|-------------|
| `tool_called` | `name` | Agent called a specific tool |
| `tool_args` | `name`, `contains` | Tool was called with specific argument values |

```yaml
tools:
  - name: get_weather
    description: "Get weather for a city"
    parameters:
      type: object
      properties:
        city: { type: string }
assertions:
  - type: tool_called
    name: get_weather
  - type: tool_args
    name: get_weather
    contains: { city: "Paris" }
```

### JSON Assertions

| Type | Fields | Description |
|------|--------|-------------|
| `json_valid` | — | Response is valid JSON |
| `json_schema` | `schema` | Response matches a JSON Schema |

```yaml
assertions:
  - type: json_valid
  - type: json_schema
    schema:
      type: object
      required: ["name", "age"]
      properties:
        name: { type: string }
        age: { type: number }
```

### LLM-as-Judge Assertions ⚡ NEW

Use an LLM to evaluate responses when deterministic assertions aren't enough. Requires `OPENAI_API_KEY` (uses `gpt-4o-mini` by default).

| Type | Fields | Description |
|------|--------|-------------|
| `llm_judge` | `value` | Free-form criterion — LLM evaluates if response meets it |
| `semantic_similarity` | `value` | Response conveys same meaning as reference text |
| `sentiment` | `value` | Response matches expected tone (professional, friendly, etc.) |

```yaml
assertions:
  # Free-form evaluation
  - type: llm_judge
    value: "Response should be helpful, concise, and not hallucinate facts"

  # Semantic matching (ignores phrasing differences)
  - type: semantic_similarity
    value: "The capital of France is Paris"

  # Tone/sentiment check
  - type: sentiment
    value: "professional"
```

**Configuration:**
- **Provider auto-detection:** Uses OpenAI if `OPENAI_API_KEY` is set, falls back to Anthropic if `ANTHROPIC_API_KEY` is set
- Force a specific provider: `AGENTCI_JUDGE_PROVIDER=anthropic` (or `openai`)
- Custom judge model: `AGENTCI_JUDGE_MODEL=claude-sonnet-4-20250514` (defaults: `gpt-4o-mini` for OpenAI, `claude-sonnet-4-20250514` for Anthropic)
- Judge responses include reasoning for debuggability
- Each judge assertion makes one additional API call

**Example — testing a support bot's tone and accuracy:**

```yaml
tests:
  - name: "refund request — empathetic and accurate"
    system: "You are a customer support agent for an e-commerce store."
    prompt: "I want a refund for my order that arrived broken"
    assertions:
      # Deterministic checks
      - type: contains
        value: "refund"
      - type: not_contains
        value: "I'm just an AI"
      # LLM-as-judge checks
      - type: sentiment
        value: "empathetic and professional"
      - type: llm_judge
        value: "Response acknowledges the broken item, offers a clear refund process, and doesn't blame the customer"
```

## Provider Configuration

### OpenAI

Set the `OPENAI_API_KEY` environment variable:

```bash
export OPENAI_API_KEY=sk-...
```

```yaml
defaults:
  provider: openai
  model: gpt-4o-mini  # or gpt-4o, gpt-4-turbo, etc.
```

### Anthropic

Set the `ANTHROPIC_API_KEY` environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

```yaml
defaults:
  provider: anthropic
  model: claude-sonnet-4-5-20250929
```

### Custom OpenAI-Compatible Endpoint

Use `base_url` to point to any OpenAI-compatible API (Ollama, Azure, vLLM, LiteLLM, etc.):

```yaml
defaults:
  provider: openai
  model: my-model
  base_url: https://my-proxy.example.com/v1
```

## CLI Reference

```
Usage: agentci [options]

Options:
  -c, --config <path>    config file path (default: "agentci.yaml")
  -m, --model <model>    override model for all tests
  -f, --format <format>  output format: text, json, markdown (default: "text")
  --dry-run              validate config without calling LLM
  --verbose              show full responses
  -V, --version          output the version number
  -h, --help             display help for command
```

### Examples

```bash
# Run with default config (agentci.yaml)
npx agentci

# Use a specific config file
npx agentci --config tests/support-agent.yaml

# Override the model
npx agentci --model gpt-4o

# Validate YAML without making API calls
npx agentci --dry-run

# Show full LLM responses
npx agentci --verbose

# Output as JSON (for CI parsing)
npx agentci --format json

# Output as Markdown (for PR comments)
npx agentci --format markdown
```

## Output Formats

### Text (default)

```
AgentCI v0.1.0 — Running 4 tests

  ✅ greeting response (312ms)
  ✅ refund policy (428ms)
  ❌ tool call check (295ms)
     ✗ tool_called: expected get_weather to be called, but no tool calls made
  ✅ no hallucination (387ms)

Results: 3/4 passed (75%)
```

### JSON (`--format json`)

```json
{
  "version": "0.1.0",
  "total": 4,
  "passed": 3,
  "failed": 1,
  "duration": 1422,
  "tests": [
    {
      "name": "greeting response",
      "passed": true,
      "duration": 312,
      "assertions": [
        { "type": "contains", "passed": true, "message": "contains \"help\"" }
      ]
    }
  ]
}
```

### Markdown (`--format markdown`)

```markdown
# AgentCI Results

**3/4 passed (75%)** in 1422ms

| Test | Status | Duration |
|------|--------|----------|
| greeting response | ✅ | 312ms |
| refund policy | ✅ | 428ms |
| tool call check | ❌ | 295ms |
| no hallucination | ✅ | 387ms |

## Failures

### tool call check
- **tool_called**: expected get_weather to be called, but no tool calls made
```

## GitHub Actions

### Simple (npx)

```yaml
# .github/workflows/agentci.yml
name: AgentCI
on: [push, pull_request]

jobs:
  test-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx agentci
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### GitHub Action

```yaml
# .github/workflows/agentci.yml
name: AgentCI
on: [push, pull_request]

jobs:
  test-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: alexmelges/agentci@v0.1.0
        with:
          config: agentci.yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

#### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config` | Path to agentci.yaml config file | `agentci.yaml` |
| `model` | Override model for all tests | — |
| `format` | Output format: text, json, markdown | `text` |
| `verbose` | Show full LLM responses | `false` |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for your changes
4. Run the test suite (`npm test`)
5. Submit a pull request

### Development

```bash
git clone https://github.com/alexmelges/agentci.git
cd agentci
npm install
npm run build
npm test
```

## License

[MIT](LICENSE) — Copyright 2026 Alexandre Melges
