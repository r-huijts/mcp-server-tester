## Features

- **Natural Language Query Generation**: Generates realistic user queries that would lead an LLM to use each tool, enhancing test case understanding.
- **Automated Test Generation**: Creates test cases for each tool based on its schema and specification.
- **Customizable Testing**: Configure the number of tests per tool, timeouts, and other parameters.
- **Comprehensive Validation**: Validates responses against generated expectations and rules.
- **Detailed Reporting**: Provides detailed reports in multiple formats (console, JSON, HTML, Markdown).

## Test Reports

Test reports include:

- **Natural Language Queries**: Shows the actual query a user might ask that would trigger the tool, providing context for the test.
- **Summary Statistics**: Total tests, passed tests, and failure rates.
- **Tool-Specific Results**: Results grouped by tool with detailed information about each test case.
- **Validation Details**: Information about why tests passed or failed.
- **Response Data**: Raw response data for inspection and debugging.

Reports can be generated in multiple formats:
- Console (default)
- JSON
- HTML
- Markdown
