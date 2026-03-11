export type OpenClawCollectedPayload = {
  name: string;
  ticker: string;
  description: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  tone?: string;
  extra?: Record<string, unknown>;
  imageUrl?: string;
  /** User's description of how they want the logo to look (from chat). Pre-fills the logo prompt field. */
  imagePrompt?: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };
