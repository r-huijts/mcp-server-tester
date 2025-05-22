import { Anthropic } from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { 
  TestGeneratorInterface,
  ToolDefinition,
  TestCase,
  TesterConfig
} from '../types';

/**
 * Generator for test cases using Claude
 */
export class TestGenerator implements TestGeneratorInterface {
  private anthropic: Anthropic;

  /**
   * Create a new test generator
   * @param apiKey Anthropic API key
   */
  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate test cases for the given tools
   * @param tools Tool definitions to generate tests for
   * @param config Tester configuration
   */
  async generateTests(tools: ToolDefinition[], config: TesterConfig): Promise<TestCase[]> {
    const allTests: TestCase[] = [];
    const testsPerTool = config.numTestsPerTool || 3;
    const currentModel = config.modelName || process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';
    const currentTemperature = config.temperature !== undefined ? config.temperature : 0.7;

    for (const tool of tools) {
      try {
        console.log(`Generating tests for tool: ${tool.name}`);
        const prompt = this.createPrompt(tool, testsPerTool);
        
        const response = await this.anthropic.completions.create({
          model: currentModel,
          max_tokens_to_sample: 4000,
          prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
          temperature: currentTemperature
        });

        const testCases = this.parseResponse(response.completion, tool);
        allTests.push(...testCases);
        
        console.log(`Generated ${testCases.length} tests for ${tool.name}`);
      } catch (error) {
        console.error(`Error generating tests for tool ${tool.name}:`, error);
      }
    }

    return allTests;
  }

  /**
   * Create a prompt for Claude to generate test cases
   * @param tool Tool definition to generate tests for
   * @param testsPerTool Number of tests to generate per tool
   */
  createPrompt(tool: ToolDefinition, testsPerTool: number): string {
    return `
You are an expert in generating test cases for APIs. I'm providing you with a tool definition from an MCP (Model Context Protocol) server, and I need you to generate ${testsPerTool} diverse test cases for it.

## Tool Definition
Name: ${tool.name}
Description: ${tool.description}
Parameters: ${JSON.stringify(tool.inputSchema?.properties, null, 2)}

## Instructions
1. Generate ${testsPerTool} diverse test cases. Aim for a mix of scenarios:
   - **Happy Paths:** Valid inputs demonstrating core functionality.
   - **Edge Cases:** Boundary values (e.g., min/max for numbers, empty/long strings, empty/large arrays), special characters, and different but valid data types for parameters if applicable (e.g., a parameter defined as 'string' being tested with purely numeric strings, or boolean-like strings like "true", "false").
   - **Error Cases:** Invalid inputs (e.g., incorrect data types, out-of-range values), missing required parameters, or too many parameters.
   - **Combinatorial Tests:** If the tool has multiple optional parameters, include some tests that explore different combinations of these parameters being present or absent.
   - **Realistic Scenarios:** Design tests that reflect how a user might realistically interact with the tool.

2. For each test case, provide:
   - A brief, descriptive \`description\` of what the test is checking and why it's valuable.
   - \`inputs\` with realistic and contextually appropriate values. For parameters with no explicit type (e.g. 'any' or not defined), try generating tests with various pertinent types (string, number, boolean, simple object, array).
   - \`expectedOutcome\`:
     - \`status\`: "success" or "error".
     - \`validationRules\`: An array of rules to check the response. These are crucial.
       - For **successful** outcomes:
         - Include \`hasProperty\` checks for all significant top-level fields expected in the response.
         - Use \`contains\` or \`matches\` (with a regex) for specific values when the exact value is predictable and important.
         - If the response is an array, consider checks for array length (\`type: "arrayLength", target: "path.to.array", value: expectedLength\`).
       - For **error** outcomes:
         - Specify validation rules that check for appropriate error messages or error codes, if the API defines them. For example, \`type: "equals", target: "error.message", value: "Invalid input."\`.
       - Each validation rule should have a \`type\` (e.g., "contains", "matches", "hasProperty", "equals", "arrayLength"), a \`target\` (JSONPath to the property in the response, e.g., "data.userId" or "error.code"), the \`value\` to check against, and a helpful \`message\` for when validation fails.

## Output Format
Provide the test cases in the following JSON format. Ensure the JSON is well-formed.
` + '```json' + `
[
  {
    "description": "Test case description",
    "inputs": { /* ... parameters ... */ },
    "expectedOutcome": {
      "status": "success|error",
      "validationRules": [
        {
          "type": "hasProperty", 
          "target": "data.fieldName", 
          "message": "Response should have data.fieldName"
        },
        {
          "type": "matches", 
          "target": "data.status", 
          "value": "^(completed|pending)$", 
          "message": "Status should be completed or pending"
        }
        // ... other rules
      ]
    }
  }
  // ... more test cases
]
` + '```' + `

Please return ONLY the JSON array of test cases, nothing else.
`;
  }

  /**
   * Parse Claude's response into test cases
   * @param responseText Claude's response text
   * @param tool ToolDefinition object
   */
  parseResponse(responseText: string, tool: ToolDefinition): TestCase[] {
    let jsonContent = responseText;
    try {
      // Extract JSON content between backticks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1];
      } else {
        // Attempt to gracefully handle cases where the LLM might forget the backticks but still returns valid JSON.
        // If it's not actually JSON, the JSON.parse below will catch it.
        console.warn(`[${tool.name}] LLM response did not contain JSON within backticks. Attempting to parse directly.`);
      }
      
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(jsonContent);
      } catch (parseError: any) {
        console.error(`[${tool.name}] Failed to parse JSON from LLM response. Error: ${parseError.message}`);
        console.error(`[${tool.name}] Raw response text was: ${responseText}`);
        return []; // Return empty if JSON parsing fails
      }

