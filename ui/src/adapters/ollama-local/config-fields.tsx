import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";
import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { CheckCircle2, XCircle, Loader2, Download, AlertCircle, ExternalLink } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Choose a template or provide an absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior.";
const baseUrlHint =
  "Ollama API base URL (default: http://localhost:11434)";
const temperatureHint =
  "Sampling temperature for model inference (0.0-2.0, default: 0.7)";
const preloadHint =
  "Load model into memory before first request for faster response times";

const INSTRUCTION_TEMPLATES = [
  { id: "custom", label: "Custom path...", path: "" },
  { id: "ceo", label: "CEO (Chief Executive Officer)", path: "server/src/templates/instructions/ceo.md" },
  { id: "cto", label: "CTO (Chief Technology Officer)", path: "server/src/templates/instructions/cto.md" },
  { id: "product-manager", label: "Product Manager", path: "server/src/templates/instructions/product-manager.md" },
  { id: "software-engineer", label: "Software Engineer", path: "server/src/templates/instructions/software-engineer.md" },
  { id: "research-and-development", label: "Research & Development", path: "server/src/templates/instructions/research-and-development.md" },
  { id: "data-scientist", label: "Data Scientist", path: "server/src/templates/instructions/data-scientist.md" },
  { id: "qa-engineer", label: "QA Engineer", path: "server/src/templates/instructions/qa-engineer.md" },
  { id: "devops-engineer", label: "DevOps Engineer", path: "server/src/templates/instructions/devops-engineer.md" },
];

const RECOMMENDED_MODEL = "qwen2.5:14b-instruct-q6_K";

type OllamaStatus = "checking" | "running" | "not-running" | "error";
type ModelStatus = "checking" | "available" | "not-available" | "pulling" | "error";

