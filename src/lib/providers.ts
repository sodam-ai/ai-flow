import type { Provider } from "@/types";

export const PROVIDERS: Provider[] = [
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o", keyPrefix: "sk-" },
  {
    id: "anthropic",
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-5",
    keyPrefix: "sk-ant-",
  },
  {
    id: "google",
    name: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    keyPrefix: "AIza",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    defaultModel: "llama3",
    keyPrefix: "",
  },
  {
    id: "mistral",
    name: "Mistral",
    defaultModel: "mistral-large-latest",
    keyPrefix: "",
  },
  { id: "groq", name: "Groq", defaultModel: "llama3-70b-8192", keyPrefix: "gsk_" },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    keyPrefix: "sk-",
  },
  { id: "cohere", name: "Cohere", defaultModel: "command-r-plus", keyPrefix: "" },
  { id: "xai", name: "xAI (Grok)", defaultModel: "grok-beta", keyPrefix: "xai-" },
  {
    id: "azure_openai",
    name: "Azure OpenAI",
    defaultModel: "gpt-4o",
    keyPrefix: "",
  },
  {
    id: "openai_compatible",
    name: "OpenAI Compatible",
    defaultModel: "custom",
    keyPrefix: "",
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
