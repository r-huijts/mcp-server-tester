#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { MCPClient } from './client/MCPClient';
import { ConfigLoader, DEFAULT_CONFIG_FILENAME, CompleteConfig } from './client/ConfigLoader';
import { TestGenerator } from './test-generator/TestGenerator';
import { ResponseValidator } from './validator/ResponseValidator';
import { Reporter } from './reporter/Reporter';
import { TesterConfig, TestResult } from './types';

// Load environment variables from .env file
dotenv.config();

// Check for local .env in current working directory
const localEnvPath = path.join(process.cwd(), '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

// Default configuration
const DEFAULT_CONFIG = {
  numTestsPerTool: 3,
  timeoutMs: 10000,
  outputFormat: 'console',
  verbose: false
} as const;

/**
 * Print usage info
 */
function printUsage() {
  console.log(`
MCP Server Tester - Configuration-based testing tool for MCP servers

Usage:
  mcp-server-tester [config-path]

Arguments:
  config-path  Optional path to configuration file (defaults to mcp-servers.json in the current directory)

Examples:
  # Use default config file in current directory
  mcp-server-tester
  
  # Use custom config file
  mcp-server-tester ./configs/my-mcp-config.json

  Learn more: https://github.com/r-huijts/mcp-server-tester
`);
}

/**
 * Print a list of configured servers
 */
function printServerList(configLoader: ConfigLoader) {
  const serverNames = configLoader.getServerNames();
      
  if (serverNames.length === 0) {
    console.log('No MCP servers found in config file.');
    process.exit(0);
  }
  
  console.log('Available MCP servers:');
  serverNames.forEach(name => {
    console.log(`- ${name}`);
  });
  
  console.log('\nTo test servers, edit config.json to specify server configurations');
  process.exit(0);
}

/**
 * Main function to run the MCP server tester
 */
async function runTests() {
  let client: MCPClient | null = null;
  
  try {
    // Handle help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      printUsage();
      return;
    }
    
    // Initialize config loader
    const configLoader = new ConfigLoader();
    
    // Handle list flag
    if (process.argv.includes('--list') || process.argv.includes('-l')) {
      configLoader.loadConfig();
      printServerList(configLoader);
      return;
    }
    
    // Handle init flag
    if (process.argv.includes('--init') || process.argv.includes('-i')) {
      const configPath = configLoader.createDefaultConfigIfNeeded();
      if (configPath) {
        console.log(`Created default config file at: ${configPath}`);
        console.log(`Edit this file to add your MCP servers and test settings.`);
      } else {
        console.log(`Config file already exists at: ${path.join(process.cwd(), DEFAULT_CONFIG_FILENAME)}`);
      }
      return;
    }
    
    // Get config path from arguments or use default
    const configPath = process.argv.length > 2 && !process.argv[2].startsWith('-') 
      ? process.argv[2]
      : path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      console.error(`Error: Config file not found at ${configPath}`);
      console.log(`Run 'mcp-server-tester --init' to create a default config file.`);
      process.exit(1);
    }
    
    // Load complete configuration
    console.log(`Loading configuration from: ${configPath}`);
    const fullConfig = configLoader.loadConfig(configPath);
    if (!fullConfig) {
      console.error('Failed to load valid configuration.');
      process.exit(1);
    }
    
    // Load test configuration from the full config
    const testConfig = createTestConfig(fullConfig);
    
    // Check for API key in environment variable or .env file only
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Error: Anthropic API key is required. Set it using the ANTHROPIC_API_KEY environment variable or in a .env file.');
      process.exit(1);
    }
    
    // Add the API key to the config for internal use only
    testConfig.anthropicApiKey = apiKey;
    
    // Determine which servers to test
    // If servers is not specified, test all servers in mcpServers
    if (!testConfig.servers || testConfig.servers.length === 0) {
      const allServers = Object.keys(fullConfig.mcpServers);
      if (allServers.length === 0) {
        console.error('Error: No servers defined in the mcpServers section of your config file.');
        console.log('Edit your config file to add server configurations.');
        process.exit(1);
      }
      testConfig.servers = allServers;
      console.log(`No specific servers specified. Testing all ${allServers.length} servers defined in config.`);
    }
    
    // Log the configuration if verbose is enabled
    if (testConfig.verbose) {
      const loggableConfig = {
        ...testConfig,
        anthropicApiKey: '***' // Hide the actual API key in logs
      };
      console.log(`Configuration:`, JSON.stringify(loggableConfig, null, 2));
    }
    
    // Initialize shared components
    const validator = new ResponseValidator();
    const reporter = new Reporter();
    const testGenerator = new TestGenerator(apiKey);
    
    // Test each server
    for (const serverName of testConfig.servers) {
      console.log(`\n========================================`);
      console.log(`Testing server: ${serverName}`);
      console.log(`========================================\n`);
      
      client = new MCPClient();
      
      try {
        // Connect to server with timeout
        console.log(`Connecting to MCP server: ${serverName}...`);
        
        const connectionPromise = client.connect(serverName, configPath);
        
        // Set up timeout for connection
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), testConfig.timeoutMs);
        });
        
        // Wait for connection or timeout
        await Promise.race([connectionPromise, timeoutPromise]);
        
        // Get available tools
        const tools = await client.listTools();
        console.log(`Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
        
        if (tools.length === 0) {
          console.warn('No tools found in the MCP server. Nothing to test.');
          continue;
        }
  
        // Generate tests
        console.log(`Generating ${testConfig.numTestsPerTool} tests per tool...`);
        const testCases = await testGenerator.generateTests(tools, testConfig);
        console.log(`Generated ${testCases.length} test cases in total.`);
  
        // Run tests
        console.log('Running tests...');
        const results: TestResult[] = [];
  
        for (const testCase of testCases) {
          console.log(`Testing ${testCase.toolName}: ${testCase.description}`);
          
          try {
            // Execute the tool with timeout
            const startTime = Date.now();
            
            const toolPromise = client.executeTool(testCase.toolName, testCase.inputs);
            const toolTimeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Tool execution timeout')), testConfig.timeoutMs);
            });
            
            const response = await Promise.race([toolPromise, toolTimeoutPromise]);
            const executionTime = Date.now() - startTime;
            
            // Validate the response
            const validationResult = validator.validateResponse(response, testCase);
            
            // Create test result
            const result: TestResult = {
              testCase,
              passed: validationResult.valid,
              response,
              validationErrors: validationResult.errors,
              executionTime
            };
            
            results.push(result);
            
            // Log result
            if (result.passed) {
              console.log(`  ✓ Passed (${executionTime}ms)`);
            } else {
              console.log(`  ✗ Failed: ${validationResult.errors.join(', ')}`);
            }
          } catch (error) {
            console.error(`  ✗ Error executing test:`, error);
            results.push({
              testCase,
              passed: false,
              validationErrors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`]
            });
          }
        }
  
        // Generate report
        await reporter.generateReport(results, testConfig);
        
      } finally {
        // Clean up resources
        if (client) {
          try {
            await client.disconnect();
            client = null;
          } catch (error) {
            console.error('Error disconnecting from server:', error);
          }
        }
      }
    }
    
    console.log('\nTesting complete!');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Ensure we always clean up
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error('Error disconnecting from server:', error);
      }
    }
  }
}

/**
 * Create a test configuration from the full config
 */
function createTestConfig(fullConfig: CompleteConfig): TesterConfig {
  return {
    servers: fullConfig.servers,
    numTestsPerTool: fullConfig.numTestsPerTool || DEFAULT_CONFIG.numTestsPerTool,
    timeoutMs: fullConfig.timeoutMs || DEFAULT_CONFIG.timeoutMs,
    outputFormat: fullConfig.outputFormat || DEFAULT_CONFIG.outputFormat,
    outputPath: fullConfig.outputPath,
    verbose: fullConfig.verbose || DEFAULT_CONFIG.verbose
  };
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}); 