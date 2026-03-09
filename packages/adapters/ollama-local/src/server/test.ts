import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const baseUrl = asString(ctx.config.baseUrl, "http://localhost:11434");

  // Check if Ollama is running
  try {
    const response = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      checks.push({
        code: "ollama_api_error",
        level: "error",
        message: `Ollama API returned ${response.status}: ${response.statusText}`,
        hint: "Make sure Ollama is running with `ollama serve`",
      });
    } else {
      const data = await response.json() as { version?: string };
      if (!data.version) {
        checks.push({
          code: "ollama_version_missing",
          level: "warn",
          message: "Ollama API response missing version field",
        });
      } else {
        checks.push({
          code: "ollama_version_ok",
          level: "info",
          message: `Ollama ${data.version} is running`,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      code: "ollama_not_running",
      level: "error",
      message: "Ollama is not running",
      detail: message,
      hint: "Start Ollama with `ollama serve` or ensure it's installed from https://ollama.ai",
    });
  }

  // Check if models are available
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelCount = data.models?.length ?? 0;
      if (modelCount === 0) {
        checks.push({
          code: "ollama_no_models",
          level: "warn",
          message: "No Ollama models installed",
          hint: "Download a model with `ollama pull <model>`, e.g. `ollama pull qwen2.5:14b-instruct-q6_K`",
        });
      } else {
        checks.push({
          code: "ollama_models_ok",
          level: "info",
          message: `Found ${modelCount} installed model${modelCount === 1 ? "" : "s"}`,
        });
      }
    }
  } catch {
    // Non-fatal if we can't list models but Ollama is running
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
