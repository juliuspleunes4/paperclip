import type { UIAdapterModule } from "../types";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import { OllamaLocalConfigFields } from "./config-fields";

function parseOllamaStdoutLine(line: string, ts: string): TranscriptEntry[] {
  // Simple stdout passthrough - just display the text as-is
  return [{ kind: "stdout", ts, text: line }];
}

function buildOllamaLocalConfig(values: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  
  if (values.model) config.model = values.model;
  if (values.cwd) config.cwd = values.cwd;
  if (values.instructionsFilePath) config.instructionsFilePath = values.instructionsFilePath;
  if (values.promptTemplate) config.promptTemplate = values.promptTemplate;
  if (values.timeoutSec) config.timeoutSec = values.timeoutSec;
  if (values.graceSec) config.graceSec = values.graceSec;
  if (typeof values.temperature === "number") config.temperature = values.temperature;
  if (values.maxTokens) config.maxTokens = values.maxTokens;
  if (values.baseUrl) config.baseUrl = values.baseUrl;
  if (typeof values.preload === "boolean") config.preload = values.preload;
  
  return config;
}

export const ollamaLocalUIAdapter: UIAdapterModule = {
  type: "ollama_local",
  label: "Ollama (local)",
  parseStdoutLine: parseOllamaStdoutLine,
  ConfigFields: OllamaLocalConfigFields,
  buildAdapterConfig: buildOllamaLocalConfig,
};
