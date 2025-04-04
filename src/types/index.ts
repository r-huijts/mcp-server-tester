import { ToolDefinition as SDKToolDefinition } from '@modelcontextprotocol/sdk';

/**
 * Definition of a test case for an MCP tool
 */
export interface TestCase {
  id: string;
  toolName: string;
  description: string;
  inputs: any;
  expectedOutcome: string;
  validationRules: ValidationRule[];
}

/**
 * Rules for validating the content of a tool response
 */
export interface ValidationRule {
  type: 'contains' | 'matches' | 'hasProperty' | 'custom';
  target?: string;
  value?: any;
  custom?: (response: any) => boolean;
  message: string;
}

/**
 * Result of a test execution
 */
export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  response?: any;
  executionTime?: number;
  validationErrors: string[];
}

/**
 * Result of the validation process
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration for the MCP server tester
 */
export interface TesterConfig {
  servers?: string[];         // Optional: specific servers to test (if not specified, all servers in mcpServers will be tested)
  numTestsPerTool: number;
  timeoutMs: number;
  outputFormat: 'json' | 'console' | 'html';
  outputPath?: string;
  anthropicApiKey?: string;
  verbose: boolean;
}

/**
 * Response from a tool execution
 */
export interface ToolResponse {
  status: 'success' | 'error';
  data?: any;
  error?: {
    message: string;
    code?: string;
  };
}

// Use the SDK's ToolDefinition directly
export { SDKToolDefinition as ToolDefinition };

/**
 * Wrapper for accessing MCP server tools
 */
export interface MCPClientInterface {
  connect(serverPath: string): Promise<void>;
  listTools(): SDKToolDefinition[];
  executeTool(name: string, params: Record<string, any>): Promise<ToolResponse>;
  disconnect(): Promise<void>;
}

/**
 * Generator for test cases
 */
export interface TestGeneratorInterface {
  generateTests(tools: SDKToolDefinition[], config: TesterConfig): Promise<TestCase[]>;
}

/**
 * Validator for tool responses
 */
export interface ResponseValidatorInterface {
  validateResponse(response: ToolResponse, testCase: TestCase): ValidationResult;
}

/**
 * Reporter for test results
 */
export interface ReporterInterface {
  generateReport(results: TestResult[], config: TesterConfig): Promise<void>;
} 