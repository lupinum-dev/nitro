import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { expect, it, vi } from "vitest";
import type { NitroConfig } from "nitro/types";
import { createNitro } from "../../src/nitro.ts";
import { NitroDevApp } from "../../src/dev/app.ts";

it.each<{
  name: string;
  config: NitroConfig;
  vary?: string;
  warning?: string;
}>([
  {
    name: "SWR with uncovered language and cookie headers",
    config: { routeRules: { "/**": { swr: 60 } } },
    vary: "Accept-Language, Cookie",
    warning: "accept-language, cookie",
  },
  {
    name: "ISR even with native cache variation configured",
    config: { routeRules: { "/**": { isr: 60, cache: { varies: ["cookie"] } } } },
    vary: "Cookie",
    warning: "cookie",
  },
  {
    name: "case-insensitive covered headers",
    config: { routeRules: { "/**": { cache: { varies: ["ACCEPT-LANGUAGE"] } } } },
    vary: "Accept-Language",
  },
  {
    name: "shared cache defaults",
    config: {
      cache: { defaults: { varies: ["cookie"] } },
      routeRules: { "/**": { swr: 60 } },
    },
    vary: "Cookie",
  },
  {
    name: "an explicitly uncached child route",
    config: { routeRules: { "/**": { swr: 60 }, "/page": { cache: false } } },
    vary: "Cookie",
  },
  {
    name: "no Vary header",
    config: { routeRules: { "/**": { isr: 60 } } },
  },
  {
    name: "wildcard Vary",
    config: { routeRules: { "/**": { swr: 60 } } },
    vary: "*",
    warning: "*",
  },
])("warns only for unsafe cache variation: $name", async ({ config, vary, warning }) => {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-dev-cache-vary-"));
  const nitro = await createNitro({ rootDir, dev: true, ...config });
  const warn = vi.spyOn(nitro.logger, "warn");
  try {
    const app = new NitroDevApp(nitro, () => new Response("ok", { headers: vary ? { vary } : {} }));
    const response = await app.fetch(new Request("http://localhost/page"));
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("vary")).toBe(vary ?? null);
    if (warning) {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Vary: ${warning}`));
    } else {
      expect(warn).not.toHaveBeenCalled();
    }
  } finally {
    warn.mockRestore();
    await nitro.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});
