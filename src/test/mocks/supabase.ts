import { vi } from "vitest";

type QueryResult = { data: unknown; error: unknown; count?: number };

function createChainableMock(result: QueryResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "in",
    "lt",
    "lte",
    "gt",
    "gte",
    "or",
    "overlaps",
    "order",
    "limit",
    "single",
    "range",
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Terminal methods return the result
  chain.single = vi.fn().mockResolvedValue(result);

  // Make non-terminal methods return chainable + thenable
  const thenable = {
    ...chain,
    then: (resolve: (value: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };

  for (const method of methods) {
    if (method !== "single") {
      chain[method] = vi.fn().mockReturnValue(thenable);
    }
  }

  return thenable;
}

export function createMockSupabase(result: QueryResult = { data: [], error: null }) {
  const chainable = createChainableMock(result);

  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}
