/**
 * Type definitions for OpenNext worker
 * The actual file is generated at build time in .open-next/worker.js
 */

declare module "*/.open-next/worker.js" {
  export interface WorkerHandler {
    fetch: (
      request: Request,
      env: Record<string, unknown>,
      ctx: ExecutionContext,
    ) => Promise<Response>;
  }

  const handler: WorkerHandler;
  export default handler;

  // Durable Objects for caching (optional)
  export class DOQueueHandler {
    constructor(state: DurableObjectState, env: Record<string, unknown>);
    fetch(request: Request): Promise<Response>;
  }

  export class DOShardedTagCache {
    constructor(state: DurableObjectState, env: Record<string, unknown>);
    fetch(request: Request): Promise<Response>;
  }
}
