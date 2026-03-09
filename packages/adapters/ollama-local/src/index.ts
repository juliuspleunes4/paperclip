export const type = "ollama_local";
export const label = "Ollama (local)";

export const models = [
  { id: "qwen2.5:14b-instruct-q6_K", label: "Qwen 2.5 14B Instruct" },
  { id: "hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q5_K_M", label: "Qwen3 Coder 30B" },
];

export const agentConfigurationDoc = `# ollama_local agent configuration

Adapter: ollama_local

Core fields:
- cwd (string, optional): default absolute working directory for the agent process
- instructionsFilePath (string, optional): absolute path to a markdown instructions file
- model (string, optional): Ollama model name (defaults to first available model)
- baseUrl (string, optional): Ollama API base URL (defaults to http://localhost:11434)
- temperature (number, optional): sampling temperature (0.0-2.0, default: 0.7)
- maxTokens (number, optional): maximum tokens to generate
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (default: 600)
- graceSec (number, optional): graceful shutdown period in seconds (default: 30)
- preload (boolean, optional): preload model into memory before first request (default: true)

Inheritance:
- When an ollama_local agent creates a new agent, the child agent automatically inherits ollama_local as its adapter type (unless explicitly specified otherwise)
- Ollama configuration (baseUrl, temperature, preload, etc.) is also inherited from the parent agent
- This ensures consistent local AI infrastructure across your agent hierarchy
`;
