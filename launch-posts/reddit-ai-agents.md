# AgentCI — regression testing for AI agents, runs in CI

Built a lightweight CLI that lets you write behavioral tests for your AI agents in YAML and run them in GitHub Actions (or any CI).

**The pitch:** Your agent worked yesterday. You changed the system prompt. Does it still work? AgentCI catches regressions before your users do.

**How it works:**
```yaml
# agentci.yaml
name: Support Agent Tests
provider:
  model: gpt-4o
  systemPrompt: "You are a helpful support agent..."

tests:
  - name: answers refund policy
    input: "What's your refund policy?"
    assert:
      - type: contains
        value: "30 days"
      - type: llm-judge
        criteria: "Response is helpful and professional"

  - name: refuses off-topic
    input: "Write me a poem about cats"
    assert:
      - type: llm-judge
        criteria: "Agent redirects to support topics"
```

```bash
npx @alexmelges/agentci --demo    # see sample output
npx @alexmelges/agentci init      # generates starter config
npx @alexmelges/agentci           # run tests
```

**Features:**
- 14 assertion types (11 deterministic + 3 LLM-as-judge)
- OpenAI + Anthropic as both test targets and judge backends
- JSON/Markdown/text output formats
- GitHub Action included
- ~30KB, zero config needed for demo

**vs Promptfoo:** AgentCI is deliberately simpler. No datasets, no evals framework, no web UI. Just YAML tests → pass/fail in CI. If you want a full evaluation platform, use Promptfoo. If you want `pytest` for prompts, use AgentCI.

Open source (MIT): https://github.com/alexmelges/agentci
npm: https://www.npmjs.com/package/@alexmelges/agentci
