import fs from 'fs';
import os from 'os';
import path from 'path';
import { Reporter } from '../Reporter';
import { TestResult, TesterConfig } from '../../types';

function createTestResult(passed: boolean): TestResult {
  return {
    testCase: {
      id: '1',
      toolName: 'tool',
      description: 'desc',
      naturalLanguageQuery: 'query',
      inputs: {},
      expectedOutcome: { status: passed ? 'success' : 'error' }
    },
    passed,
    executionTime: 5,
    validationErrors: passed ? [] : ['err']
  };
}

describe('Reporter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-'));
  });

  test('creates JSON report', async () => {
    const reporter = new Reporter();
    const results = [createTestResult(true)];
    const config: TesterConfig = {
      numTestsPerTool: 1,
      timeoutMs: 100,
      outputFormat: 'json',
      outputPath: path.join(tmpDir, 'report.json'),
      verbose: false
    };

    await reporter.generateReport(results, config);

    expect(fs.existsSync(config.outputPath!)).toBe(true);
    const data = JSON.parse(fs.readFileSync(config.outputPath!, 'utf8'));
    expect(data.summary.totalTests).toBe(1);
    expect(data.results[0].passed).toBe(true);
  });

  test('creates HTML report', async () => {
    const reporter = new Reporter();
    const results = [createTestResult(false)];
    const config: TesterConfig = {
      numTestsPerTool: 1,
      timeoutMs: 100,
      outputFormat: 'html',
      outputPath: path.join(tmpDir, 'report.html'),
      verbose: false
    };

    await reporter.generateReport(results, config);

    expect(fs.existsSync(config.outputPath!)).toBe(true);
    const html = fs.readFileSync(config.outputPath!, 'utf8');
    expect(html).toContain('<html>');
    expect(html).toContain('MCP Server Test Report');
  });

  test('creates Markdown report', async () => {
    const reporter = new Reporter();
    const results = [createTestResult(true)];
    const config: TesterConfig = {
      numTestsPerTool: 1,
      timeoutMs: 100,
      outputFormat: 'markdown',
      outputPath: path.join(tmpDir, 'report.md'),
      verbose: false
    };

    await reporter.generateReport(results, config);

    expect(fs.existsSync(config.outputPath!)).toBe(true);
    const md = fs.readFileSync(config.outputPath!, 'utf8');
    expect(md).toContain('# MCP Server Test Report');
  });
});
