import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { expect, it } from "vitest";
import { createNitro } from "../../src/nitro.ts";
import { deprecateSWR, generateFunctionFiles } from "../../src/presets/vercel/utils.ts";

it("preserves the SWR max age in emitted Vercel prerender configs", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-vercel-swr-"));
  const nitro = await createNitro({
    rootDir,
    preset: "vercel",
    routeRules: {
      "/**": { swr: 60 },
      "/en/**": { isr: 60 },
      "/cached": { cache: { swr: true, maxAge: 120 } },
      "/permanent": { swr: true },
      "/override": { swr: 60, isr: 30 },
      "/disabled": { swr: false },
    },
  });
  try {
    deprecateSWR(nitro);
    await mkdir(nitro.options.output.serverDir, { recursive: true });
    await generateFunctionFiles(nitro);
    const functionsDir = join(nitro.options.output.serverDir, "..");
    const expiration = async (name: string) =>
      JSON.parse(await readFile(join(functionsDir, `${name}-isr.prerender-config.json`), "utf8"))
        .expiration;
    expect(await expiration("[...]")).toBe(60);
    expect(await expiration("en/[...]")).toBe(60);
    expect(await expiration("cached")).toBe(120);
    expect(await expiration("permanent")).toBe(false);
    expect(await expiration("override")).toBe(30);
    expect(nitro.options.routeRules["/disabled"].isr).toBe(false);
  } finally {
    await nitro.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});
