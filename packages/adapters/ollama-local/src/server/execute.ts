import fs from "node:fs/promises";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  parseObject,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
  }
  const data = await response.json() as { models?: Array<{ name: string }> };
  return (data.models ?? []).map((m) => m.name);
}

async function preloadModel(baseUrl: string, model: string, timeoutMs: number): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "",
        stream: false,
      }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to preload model: ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildMessages(
  prompt: string,
  instructionsFilePath: string,
): Promise<OllamaMessage[]> {
  const messages: OllamaMessage[] = [];
  
  // System prompt from instructions file
  if (instructionsFilePath.trim()) {
    try {
      const instructionsContent = await fs.readFile(instructionsFilePath, "utf-8");
      messages.push({
        role: "system",
        content: instructionsContent,
      });
    } catch {
      // Silently skip if instructions file doesn't exist
    }
  }
  
  // User task
  messages.push({
    role: "user",
    content: prompt,
  });
  
  return messages;
}

async function executeOllamaChat(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
  onLog: AdapterExecutionContext["onLog"],
): Promise<AdapterExecutionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  const requestBody: OllamaChatRequest = {
    model,
    messages,
    stream: true,
    options: {
      temperature,
      ...(maxTokens > 0 ? { num_predict: maxTokens } : {}),
    },
  };
  
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      await onLog("stderr", `Ollama API error: ${response.status} ${response.statusText}\n${errorText}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Ollama API error: ${response.status} ${response.statusText}`,
      };
    }
    
    if (!response.body) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "No response body from Ollama",
      };
    }
    
    // Parse streaming JSON responses
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let totalTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const chunk = JSON.parse(line) as OllamaChatResponse;
          if (chunk.message?.content) {
            fullContent += chunk.message.content;
            await onLog("stdout", chunk.message.content);
          }
          if (chunk.eval_count) {
            totalTokens = chunk.eval_count;
          }
        } catch (parseErr) {
          // Skip malformed JSON lines
          continue;
        }
      }
    }
    
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      model,
      usage: {
        inputTokens: 0,
        outputTokens: totalTokens,
      },
      sessionParams: {
        model,
        messages: [...messages, { role: "assistant", content: fullContent }],
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: 1,
        signal: null,
        timedOut: true,
        errorMessage: "Ollama request timed out",
      };
    }
    
    const message = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `Ollama execution error: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Ollama execution error: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog } = ctx;
  
  // Parse configuration
  const baseUrl = asString(config.baseUrl, "http://localhost:11434");
  const preload = asBoolean(config.preload, true);
  const temperature = asNumber(config.temperature, 0.7);
  const maxTokens = asNumber(config.maxTokens, 0);
  const timeoutSec = asNumber(config.timeoutSec, 600);
  const timeoutMs = timeoutSec * 1000;
  const instructionsFilePath = asString(config.instructionsFilePath, "");
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  
  // Resolve model
  let model = asString(config.model, "");
  if (!model) {
    // Auto-detect first available model
    try {
      const availableModels = await listOllamaModels(baseUrl);
      if (availableModels.length === 0) {
        await onLog("stderr", "No Ollama models available. Run `ollama pull <model>` to download a model.\n");
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: "No Ollama models available",
        };
      }
      model = availableModels[0];
      await onLog("stdout", `Auto-selected model: ${model}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await onLog("stderr", `Failed to list Ollama models: ${message}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Failed to list Ollama models: ${message}`,
      };
    }
  }
  
  // Preload model if requested
  if (preload) {
    await onLog("stdout", `Preloading model ${model} into memory...\n`);
    try {
      await preloadModel(baseUrl, model, 30000);
      await onLog("stdout", "Model preloaded successfully\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await onLog("stderr", `Failed to preload model: ${message}\n`);
      // Continue anyway - preloading is optional
    }
  }
  
  // Build prompt from template
  const prompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  });
  
  // Build messages
  const messages = await buildMessages(prompt, instructionsFilePath);
  
  await onLog("stdout", `Executing Ollama chat with model ${model}\n`);
  
  // Execute chat
  return executeOllamaChat(baseUrl, model, messages, temperature, maxTokens, timeoutMs, onLog);
}
