# MCP Server Tester

> **⚠️ WORK IN PROGRESS**: This project is under active development and has not been thoroughly tested yet. Features may be incomplete, contain bugs, or change significantly. Use at your own risk in non-production environments only.

A powerful, configuration-driven testing tool for Model Context Protocol (MCP) servers. This project provides a comprehensive solution for validating, benchmarking, and ensuring reliability of MCP servers that integrate with AI models like Claude.

## Current Status

This tool is moving toward an alpha release and currently offers:
- ✅ Basic configuration framework
- ✅ MCP server connection and CLI support
- ✅ Test generation using Claude AI
- ✅ Natural language query generation for tests
- ✅ Comprehensive response validation with multiple rules
- ✅ Report generation in console, JSON, HTML, and Markdown formats
- 🚧 Broader automated test coverage of the tester
- 🚧 Production hardening and packaging improvements

If you're interested in contributing, please feel free to open issues and submit pull requests.

## Introduction

The Model Context Protocol (MCP) enables AI models to access external tools and data sources through standardized interfaces. As MCP servers grow in complexity and importance, ensuring their correct functionality becomes critical. The MCP Server Tester addresses this need by:

- **Automating tests** for all tools exposed by an MCP server
- **Leveraging Claude AI** to generate intelligent, contextually-relevant test cases
- **Validating responses** against expected outcomes and schemas
- **Providing detailed reports** to identify issues and performance bottlenecks

This tool is designed for MCP server developers, AI integration teams, and quality assurance professionals who need to ensure their MCP implementations are robust, reliable, and correctly follow the protocol specifications.
For a step-by-step user guide see [docs/USER_MANUAL.md](docs/USER_MANUAL.md).

## Repository

