// Minimal type surface for node:sqlite (built into Node >= 22.5). The pinned
// @types/node is older and does not declare the module, so this shim covers
// exactly the API the feedback route uses.
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