async function checkOllamaRunning(baseUrl: string): Promise<boolean> {
  try {
    const url = baseUrl || "http://localhost:11434";
    const response = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const url = baseUrl || "http://localhost:11434";
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

async function pullOllamaModel(baseUrl: string, modelName: string, onProgress?: (progress: string) => void): Promise<boolean> {
  try {
    const url = baseUrl || "http://localhost:11434";
    const response = await fetch(`${url}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    
    if (!response.ok || !response.body) return false;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.status && onProgress) {
            onProgress(json.status);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

export function OllamaLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const currentPath = isCreate
    ? values!.instructionsFilePath ?? ""
    : eff("adapterConfig", "instructionsFilePath", String(config.instructionsFilePath ?? ""));
  
  const currentBaseUrl = isCreate
    ? values!.baseUrl ?? "http://localhost:11434"
    : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? "http://localhost:11434"));
  
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    const template = INSTRUCTION_TEMPLATES.find(t => t.path === currentPath);
    return template?.id ?? "custom";
  });

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("checking");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("checking");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [pullProgress, setPullProgress] = useState<string>("");
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  // Check Ollama and models on mount and when baseUrl changes
  useEffect(() => {
    let mounted = true;
    
    async function check() {
      setOllamaStatus("checking");
      const isRunning = await checkOllamaRunning(currentBaseUrl);
      
      if (!mounted) return;
      
      if (isRunning) {
        setOllamaStatus("running");
        setModelStatus("checking");
        
        const models = await listOllamaModels(currentBaseUrl);
        if (!mounted) return;
        
        setAvailableModels(models);
        
        if (models.includes(RECOMMENDED_MODEL)) {
          setModelStatus("available");
        } else {
          setModelStatus("not-available");
        }
      } else {
        setOllamaStatus("not-running");
        setModelStatus("error");
      }
    }
    
    check();
    
    return () => { mounted = false; };
  }, [currentBaseUrl]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = INSTRUCTION_TEMPLATES.find(t => t.id === templateId);
    if (template && template.path) {
      if (isCreate) {
        set!({ instructionsFilePath: template.path });
      } else {
        mark("adapterConfig", "instructionsFilePath", template.path);
      }
    }
  };

  const handlePullModel = async () => {
    setModelStatus("pulling");
    setPullProgress("Starting download...");
    
    const success = await pullOllamaModel(
      currentBaseUrl,
      RECOMMENDED_MODEL,
      (progress) => setPullProgress(progress)
    );
    
    if (success) {
      setModelStatus("available");
      setPullProgress("");
      // Refresh model list
      const models = await listOllamaModels(currentBaseUrl);
      setAvailableModels(models);
    } else {
      setModelStatus("error");
      setPullProgress("Failed to pull model");
    }
  };

  const handleRetryCheck = async () => {
    setOllamaStatus("checking");
    const isRunning = await checkOllamaRunning(currentBaseUrl);
    
    if (isRunning) {
      setOllamaStatus("running");
      setModelStatus("checking");
      
      const models = await listOllamaModels(currentBaseUrl);
      setAvailableModels(models);
      
      if (models.includes(RECOMMENDED_MODEL)) {
        setModelStatus("available");
      } else {
        setModelStatus("not-available");
      }
    } else {
      setOllamaStatus("not-running");
      setModelStatus("error");
    }
  };

  return (
    <>
      {/* Ollama Status Panel */}
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ollamaStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {ollamaStatus === "running" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {ollamaStatus === "not-running" && <XCircle className="h-4 w-4 text-destructive" />}
            {ollamaStatus === "error" && <AlertCircle className="h-4 w-4 text-amber-600" />}
            <span className="text-sm font-medium">
              {ollamaStatus === "checking" && "Checking Ollama..."}
              {ollamaStatus === "running" && "Ollama is running"}
              {ollamaStatus === "not-running" && "Ollama not detected"}
              {ollamaStatus === "error" && "Connection error"}
            </span>
          </div>
          {ollamaStatus === "not-running" && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowInstallHelp(!showInstallHelp)}
              className="text-xs"
            >
              {showInstallHelp ? "Hide" : "Install"} Help
            </Button>
          )}
          {ollamaStatus === "running" && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleRetryCheck}
              className="text-xs"
            >
              Refresh
            </Button>
          )}
        </div>

        {/* Installation Help */}
        {showInstallHelp && ollamaStatus === "not-running" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Install Ollama to use local AI models:
            </p>
            <div className="space-y-1">
              <div className="flex items-start gap-2 text-xs">
                <span className="font-mono bg-background px-1.5 py-0.5 rounded">1.</span>
                <div className="flex-1">
                  Visit{" "}
                  <a 
                    href="https://ollama.ai/download" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    ollama.ai/download
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="font-mono bg-background px-1.5 py-0.5 rounded">2.</span>
                <span>Download and install Ollama for Windows</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="font-mono bg-background px-1.5 py-0.5 rounded">3.</span>
                <span>Restart Ollama or reboot if needed</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="font-mono bg-background px-1.5 py-0.5 rounded">4.</span>
                <span>Click "Refresh" above to detect Ollama</span>
              </div>
            </div>
          </div>
        )}

        {/* Model Status */}
        {ollamaStatus === "running" && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {modelStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {modelStatus === "available" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {modelStatus === "not-available" && <Download className="h-4 w-4 text-amber-600" />}
                {modelStatus === "pulling" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                <span className="text-sm">
                  {modelStatus === "checking" && "Checking models..."}
                  {modelStatus === "available" && `Model ready: ${RECOMMENDED_MODEL}`}
                  {modelStatus === "not-available" && "Recommended model not found"}
                  {modelStatus === "pulling" && "Downloading model..."}
                </span>
              </div>
              {modelStatus === "not-available" && (
                <Button 
                  size="sm" 
                  onClick={handlePullModel}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Pull Model
                </Button>
              )}
            </div>

            {modelStatus === "pulling" && pullProgress && (
              <p className="text-xs text-muted-foreground font-mono">{pullProgress}</p>
            )}

            {availableModels.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {availableModels.length} model{availableModels.length === 1 ? "" : "s"} available
                </summary>
                <ul className="mt-1 ml-4 space-y-0.5 text-muted-foreground font-mono">
                  {availableModels.slice(0, 10).map((model) => (
                    <li key={model}>• {model}</li>
                  ))}
                  {availableModels.length > 10 && (
                    <li>... and {availableModels.length - 10} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <Field label="Agent instructions" hint={instructionsFileHint}>
        <div className="space-y-2">
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full rounded-md border border-border px-2.5 py-1.5 bg-background text-sm outline-none"
          >
            {INSTRUCTION_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          {selectedTemplate === "custom" && (
            <div className="flex items-center gap-2">
              <DraftInput
                value={currentPath}
                onCommit={(v) =>
                  isCreate
                    ? set!({ instructionsFilePath: v })
                    : mark("adapterConfig", "instructionsFilePath", v || undefined)
                }
                immediate
                className={inputClass}
                placeholder="/absolute/path/to/AGENTS.md"
              />
              <ChoosePathButton />
            </div>
          )}
        </div>
      </Field>
      
      <Field label="Ollama base URL" hint={baseUrlHint}>
        <DraftInput
          value={
            isCreate
              ? values!.baseUrl ?? ""
              : eff(
                  "adapterConfig",
                  "baseUrl",
                  String(config.baseUrl ?? ""),
                )
          }
          onCommit={(v) =>
            isCreate
              ? set!({ baseUrl: v })
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://localhost:11434"
        />
      </Field>
    </>
  );
}
