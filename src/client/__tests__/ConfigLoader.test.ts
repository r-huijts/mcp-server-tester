import fs from 'fs';
import os from 'os';
import path from 'path';
import { ConfigLoader, DEFAULT_CONFIG_FILENAME } from '../ConfigLoader';
import { MCPClient } from '../MCPClient';

/** Helper to create a temporary configuration file */
function createTempConfig(servers: Record<string, any>): { dir: string; path: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-config-'));
  const configPath = path.join(dir, 'config.json');
  const config = {
    numTestsPerTool: 1,
    timeoutMs: 100,
    outputFormat: 'console',
    verbose: false,
    mcpServers: servers
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { dir, path: configPath };
}

describe('ConfigLoader', () => {
  test('creates and loads default config', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-default-'));
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    const loader = new ConfigLoader();
    const createdPath = loader.createDefaultConfigIfNeeded();
    expect(createdPath).toBe(path.join(tempDir, DEFAULT_CONFIG_FILENAME));
    expect(fs.existsSync(createdPath!)).toBe(true);

    const config = loader.loadConfig();
    expect(config).not.toBeNull();
    expect(loader.getServerNames().length).toBeGreaterThan(0);

    process.chdir(originalCwd);
  });
});

describe('MCPClient', () => {
  test('lists configured servers', () => {
    const { path: configPath } = createTempConfig({
      first: { command: 'node', args: ['first.js'], env: {} },
      second: { command: 'node', args: ['second.js'], env: {} }
    });

    const client = new MCPClient();
    // load configuration without connecting to any server
    (client as any).configLoader.loadConfig(configPath);
    const servers = client.listConfiguredServers();
    expect(servers).toEqual(['first', 'second']);
  });
});
