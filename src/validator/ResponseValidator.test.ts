import { ResponseValidator } from './ResponseValidator';
import { TestCase, ToolResponse } from '../types';

describe('ResponseValidator', () => {
  const validator = new ResponseValidator();

  test('validates successful response with rules', () => {
    const testCase: TestCase = {
      id: '1',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'success',
        validationRules: [
          { type: 'hasProperty', target: 'foo', message: 'missing foo' }
        ]
      }
    };

    const response: ToolResponse = { status: 'success', data: { foo: 'bar' } };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('fails when success expected but error returned', () => {
    const testCase: TestCase = {
      id: '1',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: { status: 'success' }
    };

    const response: ToolResponse = { status: 'error', error: { message: 'oops' } };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch('Tool execution failed');
  });

  test('validates expected error', () => {
    const testCase: TestCase = {
      id: '1',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'error',
        validationRules: [
          { type: 'matches', target: 'error.message', value: 'fail', message: 'msg' }
        ]
      }
    };

    const response: ToolResponse = { status: 'error', error: { message: 'fail' } };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(true);
  });

  test('fails when error expected but success returned', () => {
    const testCase: TestCase = {
      id: '1',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: { status: 'error' }
    };

    const response: ToolResponse = { status: 'success', data: {} };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch('Expected tool to return an error');
  });

  test('validates equals rule', () => {
    const testCase: TestCase = {
      id: '2',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'success',
        validationRules: [
          { type: 'equals', target: 'foo', value: 42, message: 'foo should equal 42' }
        ]
      }
    };

    const response: ToolResponse = { status: 'success', data: { foo: 42 } };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(true);
  });

  test('validates arrayLength rule', () => {
    const testCase: TestCase = {
      id: '3',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'success',
        validationRules: [
          { type: 'arrayLength', target: 'items', value: 3, message: 'items length should be 3' }
        ]
      }
    };

    const response: ToolResponse = { status: 'success', data: { items: [1, 2, 3] } };
    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(true);
  });

  test('executes custom validation rule and handles its result', () => {
    const customFn = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

    const baseTestCase: TestCase = {
      id: '4',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'success',
        validationRules: [
          { type: 'custom', custom: customFn, message: 'custom failed' }
        ]
      }
    };

    const response: ToolResponse = { status: 'success', data: { foo: 'bar' } };

    // First run: custom rule returns true
    let result = validator.validateResponse(response, baseTestCase);
    expect(customFn).toHaveBeenCalledWith(response.data);
    expect(result.valid).toBe(true);

    // Second run: custom rule returns false
    result = validator.validateResponse(response, baseTestCase);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('custom failed');
  });

  test('validate hasProperty with bracket path', () => {
    const testCase: TestCase = {
      id: '5',
      toolName: 'test',
      description: 'desc',
      naturalLanguageQuery: '',
      inputs: {},
      expectedOutcome: {
        status: 'success',
        validationRules: [
          { type: 'hasProperty', target: 'items[0].id', message: 'missing id' }
        ]
      }
    };

    const response: ToolResponse = {
      status: 'success',
      data: { items: [{ id: 1 }, { id: 2 }] }
    };

    const result = validator.validateResponse(response, testCase);
    expect(result.valid).toBe(true);
  });
});
