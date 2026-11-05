import { AsyncLocalStorage } from "node:async_hooks";

export const testUser = new AsyncLocalStorage<string>();
export function asUser<T>(id: string, work: () => Promise<T>): Promise<T> {
  return testUser.run(id, work);
}
