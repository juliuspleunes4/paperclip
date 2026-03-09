# Agent Instruction Templates

This directory contains pre-made instruction templates for common agent roles. These templates are used by the Ollama adapter and can be selected when creating new agents.

## Available Templates

### Executive & Leadership

- **[ceo.md](./ceo.md)** - Chief Executive Officer
  - Strategic vision and company direction
  - Leadership and team building
  - Business operations and financial oversight

- **[cto.md](./cto.md)** - Chief Technology Officer
  - Technical strategy and architecture
  - Engineering team leadership
  - Technology decisions and code review

### Product & Management

- **[product-manager.md](./product-manager.md)** - Product Manager
  - Product strategy and roadmap
  - Requirements gathering and prioritization
  - Stakeholder management

### Engineering & Technical

- **[software-engineer.md](./software-engineer.md)** - Software Engineer
  - Feature development and bug fixes
  - Code quality and testing
  - Best practices and documentation

- **[devops-engineer.md](./devops-engineer.md)** - DevOps Engineer
  - Infrastructure management
  - CI/CD pipelines
  - Monitoring and incident response

- **[research-and-development.md](./research-and-development.md)** - Research & Development
  - Technology research and prototyping
  - Feasibility analysis
  - Innovation and experimentation

### Quality & Data

- **[qa-engineer.md](./qa-engineer.md)** - QA Engineer
  - Test planning and automation
  - Bug reporting and quality metrics
  - Release testing

- **[data-scientist.md](./data-scientist.md)** - Data Scientist
  - Data analysis and modeling
  - Machine learning and experimentation
  - Insights communication

## Usage

When creating a new agent with the Ollama adapter:

1. Select **Ollama (local)** as the adapter type
2. In the **Agent instructions** field, choose a template from the dropdown
3. The template path will be automatically populated
4. Or select **"Custom path..."** to provide your own instructions file

## Creating Custom Templates

Templates are markdown files that define:
- Role and responsibilities
- Decision-making authority
- Communication style
- Best practices
- Collaboration guidelines

To add a new template:
1. Create a new `.md` file in this directory
2. Add the template to `ui/src/adapters/ollama-local/config-fields.tsx`
3. Follow the structure of existing templates for consistency

## Template Structure

Each template typically includes:
- **Role description** - Overview of the agent's purpose
- **Responsibilities** - Key duties and tasks
- **Approach/Principles** - Methodologies and guidelines
- **Communication** - How to interact with others
- **Collaboration** - How to work with other agents
- **Best Practices** - Role-specific recommendations

Templates should be comprehensive yet actionable, providing clear guidance without being overly prescriptive.
