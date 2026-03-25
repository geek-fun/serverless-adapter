# Agent Guidelines

## Test Coverage Requirements

**HARD REQUIREMENT - DO NOT MODIFY**

The test coverage thresholds in `jest.config.cjs` are set to **85% minimum** for all metrics:

- Statements: 85%
- Branches: 85%
- Functions: 85%
- Lines: 85%

These thresholds are non-negotiable and must not be lowered. All code changes must maintain or improve test coverage to pass these thresholds. The CI pipeline will fail if coverage drops below 85%.

**Agents must NOT:**

- Lower coverage thresholds in `jest.config.cjs`
- Skip writing tests for new code
- Delete existing tests to bypass coverage requirements

**Agents must:**

- Write comprehensive tests for all new code
- Ensure all branches and edge cases are covered
- Run `npm test` before submitting changes to verify coverage passes
