import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

for (const scenario of ["success", "build-failure", "restart-failure", "health-failure"]) {
  test(`deployment ${scenario} preserves the correct static build`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "fxn-deploy-test-"));
    try {
      await copyFile(new URL("../deploy.sh", import.meta.url), join(dir, "deploy.sh"));
      await mkdir(join(dir, "dist"));
      await writeFile(join(dir, "dist/release"), "previous");
      // Exported functions replace external services only in this isolated shell.
      const result = spawnSync("bash", ["-c", `
        npm() { return 0; }
        python3() { [[ "$SCENARIO" != build-failure ]] || return 1; mkdir -p .dist-build; printf new > .dist-build/release; }
        systemctl() { [[ "$SCENARIO" != restart-failure ]]; }
        curl() { if [[ "$SCENARIO" == health-failure ]]; then printf 502; else printf 200; fi; }
        sleep() { return 0; }
        git() { printf test; }
        export -f npm python3 systemctl curl sleep git
        bash deploy.sh
      `], { cwd: dir, env: { ...process.env, SCENARIO: scenario }, encoding: "utf8", timeout: 10000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, scenario === "success" ? 0 : 1, result.stderr);
      assert.equal(await readFile(join(dir, "dist/release"), "utf8"), scenario === "success" ? "new" : "previous");
      if (scenario === "success") assert.equal(await readFile(join(dir, ".dist-old/release"), "utf8"), "previous");
      else assert.doesNotMatch(result.stdout, /deployed/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
