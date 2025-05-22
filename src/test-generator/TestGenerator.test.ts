import { TestGenerator } from './TestGenerator';
import { ToolDefinition, TestCase } from '../types'; // Adjust path if necessary

// Mock the Anthropic SDK if its methods are called directly by TestGenerator's constructor or other methods.
// For now, we are only testing createPrompt and parseResponse which don't directly use this.anthropic
// So, a simple mock for the constructor's apiKey requirement is enough.
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    // Mock any methods from Anthropic SDK that might be called, if necessary
    // For now, TestGenerator constructor just needs an API key.
  })),
}));

describe('TestGenerator', () => {
  let generator: TestGenerator;
  const apiKey = 'test-api-key'; // Dummy API key for constructor

  beforeEach(() => {
    generator = new TestGenerator(apiKey);
  });

  describe('createPrompt', () => {
    const mockTool: ToolDefinition = {
      name: 'getWeather',
      description: 'Fetches the current weather for a given location.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'The city and state, e.g., San Francisco, CA' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: 'Temperature unit' }
        }
      }
    };
    const numTests = 3;

    it('should generate a prompt containing the tool name and description', () => {
      const prompt = generator.createPrompt(mockTool, numTests);
      expect(prompt).toContain('Name: getWeather');
      expect(prompt).toContain('Description: Fetches the current weather for a given location.');
    });

    it('should include stringified input schema properties', () => {
      const prompt = generator.createPrompt(mockTool, numTests);
      expect(prompt).toContain('"location": {');
      expect(prompt).toContain('"type": "string"');
      expect(prompt).toContain('"unit": {');
      expect(prompt).toContain('"enum": [');
    });

    it('should specify the number of tests to generate', () => {
      const prompt = generator.createPrompt(mockTool, numTests);
      expect(prompt).toContain('generate 3 diverse test cases');
    });

    it('should include all key instruction phrases from the new prompt structure', () => {
      const prompt = generator.createPrompt(mockTool, numTests);
      // Key phrases from the updated prompt
      expect(prompt).toContain('Happy Paths:');
      expect(prompt).toContain('Edge Cases:');
      expect(prompt).toContain('Error Cases:');
      expect(prompt).toContain('Combinatorial Tests:');
      expect(prompt).toContain('Realistic Scenarios:');
      expect(prompt).toContain('A brief, descriptive `description`');
      expect(prompt).toContain('`inputs` with realistic and contextually appropriate values');
      expect(prompt).toContain('`validationRules`: An array of rules');
      expect(prompt).toContain('Include `hasProperty` checks');
      expect(prompt).toContain('Use `contains` or `matches`');
      expect(prompt).toContain('type: "arrayLength"');
      expect(prompt).toContain('Output Format');
      expect(prompt).toContain('JSON array of test cases, nothing else');
    });
  });

  describe('parseResponse', () => {
    const toolName = 'testTool';

    it('should parse a valid JSON response with backticks', () => {
      const responseText = '```json\n[{"description":"Test 1","inputs":{"param":"val"},"expectedOutcome":{"status":"success","validationRules":[]}}]\n```';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Test 1');
      expect(tests[0].toolName).toBe(toolName);
      expect(tests[0].expectedOutcome.validationRules).toEqual([]);
    });

    it('should parse a valid JSON response without backticks', () => {
      const responseText = '[{"description":"Test 1","inputs":{"param":"val"},"expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Test 1');
      // validationRules should default to []
      expect(tests[0].expectedOutcome.validationRules).toEqual([]);
    });
    
    it('should handle a single test case object response by wrapping it in an array', () => {
      const responseText = '{"description":"Single test","inputs":{"p":"v"},"expectedOutcome":{"status":"success"}}';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Single test');
    });

    it('should return an empty array for invalid JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const responseText = 'this is not json';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[testTool] Failed to parse JSON from LLM response.'));
      consoleErrorSpy.mockRestore();
    });

    it('should return an empty array if parsed JSON is not an array and not a single test object', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '{"not_a_test_case": true}'; // Valid JSON, but not a TestCase array or single object
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[testTool] Parsed JSON is not an array.'));
      consoleWarnSpy.mockRestore();
    });

    it('should skip test cases with missing description', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"inputs":{},"expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has an invalid 'description'"));
      consoleWarnSpy.mockRestore();
    });
    
    it('should skip test cases with missing inputs', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has invalid 'inputs'"));
      consoleWarnSpy.mockRestore();
    });

    it('should skip test cases with missing expectedOutcome', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","inputs":{}}]';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has invalid 'expectedOutcome'"));
      consoleWarnSpy.mockRestore();
    });
    
    it('should skip test cases with missing or invalid expectedOutcome.status', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","inputs":{},"expectedOutcome":{"validationRules":[]}}]'; // Missing status
      let tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or invalid 'expectedOutcome.status'"));
      
      const responseTextInvalidStatus = '[{"description":"Test","inputs":{},"expectedOutcome":{"status":"invalid"}}]';
      tests = generator.parseResponse(responseTextInvalidStatus, toolName);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or invalid 'expectedOutcome.status'"));
      consoleWarnSpy.mockRestore();
    });

    it('should default validationRules to an empty array if missing or null', () => {
      const responseText1 = '[{"description":"t1","inputs":{},"expectedOutcome":{"status":"success"}}]'; // Missing validationRules
      const tests1 = generator.parseResponse(responseText1, toolName);
      expect(tests1[0].expectedOutcome.validationRules).toEqual([]);

      const responseText2 = '[{"description":"t2","inputs":{},"expectedOutcome":{"status":"error", "validationRules": null}}]'; // null validationRules
      const tests2 = generator.parseResponse(responseText2, toolName);
      expect(tests2[0].expectedOutcome.validationRules).toEqual([]);
    });
    
    it('should keep validationRules if provided and valid', () => {
      const rules = [{ type: 'hasProperty', target: 'data' }];
      const responseText = `[{"description":"t","inputs":{},"expectedOutcome":{"status":"success", "validationRules": ${JSON.stringify(rules)}}}]`;
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests[0].expectedOutcome.validationRules).toEqual(rules);
    });

    it('should correctly parse multiple test cases with mixed validity', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '```json\n' +
      `
        [
          {"description":"Valid Case 1","inputs":{"p1":"v1"},"expectedOutcome":{"status":"success","validationRules":[{"type":"contains","target":"field","value":"abc"}]}},
          {"inputs":{"p2":"v2"},"expectedOutcome":{"status":"error"}}, 
          {"description":"Valid Case 2","inputs":{"p3":"v3"},"expectedOutcome":{"status":"success"}},
          {"description":"Invalid Outcome","inputs":{"p4":"v4"},"expectedOutcome":{}},
          {"description":"Invalid Status","inputs":{"p5":"v5"},"expectedOutcome":{"status":"unknown"}}
        ]
      ` + '\n```';
      const tests = generator.parseResponse(responseText, toolName);
      expect(tests).toHaveLength(2);
      expect(tests[0].description).toBe('Valid Case 1');
      expect(tests[0].expectedOutcome.validationRules).toHaveLength(1);
      expect(tests[1].description).toBe('Valid Case 2');
      expect(tests[1].expectedOutcome.validationRules).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3); // For the three invalid cases
      consoleWarnSpy.mockRestore();
    });
  });
});