      // Ensure parsedJson is an array
      if (!Array.isArray(parsedJson)) {
        console.warn(`[${tool.name}] Parsed JSON is not an array. LLM response might be malformed. Raw response: ${responseText}`);
        // If it's a single object that looks like a test case, wrap it in an array.
        // This is a common LLM mistake.
        if (parsedJson && typeof parsedJson === 'object' && parsedJson.description && parsedJson.inputs && parsedJson.expectedOutcome) {
          console.warn(`[${tool.name}] Attempting to recover by wrapping single test case object in an array.`);
          parsedJson = [parsedJson];
        } else {
          return [];
        }
      }
      
      const validTestCases: TestCase[] = [];
      parsedJson.forEach((test: any, index: number) => {
        // Basic validation for essential fields
        if (!test || typeof test !== 'object') {
          console.warn(`[${tool.name}] Test case at index ${index} is not a valid object. Skipping.`);
          return;
        }
        if (!test.description || typeof test.description !== 'string') {
          console.warn(`[${tool.name}] Test case at index ${index} is missing or has an invalid 'description'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.inputs || typeof test.inputs !== 'object') {
          console.warn(`[${tool.name}] Test case "${test.description}" is missing or has invalid 'inputs'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.expectedOutcome || typeof test.expectedOutcome !== 'object') {
          console.warn(`[${tool.name}] Test case "${test.description}" is missing or has invalid 'expectedOutcome'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.expectedOutcome.status || (test.expectedOutcome.status !== 'success' && test.expectedOutcome.status !== 'error')) {
          console.warn(`[${tool.name}] Test case "${test.description}" has missing or invalid 'expectedOutcome.status'. Skipping: ${JSON.stringify(test)}`);
          return;
        }

        const newTestCase: TestCase = {
          id: uuidv4(),
          toolName: tool.name,
          description: test.description,
          naturalLanguageQuery: '', // Placeholder until LLM generates this
          inputs: test.inputs,
          expectedOutcome: {
            status: test.expectedOutcome.status,
            validationRules: Array.isArray(test.expectedOutcome.validationRules) ? test.expectedOutcome.validationRules : []
          }
          // warnings will be added below if applicable
        };

        if (newTestCase.expectedOutcome.status === 'success') {
          const validationResult = this.validateTestInputs(newTestCase, tool);
          if (validationResult.warnings && validationResult.warnings.length > 0) {
            newTestCase.warnings = validationResult.warnings;
          }
        }
        validTestCases.push(newTestCase);
      });
      
      return validTestCases;
    } catch (error: any) { // Catch any other unexpected errors during processing
      console.error(`[${tool.name}] Unexpected error in parseResponse: ${error.message}`);
      console.error(`[${tool.name}] Response text was: ${responseText}`);
      return [];
    }
  }

  private validateTestInputs(testCase: TestCase, tool: ToolDefinition): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isValid = true;

    if (!tool.inputSchema || !tool.inputSchema.properties) {
      // No schema to validate against, so consider it valid but maybe log a different kind of warning elsewhere if schema is expected.
      return { isValid: true, warnings: [] };
    }

    const schemaProperties = tool.inputSchema.properties;
    const requiredParameters: string[] = tool.inputSchema.required || [];

    // Check for missing required parameters
    for (const requiredParam of requiredParameters) {
      if (!(requiredParam in testCase.inputs)) {
        isValid = false;
        warnings.push(`Missing required input parameter: '${requiredParam}'.`);
      }
    }

    // Validate provided inputs
    for (const inputName in testCase.inputs) {
      const inputValue = testCase.inputs[inputName];
      const schemaProperty = schemaProperties[inputName];

      if (!schemaProperty) {
        warnings.push(`Input parameter '${inputName}' is not defined in the tool's input schema.`);
        // isValid might be set to false or this could just be a warning, depending on strictness.
        // For now, let's consider it just a warning if it's an extra parameter.
        continue;
      }

      const expectedType = schemaProperty.type;
      const actualType = typeof inputValue;

      // Type Checking
      if (expectedType === 'string' && actualType !== 'string') {
        isValid = false;
        warnings.push(`Input '${inputName}' type mismatch: Expected string, got ${actualType}.`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        isValid = false;
        warnings.push(`Input '${inputName}' type mismatch: Expected number, got ${actualType}.`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        isValid = false;
        warnings.push(`Input '${inputName}' type mismatch: Expected boolean, got ${actualType}.`);
      } else if (expectedType === 'object') {
        if (actualType !== 'object' || Array.isArray(inputValue)) {
          isValid = false;
          warnings.push(`Input '${inputName}' type mismatch: Expected object, got ${Array.isArray(inputValue) ? 'array' : actualType}.`);
        }
      } else if (expectedType === 'array') {
        if (!Array.isArray(inputValue)) {
          isValid = false;
          warnings.push(`Input '${inputName}' type mismatch: Expected array, got ${actualType}.`);
        }
      }
      // Note: This doesn't recursively validate items in arrays or properties of objects yet.

      // Enum Checking
      if (schemaProperty.enum && Array.isArray(schemaProperty.enum)) {
        if (!schemaProperty.enum.includes(inputValue)) {
          isValid = false;
          warnings.push(`Input '${inputName}' value '${inputValue}' is not in the allowed enum values: [${schemaProperty.enum.join(', ')}].`);
        }
      }
    }

    return { isValid, warnings };
  }
} 