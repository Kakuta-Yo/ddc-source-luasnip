import {
  BaseSource,
  type GatherArguments,
  type OnInitArguments,
} from "https://deno.land/x/ddc_vim@v5.0.0/base/source.ts";
import type { Item } from "https://deno.land/x/ddc_vim@v5.0.0/types.ts";
import type { Denops } from "https://deno.land/x/denops_std@v6.5.0/mod.ts";

export interface Params {
  mark: string;
  dup: boolean;
  maxCandidates: number;
  enableCache: boolean;
  cacheTimeout: number;
  filetypes: string[];
  excludeFiletypes: string[];
  showCondition: boolean;
  enableRegexTrigger: boolean;
  debug: boolean;
  [key: string]: unknown;
}

interface LuaSnipData {
  trigger: string;
  name?: string;
  description?: string;
  wordTrig?: boolean;
  regTrig?: boolean;
  filetype: string;
}

interface CacheEntry {
  data: LuaSnipData[];
  timestamp: number;
}

interface AnalyzeResult {
  shouldComplete: boolean;
  filetype: string;
}

class SnippetCache {
  private cache = new Map<string, CacheEntry>();
  private timeout: number;

  constructor(timeout = 5000) {
    this.timeout = timeout;
  }

  async get(
    filetype: string,
    fetcher: () => Promise<LuaSnipData[]>,
  ): Promise<LuaSnipData[]> {
    const entry = this.cache.get(filetype);
    const now = Date.now();

    if (entry && (now - entry.timestamp) < this.timeout) {
      return entry.data;
    }

    const data = await fetcher();
    this.cache.set(filetype, { data, timestamp: now });
    return data;
  }

  invalidate(filetype?: string): void {
    if (filetype) {
      this.cache.delete(filetype);
    } else {
      this.cache.clear();
    }
  }
}

class LuaSnipInterface {
  async getSnippets(
    denops: Denops,
    filetype: string,
  ): Promise<LuaSnipData[]> {
    try {
      const luaCode = `
        local ok, luasnip = pcall(require, 'luasnip')
        if not ok then
          return {}
        end
        
        local snippets = {}
        local snip_list = luasnip.get_snippets('${filetype}') or {}
        
        for _, snip in ipairs(snip_list) do
          table.insert(snippets, {
            trigger = snip.trigger or '',
            name = snip.name or '',
            description = snip.dscr or '',
            wordTrig = snip.wordTrig,
            regTrig = snip.regTrig,
            filetype = '${filetype}',
          })
        end
        
        return snippets
      `;

      const result = await denops.call("luaeval", luaCode);
      return Array.isArray(result) ? result as LuaSnipData[] : [];
    } catch (error) {
      console.error("[ddc-source-luasnip] Failed to get snippets:", error);
      return [];
    }
  }

  async isLuaSnipAvailable(denops: Denops): Promise<boolean> {
    try {
      const luaCode = `
        local ok, luasnip = pcall(require, 'luasnip')
        return ok and luasnip ~= nil
      `;
      const result = await denops.call("luaeval", luaCode);
      return Boolean(result);
    } catch {
      return false;
    }
  }
}

export class Source extends BaseSource<Params> {
  private cache: SnippetCache = new SnippetCache();
  private luasnipInterface: LuaSnipInterface = new LuaSnipInterface();
  override isInitialized = false;

  override async onInit(args: OnInitArguments<Params>): Promise<void> {
    const { denops } = args;

    // Check if LuaSnip is available
    const isAvailable = await this.luasnipInterface.isLuaSnipAvailable(denops);
    if (!isAvailable) {
      console.warn(
        "[ddc-source-luasnip] LuaSnip plugin is not available. Please install L3MON4D3/LuaSnip.",
      );
      return;
    }

    this.isInitialized = true;
  }

