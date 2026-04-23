import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { detectImportsFromText, detectProjectSignals, inferCategoryFromPath } from "../src/context/projectDetector";

describe("projectDetector", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it("detects categories from common manifests", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "brainbud-"));
    await writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { react: "18.0.0" }, devDependencies: { typescript: "5.0.0" } })
    );
    await writeFile(path.join(tempDir, "pyproject.toml"), "[project]\ndependencies = ['django>=5.0']\n");
    await writeFile(path.join(tempDir, "Cargo.toml"), "[package]\nname='demo'\n");

    const signals = await detectProjectSignals(tempDir);

    expect(signals.categories).toEqual(expect.arrayContaining(["react", "typescript", "python", "django", "rust"]));
    expect(signals.matchedFiles).toEqual(expect.arrayContaining(["package.json", "pyproject.toml", "Cargo.toml"]));
  });

  it("extracts imports from source text", () => {
    const imports = detectImportsFromText([
      'import React from "react";',
      'import "./styles.css";',
      'const z = require("zod");',
      'from "next/navigation"'
    ].join("\n"));

    expect(imports).toEqual(expect.arrayContaining(["react", "./styles.css", "zod", "next/navigation"]));
  });

  it("infers categories from file paths", () => {
    expect(inferCategoryFromPath("src/app/page.tsx")).toEqual(expect.arrayContaining(["typescript", "react"]));
    expect(inferCategoryFromPath("backend/manage.py")).toEqual(expect.arrayContaining(["python"]));
    expect(inferCategoryFromPath("crates/core/lib.rs")).toEqual(["rust"]);
  });
});