- **GitHub**: [https://github.com/r-huijts/mcp-server-tester](https://github.com/r-huijts/mcp-server-tester)
- **Issues**: [https://github.com/r-huijts/mcp-server-tester/issues](https://github.com/r-huijts/mcp-server-tester/issues)
- **License**: [MIT](LICENSE)

## Features

- 🔍 Automatically discovers available tools from any MCP server
- 🧪 Generates realistic test cases for each tool using Claude AI
- ⚡ Executes tests and validates responses
- 📊 Provides detailed test reports
- 🔑 Supports multiple connection methods through configuration
- **Configuration-Based**: Simple JSON configuration for defining MCP servers to test
- **Multiple Server Support**: Test multiple MCP servers at once
- **Comprehensive Testing**: Tests all tools exposed by each server
- **Natural Language Context**: Includes the user query that would trigger each tool, providing real-world context
- **Detailed Reports**: Generate reports in console, JSON, HTML, or Markdown formats
- **Secure**: Keeps API keys in environment variables, not in configuration files

## Prerequisites

- Node.js 18 or higher
- An Anthropic API key for generating test cases

## Installation

Since this project is still in development, installation is done by cloning the repository:

```bash
# Clone the repository
git clone https://github.com/r-huijts/mcp-server-tester.git
cd mcp-server-tester

# Install dependencies
npm install

# Build the project
npm run build

# Create a symbolic link to use it globally (optional)
npm link
```

## Configuration-Based Usage

The MCP Server Tester is designed to be driven entirely through configuration files. This approach offers several advantages:

- **Reusability**: Define your servers once, test them repeatedly
- **Version control**: Check in your test configurations alongside your code
- **Sharing**: Easily share server test configurations with team members

### Basic Usage

```bash
# Create a .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env

# Run tests using the configuration
mcp-server-tester

# Use a custom configuration file
mcp-server-tester path/to/my-config.json
```

### Configuration File Structure

The configuration file (`mcp-servers.json`) controls all aspects of testing:

```json
{
  "numTestsPerTool": 3,
  "timeoutMs": 10000,
  "outputFormat": "console",
  "outputPath": "./reports/results.json",
  "verbose": false,
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"],
      "env": {
        "DEBUG": "true"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token-here"
      }
    },
    "dev-server": {
      "command": "node",
      "args": ["/absolute/path/to/your/dev-server.js"],
      "env": {
        "DEBUG": "true",
        "NODE_ENV": "development"
      }
    }
  }
}
```

By default, the tool will test all servers defined in the `mcpServers` section. If you want to test only specific servers, you can add an optional `servers` array:

```json
{
  "servers": ["filesystem", "dev-server"],
  "numTestsPerTool": 3,
  // other settings...
  "mcpServers": {
    // server definitions...
  }
}
```

### Configuration Options

#### Test Settings

| Option | Description | Default |
|--------|-------------|---------|
| `servers` | Optional array of specific server names to test | All servers in `mcpServers` |
| `numTestsPerTool` | Number of tests to generate per tool | 3 |
| `timeoutMs` | Timeout for test execution in milliseconds | 10000 |
| `outputFormat` | Format for test reports (`json`, `console`, `html`, `markdown`) | "console" |
| `outputPath` | Path to output file | undefined |
| `verbose` | Enable verbose logging | false |

#### Server Definitions

The `mcpServers` section defines all available servers that can be tested:

| Property | Description | Required |
|----------|-------------|----------|
| `command` | Executable or command to run | Yes |
| `args` | Array of command-line arguments | Yes |
| `env` | Environment variables to set | Yes |

### Server Connection Types

You can define various types of MCP servers in your configuration:

#### NPM Package

```json
"npm-package": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {}
}
```

#### Local Script with Relative Path

```json
"python-script": {
  "command": "python",
  "args": ["./servers/custom_server.py"],
  "env": {
    "PORT": "8080"
  }
}
```

#### Local Script with Absolute Path

Useful for testing development versions of servers:

```json
"dev-server": {
  "command": "node",
  "args": ["/absolute/path/to/your/dev-server.js"],
  "env": {
    "DEBUG": "true",
    "NODE_ENV": "development"
  }
}
```

#### Socket Connection

```json
"remote-socket": {
  "command": "nc",
  "args": ["localhost", "3000"],
  "env": {}
}
```

## API Key Management

For security reasons, your Anthropic API key should only be set in one of these ways:

1. Environment variable: `ANTHROPIC_API_KEY=your-api-key`
2. `.env` file in your project directory:
   ```
   ANTHROPIC_API_KEY=your-api-key
   ```
3. Optionally set the Claude model:
   ```
   CLAUDE_MODEL=claude-3-opus
   ```
   If not provided, the tool defaults to `claude-3-7-sonnet-20250219`.

**Important**: Never put your API key in the configuration file, as it may be committed to version control.

## Command-Line Options

MCP Server Tester supports minimal command-line options:

| Option | Description |
|--------|-------------|
| `--init` or `-i` | Create a default configuration file |
| `--list` or `-l` | List all servers defined in your configuration |
| `--help` or `-h` | Display help information |
| `--servers` or `-s` | Comma-separated list of servers to test |
| `[config-path]` | Specify a custom configuration file path |

The `--servers` option overrides the `servers` array in your configuration file.

## Test Generation Process

The tool uses Claude AI to automatically generate appropriate test cases for each tool exposed by the MCP server:

1. It discovers all available tools from the server
2. For each tool, it analyzes:
   - Tool name and description
   - Required and optional parameters
   - Parameter types and constraints
3. Claude generates multiple test cases per tool:
   - Happy path tests with valid inputs
   - Edge case tests with boundary values
   - Error case tests with invalid inputs

Each test case includes:
- Description of what's being tested
- Input parameters
- Expected outcome criteria

### Validation Rule Types

Validation rules are used to check the structure and content of a tool response.
The following rule types are supported:

- `contains` – ensure a string or array contains a given value
- `matches` – check equality or a regular expression match
- `hasProperty` – verify that a property exists
- `equals` – assert that a value exactly matches the expected value
- `arrayLength` – require an array to have a specific length
- `custom` – invoke a user-defined validation function

## Test Execution and Validation

For each server specified in the configuration (or all servers if none specified):

1. The tool connects to the server
2. It discovers all available tools
3. It generates test cases for each tool
4. It executes each test case against the server
5. It validates the responses against expected outcomes
6. It generates a report of the results

## Reporting Options

The tool can generate reports in multiple formats, controlled by the `outputFormat` configuration option:

### Console Output (Default)

Displays test results directly in the terminal.

### JSON Report

Creates a structured JSON file at the path specified in `outputPath`.

### HTML Report

Generates an HTML report with visualizations at the path specified in `outputPath`.

### Markdown Report

Creates a portable Markdown file at the path specified in `outputPath`.

## Complete Examples

### Basic Setup and Testing

1. Create a default configuration file:
   ```bash
   mcp-server-tester --init
   ```

2. Edit the `mcp-servers.json` file to add your own servers and settings

3. Create a `.env` file with your Anthropic API key:
   ```bash
   echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
   ```

4. Run the tests:
   ```bash
   mcp-server-tester
   ```

### Testing a Dev Version of Your Server

To test a development version of your MCP server:

1. Add a configuration for your development server with the absolute path:

```json
{
  "mcpServers": {
    "my-dev-server": {
      "command": "node",
      "args": ["/path/to/your/project/dist/server.js"],
      "env": {
        "DEBUG": "true",
        "NODE_ENV": "development"
      }
    }
  }
}
```

2. Run the tests:
```bash
mcp-server-tester
```

### Testing Multiple Different Configurations

You can maintain different configuration files for different testing scenarios:

```bash
# Create different config files for different environments
cp mcp-servers.json config-dev.json
cp mcp-servers.json config-prod.json

# Edit each file with appropriate settings

# Run tests with specific config
mcp-server-tester ./config-dev.json
mcp-server-tester ./config-prod.json
```

## Troubleshooting

### Connection Issues

If you're having trouble connecting to an MCP server:

1. Verify the server configuration in your `mcp-servers.json` file
2. Check if the server supports the MCP protocol
3. Try increasing the `timeoutMs` for slower servers
4. Enable verbose logging by setting `verbose: true`
5. Check server process startup with environment variable `DEBUG=true`

### API Key Issues

If you encounter API key issues:

1. Verify your Anthropic API key is valid
2. Make sure the API key is correctly set in your environment or .env file
3. Check for any spaces or extra characters in your API key
4. Confirm that the .env file is in the correct location (project root)

### Tool Execution Failures

If tool executions are failing:

1. Ensure your server implements the MCP protocol correctly
2. Check the server logs for errors
3. Verify the tool parameters are valid
4. Increase the timeout if the tool takes longer to execute

### Node.js Deprecation Warnings

#### `punycode` Module Deprecation Warning

If you encounter this warning:

```
(node:71439) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```

This is a harmless warning from Node.js about an internal module being deprecated. It doesn't affect the functionality of the MCP Server Tester. The warning comes from one of the dependencies and will be resolved in future updates.

**Solutions:**

1. **Ignore the warning** - It doesn't affect functionality
2. **Suppress warnings** - Run with the `NODE_NO_WARNINGS=1` environment variable:
   ```bash
   NODE_NO_WARNINGS=1 mcp-server-tester
   ```
3. **Use the npm scripts** - The included npm scripts already suppress these warnings:
   ```bash
   npm start
   ```

## Development

To set up the development environment:

```bash
# Clone the repository
git clone https://github.com/r-huijts/mcp-server-tester.git
cd mcp-server-tester

# Install dependencies (including dev dependencies)
npm install
# Run the Jest test suite
npm test
# Lint the code for style issues
npm run lint

# Create your .env file
cp .env.example .env
# Edit .env and add your API key

# Run the tool in development mode
npm run dev
```

### Code Structure

The canonical test generator lives at `src/test-generator/TestGenerator.ts`.
Older files such as `src/generator/TestGenerator.ts` have been removed to avoid
confusion. All imports should reference the module under `src/test-generator/`.

## Packaging and Distribution

The project can be published as an npm package for easier installation.

```bash
# Compile TypeScript sources
npm run build

# Create a tarball of the package
npm pack

# Publish to npm (requires npm credentials)
npm publish
```

Only the contents of the `dist` folder and essential documentation are included
in the published package. The build step runs automatically when `npm publish`
is executed.

## License

This project is licensed under the [MIT](LICENSE) license.
