import { TestGenerator } from './TestGenerator';
import { ToolDefinition, TestCase } from '../types'; // Adjust path if necessary

import { TestGenerator } from './TestGenerator';
import { ToolDefinition, TestCase, TesterConfig } from '../types'; // Adjust path if necessary

const mockCompletionsCreate = jest.fn().mockResolvedValue({ completion: '[]' }); // Default mock response
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    completions: {
      create: mockCompletionsCreate,
    },
  })),
}));

describe('TestGenerator', () => {
  let generator: TestGenerator;
  const apiKey = 'test-api-key'; // Dummy API key for constructor

  beforeEach(() => {
    generator = new TestGenerator(apiKey);
    mockCompletionsCreate.mockClear(); 
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

  });

  describe('generateTests configuration', () => {
    const mockToolMinimal: ToolDefinition = { name: 'testTool', inputSchema: { type: 'object' } };
    const defaultConfig: TesterConfig = {
      numTestsPerTool: 1,
      timeoutMs: 1000,
      outputFormat: 'json',
      verbose: false,
      // anthropicApiKey will be the one provided to TestGenerator constructor
    };

    it('should use modelName from config if provided', async () => {
      await generator.generateTests([mockToolMinimal], { ...defaultConfig, modelName: 'custom-model-123' });
      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'custom-model-123' }));
    });

    it('should use default model if modelName is not in config', async () => {
      await generator.generateTests([mockToolMinimal], defaultConfig);
      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-3-7-sonnet-20250219' }));
    });
    
    it('should use CLAUDE_MODEL from process.env if modelName is not in config and env is set', async () => {
       process.env.CLAUDE_MODEL = 'env-model-456';
       await generator.generateTests([mockToolMinimal], defaultConfig);
       expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'env-model-456' }));
       delete process.env.CLAUDE_MODEL; // Clean up env var
    });

    it('should use temperature from config if provided', async () => {
      await generator.generateTests([mockToolMinimal], { ...defaultConfig, temperature: 0.99 });
      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.99 }));
    });
    
    it('should use default temperature if temperature is not in config', async () => {
      await generator.generateTests([mockToolMinimal], defaultConfig);
      expect(mockCompletionsCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.7 }));
    });
  });

  describe('parseResponse', () => {
    const mockToolFull: ToolDefinition = {
      name: 'validationTool',
      description: 'A tool to test input validation.',
      inputSchema: {
        type: 'object',
        properties: {
          paramString: { type: 'string' },
          paramNumber: { type: 'number' },
          paramBoolean: { type: 'boolean' },
          paramObject: { type: 'object' },
          paramArray: { type: 'array' },
          paramEnum: { type: 'string', enum: ['A', 'B', 'C'] },
          optionalParam: { type: 'string' }
        },
        required: ['paramString', 'paramNumber', 'paramEnum']
      }
    };

    it('should parse a valid JSON response with backticks', () => {
      const responseText = '```json\n[{"description":"Test 1","inputs":{"paramString":"abc", "paramNumber":123, "paramEnum":"A"},"expectedOutcome":{"status":"success","validationRules":[]}}]\n```';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Test 1');
      expect(tests[0].toolName).toBe(mockToolFull.name);
      expect(tests[0].expectedOutcome.validationRules).toEqual([]);
      expect(tests[0].warnings).toBeUndefined();
    });

    it('should parse a valid JSON response without backticks', () => {
      const responseText = '[{"description":"Test 1","inputs":{"paramString":"abc", "paramNumber":123, "paramEnum":"A"},"expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Test 1');
      expect(tests[0].expectedOutcome.validationRules).toEqual([]);
      expect(tests[0].warnings).toBeUndefined();
    });
    
    it('should handle a single test case object response by wrapping it in an array', () => {
      const responseText = '{"description":"Single test","inputs":{"paramString":"abc", "paramNumber":123, "paramEnum":"A"},"expectedOutcome":{"status":"success"}}';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe('Single test');
      expect(tests[0].warnings).toBeUndefined();
    });

    it('should return an empty array for invalid JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const responseText = 'this is not json';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[${mockToolFull.name}] Failed to parse JSON from LLM response.`));
      consoleErrorSpy.mockRestore();
    });

    it('should return an empty array if parsed JSON is not an array and not a single test object', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '{"not_a_test_case": true}'; // Valid JSON, but not a TestCase array or single object
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[${mockToolFull.name}] Parsed JSON is not an array.`));
      consoleWarnSpy.mockRestore();
    });

    it('should skip test cases with missing description', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"inputs":{},"expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has an invalid 'description'"));
      consoleWarnSpy.mockRestore();
    });
    
    it('should skip test cases with missing inputs', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","expectedOutcome":{"status":"success"}}]';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has invalid 'inputs'"));
      consoleWarnSpy.mockRestore();
    });

    it('should skip test cases with missing expectedOutcome', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","inputs":{}}]';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or has invalid 'expectedOutcome'"));
      consoleWarnSpy.mockRestore();
    });
    
    it('should skip test cases with missing or invalid expectedOutcome.status', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '[{"description":"Test","inputs":{"paramString":"a", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"validationRules":[]}}]'; // Missing status
      let tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or invalid 'expectedOutcome.status'"));
      
      const responseTextInvalidStatus = '[{"description":"Test","inputs":{"paramString":"a", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"invalid"}}]';
      tests = generator.parseResponse(responseTextInvalidStatus, mockToolFull);
      expect(tests).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("missing or invalid 'expectedOutcome.status'"));
      consoleWarnSpy.mockRestore();
    });

    it('should default validationRules to an empty array if missing or null', () => {
      const responseText1 = '[{"description":"t1","inputs":{"paramString":"a", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"success"}}]'; // Missing validationRules
      const tests1 = generator.parseResponse(responseText1, mockToolFull);
      expect(tests1[0].expectedOutcome.validationRules).toEqual([]);

      const responseText2 = '[{"description":"t2","inputs":{"paramString":"a", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"error", "validationRules": null}}]'; // null validationRules
      const tests2 = generator.parseResponse(responseText2, mockToolFull);
      expect(tests2[0].expectedOutcome.validationRules).toEqual([]);
    });
    
    it('should keep validationRules if provided and valid', () => {
      const rules = [{ type: 'hasProperty', target: 'data' }];
      const responseText = `[{"description":"t","inputs":{"paramString":"a", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"success", "validationRules": ${JSON.stringify(rules)}}}]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests[0].expectedOutcome.validationRules).toEqual(rules);
    });

    it('should correctly parse multiple test cases with mixed validity', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const responseText = '```json\n' +
      `
        [
          {"description":"Valid Case 1","inputs":{"paramString":"s", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"success","validationRules":[{"type":"contains","target":"field","value":"abc"}]}},
          {"inputs":{"paramString":"s", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"error"}}, 
          {"description":"Valid Case 2","inputs":{"paramString":"s", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"success"}},
          {"description":"Invalid Outcome","inputs":{"paramString":"s", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{}},
          {"description":"Invalid Status","inputs":{"paramString":"s", "paramNumber":1, "paramEnum":"A"},"expectedOutcome":{"status":"unknown"}}
        ]
      ` + '\n```';
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(2);
      expect(tests[0].description).toBe('Valid Case 1');
      expect(tests[0].expectedOutcome.validationRules).toHaveLength(1);
      expect(tests[1].description).toBe('Valid Case 2');
      expect(tests[1].expectedOutcome.validationRules).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3); // For the three invalid cases
      consoleWarnSpy.mockRestore();
    });

    // New tests for input validation warnings
    it('should generate warnings for missing required parameters in a success test', () => {
      const responseText = `[
        {
          "description": "Test missing required param",
          "inputs": { "paramNumber": 123, "paramEnum": "A" }, 
          "expectedOutcome": { "status": "success" }
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].warnings).toBeDefined();
      expect(tests[0].warnings).toContain("Missing required input parameter: 'paramString'.");
      expect(tests[0].description).toBe("Test missing required param"); 
    });
 
    it('should generate warnings for type mismatch in a success test', () => {
      const responseText = `[
        {
          "description": "Test type mismatch",
          "inputs": { "paramString": 123, "paramNumber": 456, "paramEnum": "A" },
          "expectedOutcome": { "status": "success" }
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].warnings).toBeDefined();
      expect(tests[0].warnings).toContain("Input 'paramString' type mismatch: Expected string, got number.");
    });

    it('should generate warnings for invalid enum value in a success test', () => {
      const responseText = `[
        {
          "description": "Test invalid enum",
          "inputs": { "paramString": "abc", "paramNumber": 123, "paramEnum": "D" },
          "expectedOutcome": { "status": "success" }
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].warnings).toBeDefined();
      expect(tests[0].warnings).toContain("Input 'paramEnum' value 'D' is not in the allowed enum values: [A, B, C].");
    });

    it('should generate warnings for extra parameter not in schema in a success test', () => {
      const responseText = `[
        {
          "description": "Test extra parameter",
          "inputs": { "paramString": "abc", "paramNumber": 123, "paramEnum": "A", "extraParam": "xyz" },
          "expectedOutcome": { "status": "success" }
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].warnings).toBeDefined();
      expect(tests[0].warnings).toContain("Input parameter 'extraParam' is not defined in the tool's input schema.");
    });

    it('should NOT generate input validation warnings for error test cases', () => {
      const responseText = `[
        {
          "description": "Error test with technically invalid input",
          "inputs": { "paramString": 123 }, 
          "expectedOutcome": { "status": "error" } 
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].warnings).toBeUndefined();
    });

    it('should include test cases even if they have input validation warnings', () => {
        const responseText = `[
        {
          "description": "Test with warning",
          "inputs": { "paramString": 123, "paramNumber": 456, "paramEnum": "A" }, // Type mismatch
          "expectedOutcome": { "status": "success" }
        }
      ]`;
      const tests = generator.parseResponse(responseText, mockToolFull);
      expect(tests).toHaveLength(1);
      expect(tests[0].description).toBe("Test with warning");
      expect(tests[0].warnings).toBeDefined();
      expect(tests[0].warnings).toContain("Input 'paramString' type mismatch: Expected string, got number.");
    });
  });
});
