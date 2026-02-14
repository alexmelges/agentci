import Anthropic from "@anthropic-ai/sdk";
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ToolCall,
} from "./types.js";

export function createAnthropicProvider(options?: {
  apiKey?: string;
}): Provider {
  const client = new Anthropic({
    apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
  });

  return {
    name: "anthropic",
    async chat(request: ProviderRequest): Promise<ProviderResponse> {
      const tools: Anthropic.Messages.Tool[] | undefined =
        request.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
        }));

      const message = await client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens ?? 500,
        ...(request.system ? { system: request.system } : {}),
        messages: [{ role: "user", content: request.prompt }],
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      let content = "";
      const toolCalls: ToolCall[] = [];

      for (const block of message.content) {
        if (block.type === "text") {
          content += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return {
        content,
        tool_calls: toolCalls,
        usage: {
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
        },
      };
    },
  };
}
