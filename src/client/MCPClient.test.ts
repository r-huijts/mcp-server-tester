import fs from 'fs';
import os from 'os';
import path from 'path';
import { MCPClient } from './MCPClient';

const spawnMock = jest.fn(() => ({ stderr: { on: jest.fn() }, kill: jest.fn() }));

jest.mock('child_process', () => ({
  spawn: spawnMock
}));

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    callTool: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation((opts: any) => {
    spawnMock(opts.command, opts.args, { env: opts.env, stdio: ['pipe','pipe','pipe'] });
    return {};
  })
}));

describe('MCPClient process spawning', () => {
  const configPath = path.join(os.tmpdir(), 'mcp-client-test-config.json');
  const config = {
    servers: ['test'],
    numTestsPerTool: 1,
    timeoutMs: 1000,
    outputFormat: 'console',
    verbose: false,
    mcpServers: {
      test: {
        command: 'echo',
        args: ['hello'],
        env: {}
      }
    }
  };

  beforeAll(() => {
    fs.writeFileSync(configPath, JSON.stringify(config));
  });

  afterAll(() => {
    fs.unlinkSync(configPath);
  });

  beforeEach(() => {
    spawnMock.mockClear();
  });

  test('connect spawns the server only once', async () => {
    const client = new MCPClient();
    await client.connect('test', configPath);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
