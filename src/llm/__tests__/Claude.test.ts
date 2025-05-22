import { Claude } from '../Claude';
import { ToolDefinition } from '../../types';

const createMock = jest.fn().mockResolvedValue({ completion: 'some query' });

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    completions: { create: createMock }
  }))
}));

describe('Claude', () => {
  const apiKey = 'key';
  const tool: ToolDefinition = {
    name: 'testTool',
    description: 'desc',
    inputSchema: { type: 'object', properties: {} }
  };

  beforeEach(() => {
    createMock.mockClear();
  });

  test('generateNaturalLanguageQuery returns completion', async () => {
    const claude = new Claude(apiKey);
    const query = await claude.generateNaturalLanguageQuery(tool);
    expect(createMock).toHaveBeenCalled();
    expect(query).toBe('some query');
  });

  test('returns empty string on failure', async () => {
    createMock.mockRejectedValueOnce(new Error('fail'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const claude = new Claude(apiKey);
    const query = await claude.generateNaturalLanguageQuery(tool);
    expect(query).toBe('');
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
