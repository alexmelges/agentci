# AgentCI — Regression Testing for AI Agent Workflows

## What is this?

`agentci` is a CLI tool + GitHub Action that runs behavioral tests against AI agents/prompts on every PR. Think "pytest for prompts."

## Target User

Solo devs or small teams (2-5 eng) shipping AI features (support bots, RAG pipelines, coding assistants). They don't want a full observability platform — they want simple CI-native testing.

## Positioning

Simpler than Promptfoo. CI-native. 5-minute setup.

## MVP Scope (what to build NOW)

### 1. YAML Test Schema (`agentci.yaml`)

```yaml
# agentci.yaml
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
      - type: regex
        pattern: "(order|assist|help)"

  - name: "refund policy"
    system: "You are a customer support agent for Acme Corp."
    prompt: "What's your refund policy?"
    assertions:
      - type: contains
        value: "30 days"
      - type: max_tokens
        value: 200

  - name: "tool call check"
    prompt: "What's the weather in Paris?"
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

  - name: "no hallucination"
    system: "Only answer from the provided context."
    context: "Acme Corp was founded in 2010 by Jane Smith."
    prompt: "When was Acme Corp founded?"
    assertions:
      - type: contains
        value: "2010"
      - type: not_contains
        value: "2005"
```

### 2. CLI Runner (`agentci` command)

```bash
# Run all tests
npx agentci

# Run specific test file
npx agentci --config tests/support-agent.yaml

# Run with different model
npx agentci --model gpt-4o

# Output formats
npx agentci --format json
npx agentci --format markdown

# Dry run (validate YAML without calling LLM)
npx agentci --dry-run

# Verbose (show full responses)
npx agentci --verbose
```

### 3. Assertion Types (MVP)

| Type | Description |
|------|-------------|
| `contains` | Response contains string (case-insensitive) |
| `not_contains` | Response does NOT contain string |
| `regex` | Response matches regex pattern |
| `starts_with` | Response starts with string |
| `ends_with` | Response ends with string |
| `max_tokens` | Response is under N tokens (approx via word count / 0.75) |
| `min_tokens` | Response is at least N tokens |
| `tool_called` | Agent called a specific tool |
| `tool_args` | Tool was called with specific arguments |
| `json_valid` | Response is valid JSON |
| `json_schema` | Response matches JSON schema |

### 4. Provider Support (MVP)

- OpenAI (Chat Completions API)
- Anthropic (Messages API)
- Any OpenAI-compatible endpoint (via `base_url`)

### 5. Output

```
AgentCI v0.1.0 — Running 4 tests

  ✅ greeting response (312ms)
  ✅ refund policy (428ms)  
  ❌ tool call check (295ms)
     ✗ tool_called: expected get_weather to be called, but no tool calls made
  ✅ no hallucination (387ms)

Results: 3/4 passed (75%)
```

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Package:** npm (`npx agentci`)
- **Dependencies:** Minimal — just OpenAI SDK + Anthropic SDK + yaml parser
- **Build:** tsup or esbuild for single-file CLI bundle

## File Structure

```
agentci/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI entry point
│   ├── config.ts         # YAML parsing + validation
│   ├── runner.ts         # Test execution engine
│   ├── providers/
│   │   ├── openai.ts     # OpenAI provider
│   │   ├── anthropic.ts  # Anthropic provider
│   │   └── types.ts      # Provider interface
│   ├── assertions/
│   │   ├── index.ts      # Assertion registry
│   │   ├── text.ts       # contains, regex, starts_with, etc.
│   │   ├── tokens.ts     # max_tokens, min_tokens
│   │   ├── tools.ts      # tool_called, tool_args
│   │   └── json.ts       # json_valid, json_schema
│   └── reporter.ts       # Output formatting (text, json, markdown)
├── tests/
│   └── ...
└── README.md
```

## NOT in MVP

- LLM-as-judge assertions (v2)
- GitHub Action (v2 — just use `npx agentci` in workflow for now)
- Dashboard / history (v2)
- Parallel test execution (v2)
- Test retries for flaky tests (v2)
- Semantic similarity assertions (v2)
