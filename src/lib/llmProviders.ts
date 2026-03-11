/**
 * LLM providers for OpenClaw: get API key links and pricing.
 * Used on /openclaw so users can quickly grab a key (including low-cost options).
 */
export interface LLMProvider {
  slug: string;
  name: string;
  getApiKeyUrl: string;
  pricingUrl?: string;
  priceText: string;
  models: string[];
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    slug: "openai",
    name: "OpenAI",
    getApiKeyUrl: "https://platform.openai.com/api-keys",
    pricingUrl: "https://openai.com/pricing",
    priceText: "From ~$0.15/1M input",
    models: ["GPT-4o", "GPT-4o mini", "o1"],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    getApiKeyUrl: "https://console.anthropic.com/settings/keys",
    pricingUrl: "https://www.anthropic.com/pricing",
    priceText: "From ~$3/1M input",
    models: ["Claude 3.5", "Claude 3 Haiku"],
  },
  {
    slug: "kimi",
    name: "Kimi (Moonshot)",
    getApiKeyUrl: "https://platform.moonshot.cn/console/api/keys",
    pricingUrl: "https://platform.moonshot.cn/docs/pricing",
    priceText: "Low cost",
    models: ["Kimi 1.5", "Kimi 1"],
  },
  {
    slug: "groq",
    name: "Groq",
    getApiKeyUrl: "https://console.groq.com/keys",
    pricingUrl: "https://groq.com/pricing/",
    priceText: "Free tier available",
    models: ["Llama 3", "Mixtral"],
  },
  {
    slug: "together",
    name: "Together",
    getApiKeyUrl: "https://api.together.ai/settings/api-keys",
    pricingUrl: "https://www.together.ai/pricing",
    priceText: "From ~$0.20/1M",
    models: ["Llama 3", "Mistral", "Qwen"],
  },
  {
    slug: "google",
    name: "Google AI",
    getApiKeyUrl: "https://aistudio.google.com/app/apikey",
    pricingUrl: "https://ai.google.dev/pricing",
    priceText: "Free tier, then usage-based",
    models: ["Gemini Pro", "Gemini Flash"],
  },
];
