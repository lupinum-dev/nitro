import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import ts from "typescript";
import { expect, it } from "vitest";

it("resolves the built nitropack/types entry under NodeNext", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), "nitro-nodenext-"));
  try {
    mkdirSync(join(fixture, "node_modules"));
    symlinkSync(root, join(fixture, "node_modules/nitropack"), "dir");
    const entry = join(fixture, "config.mts");
    writeFileSync(
      entry,
      'import type { NitroConfig } from "nitropack/types";\n' +
        'const config: NitroConfig = { prerender: { routes: ["/"] }, alias: {} };\n' +
        "export const alias = config.alias;\n"
    );
    const program = ts.createProgram([entry], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: [],
    });
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        )
    ).toEqual([]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
