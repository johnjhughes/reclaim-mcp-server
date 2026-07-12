# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - Unreleased

### Fixed

- Ship the `#!/usr/bin/env node` shebang in the published `dist/index.js` so the
  npm-installed `bin` shim is executed by Node, not by the parent shell. Without
  this, MCP clients that launch the server via `npx -y reclaim-mcp-server` fail
  immediately with errors like `import: command not found` and
  `syntax error near unexpected token '('` because the shell tries to parse the
  JavaScript file as a shell script. The shebang was added to the source tree
  by @sempostma in [`f356dce`](https://github.com/johnjhughes/reclaim-mcp-server/commit/f356dce1e0fef125eef249fcfa8430391087ea6e)
  but never made it into a published release.

## [0.1.2] - 2025-04-21

Initial published release.
