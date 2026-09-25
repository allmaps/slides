import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

const runnerUrl = new URL("../src/build/process.ts", import.meta.url).href;

async function run(t, source, signal) {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", `
    import assert from "node:assert/strict";
    import { runNode, CommandInterruptedError } from ${JSON.stringify(runnerUrl)};
    const signals = ["SIGINT", "SIGTERM"];
    const listeners = signals.map(signal => process.listenerCount(signal));
    try {
      await runNode("--eval", [${JSON.stringify(source)}]);
      console.log("continued");
    } catch (error) {
      if (error instanceof CommandInterruptedError) process.exitCode = error.exitCode;
      else { console.error(error); process.exitCode = 1; }
    } finally {
      assert.deepEqual(signals.map(signal => process.listenerCount(signal)), listeners);
    }
  `], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  t.after(() => child.kill("SIGKILL"));
  child.stdout.on("data", bytes => {
    stdout += bytes;
    if (signal && stdout.includes("ready\n")) {
      child.kill(signal);
      signal = undefined;
    }
  });
  child.stderr.on("data", bytes => stderr += bytes);
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  return { ...result, stdout, stderr };
}

test("successful commands continue and failed commands remain errors", { timeout: 10_000 }, async t => {
  const success = await run(t, "process.exit(0)");
  assert.equal(success.code, 0);
  assert.equal(success.stdout, "continued\n");
  assert.equal(success.stderr, "");
  const failure = await run(t, "process.exit(7)");
  assert.equal(failure.code, 1);
  assert.equal(failure.stdout, "");
  assert.match(failure.stderr, /Command failed \(7\)/);
});

for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  for (const graceful of [false, true]) {
    test(`${signal} quietly stops subsequent steps${graceful ? " even when the child exits successfully" : ""}`, { timeout: 10_000 }, async t => {
      const result = await run(t, `
        ${graceful ? `process.on("${signal}", () => process.exit(0));` : ""}
        setInterval(() => {}, 1000);
        console.log("ready");
      `, signal);
      assert.equal(result.code, exitCode);
      assert.equal(result.signal, null);
      assert.equal(result.stdout, "ready\n");
      assert.equal(result.stderr, "");
    });
  }

  test(`a child terminated directly with ${signal} also stops quietly`, { timeout: 10_000 }, async t => {
    const result = await run(t, `process.kill(process.pid, "${signal}")`);
    assert.equal(result.code, exitCode);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });
}

test("unexpected termination still reports a failure", { timeout: 10_000 }, async t => {
  const result = await run(t, 'process.kill(process.pid, "SIGKILL")');
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Command failed \(SIGKILL\)/);
});
