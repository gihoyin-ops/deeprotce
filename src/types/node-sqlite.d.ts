// Barebones type shim for node:sqlite (built into Node >= 22.5). Our pinned
// @types/node is old as shit and lacks this module, so this covers only
// the exact API the feedback route touches
declare module 'node:sqlite' {
  export class StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(path: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
