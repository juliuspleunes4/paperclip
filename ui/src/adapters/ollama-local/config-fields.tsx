import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";
import { useState } from "react";

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
  
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    const template = INSTRUCTION_TEMPLATES.find(t => t.path === currentPath);
    return template?.id ?? "custom";
  });

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

  return (
    <>
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
