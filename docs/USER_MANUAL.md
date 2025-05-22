# MCP Server Tester User Manual

This manual introduces the concept, purpose, and day-to-day usage of the **MCP Server Tester**. The tool helps you validate Model Context Protocol (MCP) servers and ensure that their tools behave as expected when used by AI models.

---

## 1. Concept

The Model Context Protocol is a standard that allows AI models to call external tools. An *MCP server* exposes one or more tools through a simple HTTP interface. Each tool describes its name, parameters, and response schema so that a model can invoke it safely.

`mcp-server-tester` automates the process of checking that an MCP server and its tools work correctly:

1. **Discovery** – it queries the server for all available tools.
2. **Test generation** – it uses Claude AI to create realistic test cases for each tool.
3. **Execution** – it runs those tests against the server.
4. **Validation** – it verifies the responses using configurable rules.
5. **Reporting** – it summarizes the results in the console or in JSON, HTML, or Markdown formats.

The goal is to quickly spot mismatches between expected and actual behaviour so that you can fix issues before exposing the tools to production models.

## 2. Purpose

- **Reliability** – catch bugs or inconsistent behaviour in your MCP server.
- **Regression testing** – run the same set of tests whenever the server changes.
- **Documentation** – generated reports describe the queries and expected outcomes for each tool.
- **Automation** – integrate the tester into CI pipelines to ensure ongoing quality.

## 3. Installation

1. Install Node.js 18 or newer.
2. Clone the repository and install dependencies:

```bash
git clone https://github.com/r-huijts/mcp-server-tester.git
cd mcp-server-tester
npm install
npm run build
```

3. Optionally link the package globally so the `mcp-server-tester` command is available system-wide:

```bash
npm link
```

## 4. Configuration

All behaviour is controlled by a JSON configuration file (by default `mcp-servers.json`). The configuration lists which MCP servers to test and defines options such as timeouts and report formats.

Create the file with `--init` or copy the provided example:

```bash
mcp-server-tester --init
# or
cp mcp-servers.json.example mcp-servers.json
```

Edit the file to add your servers. A minimal example looks like:

```json
{
  "numTestsPerTool": 2,
  "timeoutMs": 10000,
  "outputFormat": "console",
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"],
      "env": { "DEBUG": "true" }
    }
  }
}
```

Place your Anthropic API key in a `.env` file or export it as `ANTHROPIC_API_KEY`:

```
ANTHROPIC_API_KEY=your-api-key
```

## 5. Running Tests

With the configuration and environment variables in place, run:

```bash
mcp-server-tester
```

Use `mcp-server-tester path/to/config.json` to specify a different configuration or `--servers filesystem,github` to test only certain servers.

## 6. Understanding Results

By default, results appear in the console. You can also generate structured reports:

- **JSON** – machine readable data for further processing.
- **HTML** – easy to browse summary with collapsible sections.
- **Markdown** – shareable format suitable for code reviews.

The report lists each tool, the natural language query used to invoke it, whether the response met the validation rules, and details on any failures.

## 7. Troubleshooting

- **Connection issues** – verify the server paths and increase `timeoutMs` if needed.
- **API key problems** – make sure `ANTHROPIC_API_KEY` is set with no extra spaces.
- **Tool failures** – inspect server logs and ensure your implementation follows the MCP specification.

For more information see the `Troubleshooting` section of the main README.

---

This user manual complements the main `README.md`, which contains additional examples and development instructions. For contribution guidelines see `CONTRIBUTING.md`.
