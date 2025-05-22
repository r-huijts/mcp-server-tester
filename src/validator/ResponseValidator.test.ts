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
});
