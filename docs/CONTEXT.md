# Ryziz Firebase - Implementation Context

## Overview
Building a Remix-like framework for Firebase with file-based routing, zero configuration, and automatic deployment.

## Learning from Zypin
- Templates use separate `create.js` (renamed from `init.js`) for initialization
- Templates NOT in workspaces
- Scripts: `pre-commit.js` (install hooks + bump version), `npm-publish.js` (CI/CD)
- Detect template from `basename(process.argv[1])`

## Established Rules
1. **Code style**: Readable, simplest eslint
2. **Dependencies**: Exact versions, all as dependencies, install via command
3. **File naming**: `pages.index.jsx`, `api.users.$id.js`
4. **Package naming**: `@ryziz` org, `create-react` template
5. **Git**: Single commit message
6. **Philosophy**: Less code = HUGE win, only must-have code

## Current Structure
```
ryziz/
├── package.json          # Minimal: private, workspaces, postinstall
├── .gitignore           # Minimal: just node_modules
├── packages/
│   └── cli/
│       ├── package.json # @ryziz/cli
│       └── create.js    # Template initialization
├── templates/
│   └── create-react/    # NOT in workspaces
│       ├── package.json # bin: node_modules/@ryziz/cli/create.js
│       ├── public/
│       └── src/
└── scripts/
    ├── pre-commit.js    # Install hooks + bump version
    └── npm-publish.js   # CI/CD publish

```

## Implementation Status
✅ Root package.json
✅ .gitignore
🚧 CLI package
⏳ Template
⏳ Scripts

## Current Issue
**Package scope detection**:
- Template: `@ryziz/create-react`
- Script name: `create-react` (no @ryziz)
- Need to handle scope in path detection

## Solutions
1. Add scope to path: `../@ryziz/${scriptName}/package.json`
2. Remove scope from template name: `create-react` (no @ryziz)
3. Parse package.json to get actual name

## File-Based Routing (Target)
- **Frontend**: `pages.*.jsx`, `app.*.jsx`
- **Backend**: `api.*.js` with level-2 grouping
- **Build**: esbuild with virtual modules

## Next Steps
1. Resolve scope issue
2. Complete CLI create.js
3. Create minimal template
4. Test flow
5. Add dev/build/deploy commands later