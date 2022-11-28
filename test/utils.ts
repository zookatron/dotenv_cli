import { assertEquals, assertNotEquals } from "https://deno.land/std@0.167.0/testing/asserts.ts";

function arraysEqual(first: unknown[], second: unknown[]) {
  if (first === second) return true;
  if (first == null || second == null) return false;
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; ++index) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}

export class MockConsole {
  private oldConsole: Console | null = null;
  private events: Array<{ type: string; args: unknown[] }> = [];

  public async withMock(context: () => unknown) {
    if (globalThis.console instanceof MockConsole) {
      throw new Error("The console is already being mocked!");
    }
    this.oldConsole = globalThis.console;
    globalThis.console = this as unknown as Console;
    try {
      await Promise.resolve(context());
    } finally {
      globalThis.console = this.oldConsole;
      this.oldConsole = null;
    }
  }

  log(...args: unknown[]) {
    this.events.push({ type: "log", args });
  }

  error(...args: unknown[]) {
    this.events.push({ type: "error", args });
  }

  assertLog(...args: unknown[]) {
    assertNotEquals(
      this.events.find((event) => event.type === "log" && arraysEqual(event.args, args)),
      undefined,
      `Expected console.log was not produced! (Expected [${args.map((arg) => JSON.stringify(arg)).join(", ")}])`,
    );
  }

  assertLogContains(value: string) {
    assertNotEquals(
      this.events.find((event) =>
        event.type === "log" && event.args.some((item: unknown) => typeof item === "string" && item.includes(value))
      ),
      undefined,
      `Expected console.log was not produced! (Expected "${value}")`,
    );
  }

  assertError(...args: unknown[]) {
    assertNotEquals(
      this.events.find((event) => event.type === "error" && arraysEqual(event.args, args)),
      undefined,
      `Expected console.error was not produced! (Expected [${args.map((arg) => JSON.stringify(arg)).join(", ")}])`,
    );
  }

  assertErrorContains(value: string) {
    assertNotEquals(
      this.events.find((event) =>
        event.type === "error" && event.args.some((item: unknown) => typeof item === "string" && item.includes(value))
      ),
      undefined,
      `Expected console.error was not produced! (Expected "${value}")`,
    );
  }
}

export function mockConsole(context: (mockConsole: MockConsole) => unknown) {
  const mockConsole = new MockConsole();
  return mockConsole.withMock(() => context(mockConsole));
}

class ExitError extends Error {
  constructor(public code?: number) {
    super();
  }
}

export async function assertExits(code: number | undefined, context: () => unknown) {
  const oldExit = Deno.exit;
  const newExit = (code?: number) => {
    throw new ExitError(code);
  };
  Object.defineProperty(Deno, "exit", { configurable: true, value: newExit });
  try {
    await Promise.resolve(context());
    throw new Error("The process did not exit!");
  } catch (error) {
    if (error instanceof ExitError) {
      assertEquals(error.code, code, `The process did not exit with the correct exit code! (Expected "${code}", found "${error.code}")`);
    } else {
      throw error;
    }
  } finally {
    Object.defineProperty(Deno, "exit", { configurable: true, value: oldExit });
  }
}
