import OpenAI from "openai";
import type {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ToolCall,
} from "./types.js";

export function createOpenAIProvider(options?: {
  apiKey?: string;
  baseURL?: string;
}): Provider {
  const client = new OpenAI({
    apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    ...(options?.baseURL ? { baseURL: options.baseURL } : {}),
  });

  return {
    name: "openai",
    async chat(request: ProviderRequest): Promise<ProviderResponse> {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (request.system) {
        messages.push({ role: "system", content: request.system });
      }

      messages.push({ role: "user", content: request.prompt });

      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined =
        request.tools?.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as OpenAI.FunctionParameters,
          },
        }));

      const completion = await client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0,
        max_tokens: request.max_tokens ?? 500,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const choice = completion.choices[0];
      const content = choice.message.content ?? "";
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(
        (tc) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })
      );

      return {
        content,
        tool_calls: toolCalls,
        usage: completion.usage
          ? {
              prompt_tokens: completion.usage.prompt_tokens,
              completion_tokens: completion.usage.completion_tokens,
            }
          : undefined,
      };
    },
  };
}
