import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Source } from "../denops/@ddc-sources/luasnip.ts";

// Mock Denops interface for testing
class MockDenops {
  private mockResponses: Map<string, any> = new Map();

  setMockResponse(method: string, args: any, response: any) {
    const key = `${method}:${JSON.stringify(args)}`;
    this.mockResponses.set(key, response);
  }

  async call(fn: string, ...args: any[]): Promise<any> {
    const key = `${fn}:${JSON.stringify(args)}`;
    const response = this.mockResponses.get(key);
    if (response !== undefined) {
      return response;
    }

    // Default responses
    switch (fn) {
      case "luaeval":
        if (args[0].includes("pcall(require, 'luasnip')")) {
          return true; // LuaSnip is available
        }
        return [];
      default:
        return null;
    }
  }

  async eval(expr: string): Promise<any> {
    switch (expr) {
      case "&filetype":
        return "typescript";
      default:
        return "";
    }
  }
}

// Mock context object
const createMockContext = (input = "", filetype = "typescript") => ({
  input,
  nextInput: "",
  lineNr: 1,
  col: 1,
  filetype,
  bufnr: 1,
});

// Mock arguments for gather function
const createMockGatherArgs = (input = "", sourceParams = {}) => {
  const source = new Source();
  const defaultParams = source.params();

  return {
    denops: new MockDenops() as any,
    context: createMockContext(input),
    sourceParams: { ...defaultParams, ...sourceParams },
    completeOption: {},
    completeStr: input,
  };
};

Deno.test("Source params returns default configuration", () => {
  const source = new Source();
  const params = source.params();

  assertEquals(params.mark, "[LS]");
  assertEquals(params.dup, false);
  assertEquals(params.maxCandidates, 500);
  assertEquals(params.enableCache, true);
  assertEquals(params.cacheTimeout, 5000);
  assertEquals(params.filetypes, []);
  assertEquals(params.excludeFiletypes, []);
  assertEquals(params.showCondition, true);
  assertEquals(params.enableRegexTrigger, true);
  assertEquals(params.debug, false);
});

Deno.test("gather returns empty array when LuaSnip is not available", async () => {
  const source = new Source();
  const args = createMockGatherArgs();

  // Mock LuaSnip not available
  (args.denops as any).setMockResponse(
    "luaeval",
    ["local ok, luasnip = pcall(require, 'luasnip')\n        return ok and luasnip ~= nil"],
    false,
  );

  // Initialize should fail
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);
  assertEquals(items, []);
});

Deno.test("gather returns empty array for excluded filetypes", async () => {
  const source = new Source();
  const args = createMockGatherArgs("", { excludeFiletypes: ["typescript"] });

  // Initialize
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);
  assertEquals(items, []);
});

Deno.test("gather returns empty array when filetype not in allowed list", async () => {
  const source = new Source();
  const args = createMockGatherArgs("", { filetypes: ["python"] });

  // Initialize
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);
  assertEquals(items, []);
});

Deno.test("gather returns formatted items for valid snippets", async () => {
  const source = new Source();
  const args = createMockGatherArgs("func");

  // Mock snippet data
  const mockSnippets = [
    {
      trigger: "function",
      name: "Function Declaration",
      description: "Create a function",
      wordTrig: true,
      regTrig: false,
      filetype: "typescript",
    },
    {
      trigger: "func",
      name: "Short Function",
      description: "Create a short function",
      wordTrig: true,
      regTrig: false,
      filetype: "typescript",
    },
  ];

  (args.denops as any).setMockResponse(
    "luaeval",
    [expect.stringContaining("luasnip.get_snippets")],
    mockSnippets,
  );

  // Initialize
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);

  assertEquals(items.length, 2);

  // Check first item
  assertEquals(items[0].word, "function");
  assertEquals(items[0].abbr, "Function Declaration");
  assertEquals(items[0].kind, "Snippet");
  assertExists(items[0].menu);
  assertExists(items[0].info);
});

Deno.test("gather filters snippets based on input", async () => {
  const source = new Source();
  const args = createMockGatherArgs("fun");

  // Mock snippet data
  const mockSnippets = [
    {
      trigger: "function",
      name: "Function Declaration",
      description: "Create a function",
      filetype: "typescript",
    },
    {
      trigger: "variable",
      name: "Variable Declaration",
      description: "Create a variable",
      filetype: "typescript",
    },
  ];

  (args.denops as any).setMockResponse(
    "luaeval",
    [expect.stringContaining("luasnip.get_snippets")],
    mockSnippets,
  );

  // Initialize
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);

  // Should only return "function" as it starts with "fun"
  assertEquals(items.length, 1);
  assertEquals(items[0].word, "function");
});

Deno.test("gather respects maxCandidates limit", async () => {
  const source = new Source();
  const args = createMockGatherArgs("", { maxCandidates: 2 });

  // Mock snippet data with 3 items
  const mockSnippets = [
    { trigger: "snippet1", filetype: "typescript" },
    { trigger: "snippet2", filetype: "typescript" },
    { trigger: "snippet3", filetype: "typescript" },
  ];

  (args.denops as any).setMockResponse(
    "luaeval",
    [expect.stringContaining("luasnip.get_snippets")],
    mockSnippets,
  );

  // Initialize
  await source.onInit({ denops: args.denops, sourceParams: args.sourceParams });

  const items = await source.gather(args);

  // Should be limited to maxCandidates
  assertEquals(items.length, 2);
});

// Helper for partial string matching in mock responses
const expect = {
  stringContaining: (substring: string) => ({
    [Symbol.for("jest.asymmetricMatcher")]: true,
    asymmetricMatch: (actual: string) => actual.includes(substring),
  }),
};
