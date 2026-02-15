/**
 * Demo provider: a mock LLM that produces deterministic responses for demo testing.
 * Simulates a customer support agent with known behaviors for assertion validation.
 */
import type { Provider, ProviderRequest, ProviderResponse } from "./types.js";

export function createDemoProvider(): Provider {
  return {
    name: "demo",
    async chat(request: ProviderRequest): Promise<ProviderResponse> {
      const prompt = request.prompt.toLowerCase();

      // Shipping (check before greeting — "shipping" contains "hi")
      if (prompt.includes("ship") || prompt.includes("deliver") || prompt.includes("tracking")) {
        return {
          content: "Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for $9.99. You can track your order at acme.com/track with your order number.",
          model: "demo-model",
          usage: { prompt_tokens: 20, completion_tokens: 40 },
        };
      }

      // Greeting / help request
      if (prompt.includes("hello") || prompt.includes(" hi ") || prompt.includes("help")) {
        return {
          content: "Hello! I'm a customer support agent for Acme Corp. I can help you with orders, returns, and general questions. How can I assist you today?",
          model: "demo-model",
          usage: { prompt_tokens: 20, completion_tokens: 35 },
        };
      }

      // Refund request
      if (prompt.includes("refund") || prompt.includes("return") || prompt.includes("money back")) {
        return {
          content: "I understand you'd like a refund. I can process that for you. Our refund policy allows returns within 30 days of purchase. Could you please provide your order number so I can look into this for you?",
          model: "demo-model",
          usage: { prompt_tokens: 25, completion_tokens: 45 },
        };
      }

      // Technical support
      if (prompt.includes("broken") || prompt.includes("error") || prompt.includes("not working") || prompt.includes("bug")) {
        return {
          content: "I'm sorry to hear you're experiencing issues. Let me help troubleshoot. Could you tell me:\n1. What product are you using?\n2. What error message are you seeing?\n3. When did this start happening?\n\nThis will help me diagnose the problem.",
          model: "demo-model",
          usage: { prompt_tokens: 30, completion_tokens: 50 },
        };
      }

      // Pricing
      if (prompt.includes("price") || prompt.includes("cost") || prompt.includes("plan")) {
        return {
          content: "Here are our current plans:\n- **Basic**: $9/month (1 user, 10GB storage)\n- **Pro**: $29/month (5 users, 100GB storage)\n- **Enterprise**: Contact sales for custom pricing\n\nAll plans include a 14-day free trial. Would you like to sign up?",
          model: "demo-model",
          usage: { prompt_tokens: 20, completion_tokens: 55 },
        };
      }

      // Tool call scenario
      if (request.tools && request.tools.length > 0 && (prompt.includes("weather") || prompt.includes("search") || prompt.includes("look up"))) {
        const toolName = request.tools[0].name;
        return {
          content: "",
          model: "demo-model",
          tool_calls: [{ name: toolName, arguments: { query: prompt } }],
          usage: { prompt_tokens: 30, completion_tokens: 20 },
        };
      }

      // Default
      return {
        content: "Thank you for reaching out to Acme Corp support. I'm here to help with any questions about our products and services. Could you provide more details about what you need assistance with?",
        model: "demo-model",
        usage: { prompt_tokens: 15, completion_tokens: 35 },
      };
    },
  };
}
