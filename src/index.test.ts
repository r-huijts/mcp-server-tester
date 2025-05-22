import fs from 'fs';
import os from 'os';
import path from 'path';

const connectMock = jest.fn();
const listToolsMock = jest.fn().mockResolvedValue([]);
const executeMock = jest.fn().mockResolvedValue({ status: 'success', data: {} });
const disconnectMock = jest.fn();

jest.mock('./client/MCPClient', () => {
  return {
    MCPClient: jest.fn().mockImplementation(() => ({
      connect: connectMock,
      listTools: listToolsMock,
      executeTool: executeMock,
      disconnect: disconnectMock,
    })),
  };
});

jest.mock('./test-generator/TestGenerator', () => ({
  TestGenerator: jest.fn().mockImplementation(() => ({
    generateTests: jest.fn().mockResolvedValue([]),
  }))
}));

jest.mock('./validator/ResponseValidator', () => ({
  ResponseValidator: jest.fn().mockImplementation(() => ({
    validateResponse: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  }))
}));

jest.mock('./reporter/Reporter', () => ({
  Reporter: jest.fn().mockImplementation(() => ({
    generateReport: jest.fn().mockResolvedValue(undefined),
  }))
}));

import { runTests } from './index';

it('uses servers from CLI flag', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  const configPath = path.join(tmpDir, 'config.json');
  const config = {
    servers: ['first', 'second', 'third'],
    numTestsPerTool: 1,
    timeoutMs: 100,
    outputFormat: 'console',
    verbose: false,
    mcpServers: {
      first: { command: 'echo', args: ['1'], env: {} },
      second: { command: 'echo', args: ['2'], env: {} },
      third: { command: 'echo', args: ['3'], env: {} },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const originalArgv = process.argv;
  process.argv = ['node', 'mcp-server-tester', configPath, '--servers', 'second,third'];
  process.env.ANTHROPIC_API_KEY = 'test-key';

  await runTests();

  expect(connectMock).toHaveBeenCalledTimes(2);
  expect(connectMock.mock.calls.map((c) => c[0])).toEqual(['second', 'third']);

  process.argv = originalArgv;
});

