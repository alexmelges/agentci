export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ProviderRequest {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
}

export interface ProviderResponse {
  content: string;
  tool_calls: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface Provider {
  name: string;
  chat(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface ProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  base_url?: string;
  api_key?: string;
}
