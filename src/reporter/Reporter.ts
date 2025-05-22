import fs from 'fs';
import path from 'path';
import { 
  ReporterInterface, 
  TestResult, 
  TesterConfig 
} from '../types';

/**
 * Reporter for test results
 */
export class Reporter implements ReporterInterface {
  /**
   * Generate a report for test results
   * @param results Test results to report
   * @param config Tester configuration
   */
  async generateReport(results: TestResult[], config: TesterConfig): Promise<void> {
    const format = config.outputFormat || 'console';
    
    switch (format) {
      case 'json':
        await this.generateJsonReport(results, config);
        break;
      case 'html':
        await this.generateHtmlReport(results, config);
        break;
      case 'markdown':
        await this.generateMarkdownReport(results, config);
        break;
      case 'console':
      default:
        this.generateConsoleReport(results);
        break;
    }
    
    // Print summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    console.log("\n=== Test Summary ===");
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Pass Rate: ${passRate}%`);
  }

  /**
   * Log test results to console
   * @param results Test results to log
   */
  private generateConsoleReport(results: TestResult[]): void {
    // We already log results during test execution, but we can enhance the output here
    console.log("\n=== Detailed Test Results ===");
    
    // Group by tool
    const groupedByTool: Record<string, TestResult[]> = {};
    
    for (const result of results) {
      const { toolName } = result.testCase;
      if (!groupedByTool[toolName]) {
        groupedByTool[toolName] = [];
      }
      groupedByTool[toolName].push(result);
    }
    
    // Print results by tool
    for (const [toolName, toolResults] of Object.entries(groupedByTool)) {
      console.log(`\n## Tool: ${toolName}`);
      
      for (const result of toolResults) {
        const { id, description, naturalLanguageQuery, inputs } = result.testCase;
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        const executionTime = result.executionTime ? `${result.executionTime}ms` : 'N/A';
        
        console.log(`\n[${status}] ${description} (${executionTime})`);
        console.log(`ID: ${id}`);
        console.log(`Natural Language Query: "${naturalLanguageQuery}"`);
        console.log(`Inputs: ${JSON.stringify(inputs, null, 2)}`);
        
        if (!result.passed && result.validationErrors) {
          console.log(`Errors: ${result.validationErrors.join(', ')}`);
        }
      }
    }
  }

  /**
   * Write test results to a file
   * @param results Test results to write
   * @param config Tester configuration
   */
  private async generateJsonReport(results: TestResult[], config: TesterConfig): Promise<void> {
    const outputPath = config.outputPath || 'mcp-test-report.json';
    
    const report = {
      summary: {
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        failedTests: results.filter(r => !r.passed).length,
        timestamp: new Date().toISOString()
      },
      results: results.map(result => ({
        id: result.testCase.id,
        toolName: result.testCase.toolName,
        description: result.testCase.description,
        naturalLanguageQuery: result.testCase.naturalLanguageQuery,
        inputs: result.testCase.inputs,
        passed: result.passed,
        executionTime: result.executionTime,
        validationErrors: result.validationErrors,
        response: result.response
      }))
    };
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`JSON report written to: ${outputPath}`);
  }

  /**
   * Generate an HTML report
   * @param results Test results to report
   */
  private async generateHtmlReport(results: TestResult[], config: TesterConfig): Promise<void> {
    const outputPath = config.outputPath || 'mcp-test-report.html';
    
    // Generate HTML content
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    // Group by tool
    const groupedByTool: Record<string, TestResult[]> = {};
    
    for (const result of results) {
      const { toolName } = result.testCase;
      if (!groupedByTool[toolName]) {
        groupedByTool[toolName] = [];
      }
      groupedByTool[toolName].push(result);
    }
    
    // Generate HTML
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MCP Server Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .summary-item { padding: 10px; border-radius: 5px; min-width: 100px; text-align: center; }
        .tool-section { margin-top: 30px; border: 1px solid #ddd; border-radius: 5px; padding: 10px; }
        .test-case { margin: 10px 0; padding: 15px; border-radius: 5px; }
        .pass { background-color: #e6ffec; }
        .fail { background-color: #ffebe9; }
        .test-details { margin-top: 15px; font-family: monospace; white-space: pre-wrap; background: #f6f8fa; padding: 10px; border-radius: 5px; }
        .query { background-color: #f0f7ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>MCP Server Test Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      
      <div class="summary">
        <div class="summary-item" style="background-color: #f0f7ff;">
          <div>Total Tests</div>
          <h2>${totalTests}</h2>
        </div>
        <div class="summary-item" style="background-color: #e6ffec;">
          <div>Passed</div>
          <h2>${passedTests}</h2>
        </div>
        <div class="summary-item" style="background-color: #ffebe9;">
          <div>Failed</div>
          <h2>${failedTests}</h2>
        </div>
        <div class="summary-item" style="background-color: #f6f8fa;">
          <div>Pass Rate</div>
          <h2>${passRate}%</h2>
        </div>
      </div>
    `;
    
    // Add tool sections
    for (const [toolName, toolResults] of Object.entries(groupedByTool)) {
      const toolPassRate = Math.round((toolResults.filter(r => r.passed).length / toolResults.length) * 100);
      
      html += `
      <div class="tool-section">
        <h2>Tool: ${toolName}</h2>
        <div>Pass Rate: ${toolPassRate}% (${toolResults.filter(r => r.passed).length}/${toolResults.length})</div>
      `;
      
      // Add test cases
      for (const result of toolResults) {
        const { id, description, naturalLanguageQuery, inputs } = result.testCase;
        const status = result.passed ? 'PASS' : 'FAIL';
        const executionTime = result.executionTime ? `${result.executionTime}ms` : 'N/A';
        
        html += `
        <div class="test-case ${result.passed ? 'pass' : 'fail'}">
          <h3>${status}: ${description}</h3>
          <div>ID: ${id}</div>
          <div>Execution Time: ${executionTime}</div>
          <div class="query">
            <strong>Natural Language Query:</strong>
            <p>${this.escapeHtml(naturalLanguageQuery)}</p>
          </div>
          <div class="test-details">
            <div>Inputs:</div>
            <pre>${JSON.stringify(inputs, null, 2)}</pre>
          `;
          
          if (result.response) {
            html += `
            <div>Response:</div>
            <pre>${JSON.stringify(result.response, null, 2)}</pre>
            `;
          }
          
          if (!result.passed && result.validationErrors) {
            html += `
            <div>Validation Errors:</div>
            <pre>${this.escapeHtml(result.validationErrors.join('\n'))}</pre>
            `;
          }
          
          html += `
          </div>
        </div>
        `;
      }
      
      html += `</div>`;
    }
    
    html += `
    </body>
    </html>
    `;
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report
    fs.writeFileSync(outputPath, html);
    console.log(`HTML report written to: ${outputPath}`);
  }

  /**
   * Generate a Markdown report
   * @param results Test results to report
   */
  private async generateMarkdownReport(results: TestResult[], config: TesterConfig): Promise<void> {
    const outputPath = config.outputPath || 'mcp-test-report.md';

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    const groupedByTool: Record<string, TestResult[]> = {};
    for (const result of results) {
      const { toolName } = result.testCase;
      if (!groupedByTool[toolName]) {
        groupedByTool[toolName] = [];
      }
      groupedByTool[toolName].push(result);
    }

    let md = `# MCP Server Test Report\n\n`;
    md += `Generated on: ${new Date().toLocaleString()}\n\n`;
    md += `## Summary\n`;
    md += `- Total Tests: ${totalTests}\n`;
    md += `- Passed: ${passedTests}\n`;
    md += `- Failed: ${failedTests}\n`;
    md += `- Pass Rate: ${passRate}%\n\n`;

    for (const [toolName, toolResults] of Object.entries(groupedByTool)) {
      const toolPassRate = Math.round((toolResults.filter(r => r.passed).length / toolResults.length) * 100);
      md += `### Tool: ${toolName} (${toolPassRate}% pass)\n`;

      for (const result of toolResults) {
        const { id, description, naturalLanguageQuery, inputs } = result.testCase;
        const status = result.passed ? 'PASS' : 'FAIL';
        const executionTime = result.executionTime ? `${result.executionTime}ms` : 'N/A';

        md += `\n- **${status}** ${description} (ID: ${id}, Time: ${executionTime})\n`;
        md += `  - Query: \`${this.escapeMarkdown(naturalLanguageQuery)}\`\n`;
        md += `  - Inputs:\n\n    \`\`\`json\n${JSON.stringify(inputs, null, 2)}\n\`\`\`\n`;

        if (result.response) {
          md += `  - Response:\n\n    \`\`\`json\n${JSON.stringify(result.response, null, 2)}\n\`\`\`\n`;
        }

        if (!result.passed && result.validationErrors) {
          md += `  - Validation Errors:\n\n    \`\`\`\n${this.escapeMarkdown(result.validationErrors.join('\n'))}\n\`\`\`\n`;
        }
      }

      md += `\n`;
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, md);
    console.log(`Markdown report written to: ${outputPath}`);
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/`/g, '\\`');
  }
}
