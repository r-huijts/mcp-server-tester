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
  private model: string = process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';

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

    for (const tool of tools) {
      try {
        console.log(`Generating tests for tool: ${tool.name}`);
        const prompt = this.createPrompt(tool, testsPerTool);
        
        const response = await this.anthropic.completions.create({
          model: this.model,
          max_tokens_to_sample: 4000,
          prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
          temperature: 0.7
        });

        const testCases = this.parseResponse(response.completion, tool.name);
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
   * @param toolName Name of the tool being tested
   */
  parseResponse(responseText: string, toolName: string): TestCase[] {
    let jsonContent = responseText;
    try {
      // Extract JSON content between backticks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1];
      } else {
        // Attempt to gracefully handle cases where the LLM might forget the backticks but still returns valid JSON.
        // If it's not actually JSON, the JSON.parse below will catch it.
        console.warn(`[${toolName}] LLM response did not contain JSON within backticks. Attempting to parse directly.`);
      }
      
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(jsonContent);
      } catch (parseError: any) {
        console.error(`[${toolName}] Failed to parse JSON from LLM response. Error: ${parseError.message}`);
        console.error(`[${toolName}] Raw response text was: ${responseText}`);
        return []; // Return empty if JSON parsing fails
      }

      // Ensure parsedJson is an array
      if (!Array.isArray(parsedJson)) {
        console.warn(`[${toolName}] Parsed JSON is not an array. LLM response might be malformed. Raw response: ${responseText}`);
        // If it's a single object that looks like a test case, wrap it in an array.
        // This is a common LLM mistake.
        if (parsedJson && typeof parsedJson === 'object' && parsedJson.description && parsedJson.inputs && parsedJson.expectedOutcome) {
          console.warn(`[${toolName}] Attempting to recover by wrapping single test case object in an array.`);
          parsedJson = [parsedJson];
        } else {
          return [];
        }
      }
      
      const validTestCases: TestCase[] = [];
      parsedJson.forEach((test: any, index: number) => {
        // Basic validation for essential fields
        if (!test || typeof test !== 'object') {
          console.warn(`[${toolName}] Test case at index ${index} is not a valid object. Skipping.`);
          return;
        }
        if (!test.description || typeof test.description !== 'string') {
          console.warn(`[${toolName}] Test case at index ${index} is missing or has an invalid 'description'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.inputs || typeof test.inputs !== 'object') {
          // Allow for null inputs if that's a valid test case (e.g. a tool that takes no inputs)
          // However, the prompt asks for an inputs object, so null/undefined is more likely an LLM error.
          console.warn(`[${toolName}] Test case "${test.description}" is missing or has invalid 'inputs'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.expectedOutcome || typeof test.expectedOutcome !== 'object') {
          console.warn(`[${toolName}] Test case "${test.description}" is missing or has invalid 'expectedOutcome'. Skipping: ${JSON.stringify(test)}`);
          return;
        }
        if (!test.expectedOutcome.status || (test.expectedOutcome.status !== 'success' && test.expectedOutcome.status !== 'error')) {
          console.warn(`[${toolName}] Test case "${test.description}" has missing or invalid 'expectedOutcome.status'. Skipping: ${JSON.stringify(test)}`);
          return;
        }

        validTestCases.push({
          id: uuidv4(),
          toolName,
          description: test.description,
          naturalLanguageQuery: '', // Placeholder until LLM generates this
          inputs: test.inputs,
          expectedOutcome: {
            status: test.expectedOutcome.status,
            // Ensure validationRules is always an array, even if missing or null from LLM
            validationRules: Array.isArray(test.expectedOutcome.validationRules) ? test.expectedOutcome.validationRules : []
          }
        });
      });
      
      return validTestCases;
    } catch (error: any) { // Catch any other unexpected errors during processing
      console.error(`[${toolName}] Unexpected error in parseResponse: ${error.message}`);
      console.error(`[${toolName}] Response text was: ${responseText}`);
      return [];
    }
  }
} 