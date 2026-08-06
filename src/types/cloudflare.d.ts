export {};

declare global {
  interface CloudflareEnv {
    HYPERDRIVE?: {
      connectionString: string;
    };
  }
}
