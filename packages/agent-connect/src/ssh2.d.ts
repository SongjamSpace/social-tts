declare module "ssh2" {
  import { EventEmitter } from "events";
  export class Client extends EventEmitter {
    connect(config: ConnectionConfig): void;
    shell(callback: (err: Error | undefined, stream?: any) => void): void;
    end(): void;
  }
  export interface ConnectionConfig {
    host: string;
    port?: number;
    username: string;
    privateKey?: string;
  }
}