  override async gather(
    args: GatherArguments<Params>,
  ): Promise<Item[]> {
    if (!this.isInitialized) {
      return [];
    }

    const { denops, context, sourceParams } = args;

    try {
      // Analyze context
      const analyzeResult = await this.analyzeContext(denops, context);
      if (!analyzeResult.shouldComplete) {
        return [];
      }

      // Get snippets with caching
      const snippets = await this.getSnippets(
        denops,
        analyzeResult.filetype,
        sourceParams,
      );

      // Filter snippets based on input
      const filtered = this.filterSnippets(snippets, context.input);

      // Convert to DDC items
      return this.convertToItems(
        filtered,
        sourceParams,
      ).slice(0, sourceParams.maxCandidates);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  override params(): Params {
    return {
      mark: "[LS]",
      dup: false,
      maxCandidates: 500,
      enableCache: true,
      cacheTimeout: 5000,
      filetypes: [],
      excludeFiletypes: [],
      showCondition: true,
      enableRegexTrigger: true,
      debug: false,
    };
  }

  private async analyzeContext(
    denops: Denops,
    context: any,
  ): Promise<AnalyzeResult> {
    try {
      const filetype = await denops.eval("&filetype") as string;

      return {
        shouldComplete: true,
        filetype: filetype || "all",
      };
    } catch (error) {
      console.error("[ddc-source-luasnip] Context analysis failed:", error);
      return {
        shouldComplete: false,
        filetype: "",
      };
    }
  }

  private async getSnippets(
    denops: Denops,
    filetype: string,
    sourceParams: Params,
  ): Promise<LuaSnipData[]> {
    // Check filetype restrictions
    if (
      sourceParams.filetypes.length > 0 &&
      !sourceParams.filetypes.includes(filetype)
    ) {
      return [];
    }

    if (sourceParams.excludeFiletypes.includes(filetype)) {
      return [];
    }

    if (sourceParams.enableCache) {
      return await this.cache.get(
        filetype,
        () => this.luasnipInterface.getSnippets(denops, filetype),
      );
    } else {
      return await this.luasnipInterface.getSnippets(denops, filetype);
    }
  }

  private filterSnippets(
    snippets: LuaSnipData[],
    input: string,
  ): LuaSnipData[] {
    if (!input.trim()) {
      return snippets;
    }

    const inputLower = input.toLowerCase();

    return snippets.filter((snippet) => {
      // Basic prefix matching
      if (snippet.trigger.toLowerCase().startsWith(inputLower)) {
        return true;
      }

      // Name matching if available
      if (snippet.name && snippet.name.toLowerCase().includes(inputLower)) {
        return true;
      }

      return false;
    });
  }

  private convertToItems(
    snippets: LuaSnipData[],
    sourceParams: Params,
  ): Item[] {
    return snippets.map((snippet) => ({
      word: snippet.trigger,
      abbr: snippet.name || snippet.trigger,
      menu: `${sourceParams.mark} ${snippet.description || ""}`.trim(),
      info: this.buildInfoText(snippet),
      kind: "Snippet",
      dup: sourceParams.dup,
    }));
  }

  private buildInfoText(snippet: LuaSnipData): string {
    const parts: string[] = [];

    parts.push(`Trigger: ${snippet.trigger}`);

    if (snippet.name) {
      parts.push(`Name: ${snippet.name}`);
    }

    if (snippet.description) {
      parts.push(`Description: ${snippet.description}`);
    }

    parts.push(`Filetype: ${snippet.filetype}`);

    const flags: string[] = [];
    if (snippet.wordTrig) flags.push("word trigger");
    if (snippet.regTrig) flags.push("regex trigger");
    if (flags.length > 0) {
      parts.push(`Flags: ${flags.join(", ")}`);
    }

    return parts.join("\n");
  }

  private handleError(error: unknown): void {
    if (error instanceof Error) {
      switch (true) {
        case error.message.includes("LuaSnip not found"):
          console.warn(
            "[ddc-source-luasnip] LuaSnip plugin is not installed",
          );
          break;
        case error.message.includes("Lua execution error"):
          console.error(
            "[ddc-source-luasnip] Lua code execution failed:",
            error,
          );
          break;
        default:
          console.error("[ddc-source-luasnip] Unexpected error:", error);
      }
    } else {
      console.error("[ddc-source-luasnip] Unknown error:", error);
    }
  }
}
