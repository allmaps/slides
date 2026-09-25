import { spawn } from "node:child_process";

type ShutdownSignal = "SIGINT" | "SIGTERM";

export class CommandInterruptedError extends Error {
  readonly exitCode: number;

  constructor(signal: ShutdownSignal) {
    super(`Command interrupted (${signal})`);
    this.name = "CommandInterruptedError";
    this.exitCode = signal === "SIGINT" ? 130 : 143;
  }
}

export async function runNode(script: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", ...options });
  let shutdownSignal: ShutdownSignal | undefined;
  const stop = (signal: ShutdownSignal) => {
    shutdownSignal ??= signal;
    child.kill(signal);
  };
  const interrupt = () => stop("SIGINT");
  const terminate = () => stop("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        const interruption = shutdownSignal ?? (signal === "SIGINT" || signal === "SIGTERM" ? signal : undefined);
        // A child may handle the signal and exit successfully; still stop later build steps.
        if (interruption) reject(new CommandInterruptedError(interruption));
        else if (code === 0) resolve();
        else reject(new Error(`Command failed (${signal ?? code}): ${script}`));
      });
    });
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
  }
}
