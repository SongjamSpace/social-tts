/** Connection bundle format (matches web app .opencaw file). */
export interface AgentConnectionBundle {
  version: 1;
  host: string;
  port: number;
  user: string;
  privateKeyPem: string;
  mint?: string;
  label?: string;
}

interface ParsedBundle {
  version?: number;
  host?: string;
  port?: number;
  user?: string;
  privateKeyPem?: string;
  mint?: string;
  label?: string;
}

export function parseBundle(json: string): AgentConnectionBundle {
  const b = JSON.parse(json) as ParsedBundle;
  if (!b || b.version !== 1 || typeof b.host !== "string" || typeof b.privateKeyPem !== "string") {
    throw new Error("Invalid connection bundle");
  }
  return {
    version: 1,
    host: b.host,
    port: typeof b.port === "number" ? b.port : 22,
    user: typeof b.user === "string" ? b.user : "root",
    privateKeyPem: b.privateKeyPem,
    mint: typeof b.mint === "string" ? b.mint : undefined,
    label: typeof b.label === "string" ? b.label : undefined,
  };
}
