/**
 * Mock types for Caido SDK - for development and validation
 * These should be replaced with actual @caido/sdk when available
 */

export interface Request {
  getId(): string;
  getHost(): string;
  getPort(): number;
  getMethod(): string;
  getPath(): string;
  getQuery(): string;
  getHeaders(): Record<string, string>;
  getBody(): Body | null;
  getCreatedAt(): number;
  getTls(): boolean;
}

export interface Body {
  toText(): Promise<string>;
  toJson(): Promise<any>;
  toRaw(): Promise<Uint8Array>;
}

export interface Response {
  getId(): string;
  getStatus(): number;
  getHeaders(): Record<string, string>;
  getBody(): Body | null;
}

export interface RequestEvent {
  request: Request;
}

export interface ResponseEvent {
  request: Request;
  response: Response;
}

export interface RequestQuery {
  filter(predicate: (req: Request) => boolean): RequestQuery;
  first(n: number): RequestQuery;
  execute(): Promise<Request[]>;
}

export interface EventAPI {
  onInterceptRequest(callback: (event: RequestEvent) => void | Promise<void>): void;
  onInterceptResponse(callback: (event: ResponseEvent) => void | Promise<void>): void;
}

export interface RequestAPI {
  query(): RequestQuery;
}

export interface BackendAPI<TRpc = any, TEvents = any> {
  register<TName extends keyof TRpc>(name: TName, fn: TRpc[TName]): void;
  send<TName extends keyof TEvents>(eventName: TName, data: TEvents[TName]): void;
}

export interface SDK<TRpc = any, TEvents = any> {
  events: EventAPI;
  requests: RequestAPI;
  api: BackendAPI<TRpc, TEvents>;
}