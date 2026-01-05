# Ryziz Firebase - Architecture Documentation

> A Remix-like framework for Firebase with file-based routing, zero configuration, and automatic deployment.

**Version:** 1.0.0
**Keywords:** React, Firebase, File-based Routing, Zero Config
**NPM Organization:** `@ryziz-firebase`

---

## Table of Contents

1. [Overview](#overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Packages](#packages)
4. [Templates](#templates)
5. [File-Based Routing](#file-based-routing)
6. [Build System](#build-system)
7. [CLI Commands](#cli-commands)
8. [Development Workflow](#development-workflow)
9. [Deployment Workflow](#deployment-workflow)
10. [Release Automation](#release-automation)
11. [Implementation Plan](#implementation-plan)

---

## Overview

**Ryziz Firebase** is a full-stack framework that combines:
- **React** for frontend with React Router
- **Firebase Hosting** for static assets
- **Firebase Functions** for serverless API with Express
- **Firebase Firestore** for database
- **File-based routing** like Remix/Next.js
- **Zero configuration** - no config files needed
- **Automatic builds** with esbuild
- **Shopify integration** for embedded apps (optional)

### Key Principles

1. **Zero Config**: No configuration files required from user
2. **Convention over Configuration**: File names determine routes
3. **Monorepo**: Framework packages + user templates
4. **Automatic Everything**: Auto-generate configs, auto-fetch credentials, auto-deploy
5. **Flat & Minimal**: Compress code, minimal files, no nested src/ folders
6. **Simple by Default**: Complex features are optional (Shopify integration)

---

## Monorepo Structure

```
ryziz-firebase/
├── package.json                      # Root workspace (private, no name/version)
├── scripts/
│   └── release.js                    # Auto-versioning & npm publishing
├── .github/
│   └── workflows/
│       └── publish.yml               # CI/CD for auto-publish to npm
├── packages/
│   ├── cli/                          # Build system, dev server, deploy commands
│   │   ├── package.json              # @ryziz-firebase/cli
│   │   ├── index.js                  # CLI entry point (detects template mode)
│   │   └── commands/
│   │       ├── init.js               # Template initialization
│   │       ├── dev.js                # Dev command
│   │       ├── build.js              # Build command
│   │       └── deploy.js             # Deploy command
│   │
│   ├── router/                       # React Router utilities for client
│   │   ├── package.json              # @ryziz-firebase/router
│   │   ├── index.js                  # Re-exports from react-router
│   │   └── entry.jsx                 # React app entry point
│   │
│   ├── functions/                    # Runtime helpers for Firebase Functions
│   │   ├── package.json              # @ryziz-firebase/functions
│   │   ├── index.js                  # Exports: db, getFirestore, etc (for end users)
│   │   ├── entry.js                  # Exports: createApiApp (build entry point)
│   │   └── firebase.json             # Base Firebase config
│   │
│   └── shopify/                      # Shopify-specific utilities
│       ├── package.json              # @ryziz-firebase/shopify
│       ├── index.js                  # Exports: withShopify, db
│       ├── entry.js                  # Exports: createAuthApp, createWebhooksApp, createApiApp
│       ├── shopify.js                # Shopify app config & session storage
│       ├── middleware.js             # withShopify middleware
│       └── firebase.json             # Shopify-specific Firebase config
│
└── templates/
    ├── create-react/                 # Default React template
    │   ├── package.json              # @ryziz-firebase/create-react (published)
    │   │                             # bin: "node_modules/@ryziz-firebase/cli/index.js"
    │   ├── gitignore                 # Renamed to .gitignore when copied
    │   ├── public/
    │   │   └── index.html
    │   └── src/
    │       ├── pages.index.jsx       # Frontend route: /
    │       └── api.index.js          # API route: /api/
    │
    └── create-shopify/               # Shopify React template
        ├── package.json              # @ryziz-firebase/create-shopify (published)
        │                             # bin: "node_modules/@ryziz-firebase/cli/index.js"
        ├── gitignore
        ├── shopify.app.toml          # Shopify app configuration
        ├── public/
        │   ├── index.html            # Public pages HTML
        │   └── app/
        │       └── index.html        # Embedded app HTML
        └── src/
            ├── pages.index.jsx       # Public route: /
            ├── app.index.jsx         # Embedded app route: /app/
            ├── api.index.js          # API route: /api/
            └── webhooks.app-uninstalled.js  # Webhook handler
```

### Key Notes

- **Flat structure**: No `src/` folders inside packages, all files at root level
  - **Note:** Folder structure shown in this doc (e.g., `commands/`, `build/`) is for documentation clarity
  - **Implementation:** All files will be flat at package root when optimizing
- **Minimal code**: Compress and minimize code in all packages
- **No bin.js in templates**: Templates use `bin` field pointing to CLI
- **Hoisting**: npm hoists all `@ryziz-firebase/*` packages to same level
- **Templates NOT in workspaces**: Templates are standalone packages

---

## Packages

### 1. `@ryziz-firebase/cli`

**Purpose:** Build system, dev server, and deployment commands.

**Key Files:**
- `index.js` - CLI entry point with commander, detects template mode
- `commands/init.js` - Template detection and copying
- `commands/dev.js` - Start Firebase emulators + watch mode
- `commands/build.js` - Production build
- `commands/deploy.js` - Deploy to Firebase
- `build/pages.js` - Build frontend with esbuild
- `build/api.js` - Build API functions with esbuild
- `build/plugins.js` - esbuild plugins (virtual routes, etc)
- `utils/firebase.js` - Auto-generate firebase.json
- `utils/scan.js` - Scan pages.*, api.*, webhooks.* files
- `utils/spawn.js` - Process spawning helpers

**package.json:**
```json
{
  "name": "@ryziz-firebase/cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "ryziz": "./index.js"
  },
  "dependencies": {
    "esbuild": "...",
    "firebase-tools": "...",
    "commander": "...",
    "glob": "...",
    "fs-extra": "..."
  }
}
```

**Note:** Dependencies will be added via `npm install` during implementation.

**Note on Structure:** Files shown in folders (e.g., `commands/init.js`) are for documentation clarity. During implementation, all files will be flat at package root for optimization.

**index.js structure:**
```javascript
#!/usr/bin/env node
import { Command } from 'commander';
import { detectTemplate, initTemplate } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import { deploy } from './commands/deploy.js';

const program = new Command();
const templateInfo = detectTemplate();

if (templateInfo) {
  // Template mode: npx @ryziz-firebase/create-react my-app
  program
    .name(templateInfo.name)
    .description(`Initialize ${templateInfo.name} template`)
    .argument('[folder]', 'Folder name')
    .action((folder) => initTemplate(folder, templateInfo));
} else {
  // CLI mode: ryziz dev/build/deploy
  program
    .name('ryziz')
    .description('Ryziz Firebase CLI');

  program
    .command('dev')
    .description('Start development server')
    .option('--config <name>', 'Shopify config name (for multiple shopify.app*.toml)')
    .action(dev);

  program
    .command('build')
    .description('Build for production')
    .option('--watch', 'Watch mode')
    .action(build);

  program
    .command('deploy')
    .description('Deploy to Firebase')
    .action(deploy);
}

program.parse();
```

**commands/init.js:**
```javascript
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync, renameSync } from 'fs';
import { copy } from 'fs-extra';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function detectTemplate() {
  const scriptName = basename(process.argv[1]);
  if (!scriptName.startsWith('create-')) return null;

  try {
    // cli/commands/init.js -> ../../create-react/package.json
    const templatePackageJsonPath = join(__dirname, `../../${scriptName}/package.json`);
    const templatePackageJson = JSON.parse(readFileSync(templatePackageJsonPath, 'utf-8'));
    const templateDir = dirname(templatePackageJsonPath);
    return { name: templatePackageJson.name, version: templatePackageJson.version, path: templateDir };
  } catch (error) {
    console.error('Error: Unable to detect template information');
    process.exit(1);
  }
}

export async function initTemplate(folderName, templateInfo) {
  if (!folderName) {
    console.error('Error: Folder name is required');
    console.error(`Usage: npx ${templateInfo.name} <folder-name>`);
    process.exit(1);
  }

  const targetDir = join(process.cwd(), folderName);
  if (existsSync(targetDir)) {
    console.error(`Error: Folder "${folderName}" already exists`);
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });
  await copyTemplate(templateInfo, targetDir);
  await cleanupPackageJson(targetDir, folderName);
  console.log('\nTemplate initialized successfully!');
  console.log(`Next: cd ${folderName} && npm install\n`);
}

async function copyTemplate(templateInfo, targetDir) {
  const sourceDir = templateInfo.path;
  console.log(`\nCopying template files from ${templateInfo.name}...\n`);
  const files = readdirSync(sourceDir);

  for (const file of files) {
    if (file === 'node_modules' || file === 'package-lock.json') continue;
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);
    if (existsSync(targetPath)) {
      console.warn(`Warning: ${file} already exists, skipping...`);
      continue;
    }
    await copy(sourcePath, targetPath);
    console.log(`✓ Copied: ${file}`);
  }

  // Rename gitignore to .gitignore
  const gitignorePath = join(targetDir, 'gitignore');
  const dotGitignorePath = join(targetDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    renameSync(gitignorePath, dotGitignorePath);
  }
}

async function cleanupPackageJson(targetDir, folderName) {
  const packageJsonPath = join(targetDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.warn('Warning: package.json not found in template');
    return;
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // Remove bin field
  delete pkg.bin;

  // Set project name
  pkg.name = folderName;

  // Move CLI to devDependencies
  if (pkg.dependencies && pkg.dependencies['@ryziz-firebase/cli']) {
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies['@ryziz-firebase/cli'] = pkg.dependencies['@ryziz-firebase/cli'];
    delete pkg.dependencies['@ryziz-firebase/cli'];
  }

  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('\n✓ Updated package.json');
}
```

---

### 2. `@ryziz-firebase/router`

**Purpose:** React Router utilities for client-side routing.

**Key Files:**
- `index.js` - Re-exports from react-router
- `entry.jsx` - React app entry point that consumes `virtual:routes`

**package.json:**
```json
{
  "name": "@ryziz-firebase/router",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.js",
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "dependencies": {
    "react-dom": "...",
    "react-router": "..."
  }
}
```

**index.js:**
```javascript
// Re-exports from react-router
export { useParams, useNavigate, useLocation, Link, NavLink } from 'react-router';
```

**entry.jsx:**
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import routes from 'virtual:routes'; // Generated by esbuild plugin

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            Component={route.component}
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

---

### 3. `@ryziz-firebase/functions`

**Purpose:** Runtime helpers for Firebase Functions with Express.

**Key Files:**
- `index.js` - Exports `db` and Firebase utilities for end users
- `entry.js` - Exports `createApiApp` used as esbuild entry point
- `firebase.json` - Base Firebase config

**package.json:**
```json
{
  "name": "@ryziz-firebase/functions",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.js",
  "dependencies": {
    "firebase-admin": "...",
    "firebase-functions": "...",
    "express": "..."
  }
}
```

**index.js (for end users):**
```javascript
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Lazy Firestore proxy
 * Delays initialization until first access
 */
function lazyFirestore() {
  let _db;
  return new Proxy({}, {
    get(_target, prop) {
      if (!_db) _db = getFirestore();
      return _db[prop];
    }
  });
}

export const db = lazyFirestore();

// Re-export Firebase Admin utilities
export { getFirestore } from 'firebase-admin/firestore';
```

**entry.js (build entry point):**
```javascript
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { initializeApp } from 'firebase-admin/app';
import apiRoutes from 'virtual:api-routes'; // Generated by esbuild plugin

initializeApp();

/**
 * Create Express app from API routes
 */
function createApiApp(routes) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  routes.forEach(route => {
    HTTP_METHODS.forEach(method => {
      if (route.module[method]) {
        const handler = route.module[method];

        // Auto error handling wrapper
        const wrappedHandler = async (req, res) => {
          try {
            await handler(req, res);
          } catch (error) {
            console.error(`Error in ${method} ${route.path}:`, error);
            if (!res.headersSent) {
              res.status(500).json({ error: error.message });
            }
          }
        };

        app[method.toLowerCase()](route.path, wrappedHandler);
      }
    });
  });

  return app;
}

/**
 * Group routes by function name (level-2 segment)
 * Apply config from first route in group
 */
const functionGroups = {};
apiRoutes.forEach(route => {
  if (!functionGroups[route.functionName]) {
    functionGroups[route.functionName] = {
      routes: [],
      config: route.module.config || { memory: '256MiB' }
    };
  }
  functionGroups[route.functionName].routes.push(route);
});

// Export each function group
Object.entries(functionGroups).forEach(([name, group]) => {
  const app = createApiApp(group.routes);
  exports[name] = onRequest(group.config, app);
});
```

**firebase.json (base config):**
```json
{
  "hosting": {
    "public": "dist/public",
    "rewrites": []
  },
  "functions": {
    "source": "dist/functions"
  },
  "emulators": {
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

**Note:** Rewrites are auto-generated during build based on scanned API files.

**Example for default template:**
```json
{
  "hosting": {
    "rewrites": [
      { "source": "/api/users/**", "function": "api-users" },
      { "source": "/api/posts/**", "function": "api-posts" },
      { "source": "/api/", "function": "api-index" },
      { "source": "/api/**", "function": "api-index" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

---

### 4. `@ryziz-firebase/shopify`

**Purpose:** Shopify integration with OAuth, session storage, and webhooks.

**Key Files:**
- `index.js` - Exports `withShopify`, `db` for end users
- `entry.js` - Exports `createAuthApp`, `createWebhooksApp`, `createApiApp`
- `shopify.js` - Shopify app configuration
- `middleware.js` - withShopify implementation
- `firebase.json` - Shopify-specific Firebase config

**package.json:**
```json
{
  "name": "@ryziz-firebase/shopify",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.js",
  "dependencies": {
    "@ryziz-firebase/functions": "^1.0.0",
    "@shopify/shopify-app-express": "...",
    "@shopify/app-bridge-types": "..."
  }
}
```

**index.js:**
```javascript
export { withShopify } from './middleware.js';
export { shopify } from './shopify.js';
export { db } from '@ryziz-firebase/functions';
```

**middleware.js:**
```javascript
import { shopify } from './shopify.js';

export function withShopify(handler) {
  return async (req, res) => {
    // Validate Shopify session
    await new Promise((resolve, reject) => {
      shopify.validateAuthenticatedSession()(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const session = res.locals.shopify?.session;

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Add GraphQL helper
    const client = new shopify.api.clients.Graphql({ session });

    req.shopify = {
      session,
      client,
      graphql: async (query, variables) => {
        const response = await client.request(query, { variables });
        if (response.errors) {
          throw new Error(response.errors.map(e => e.message).join(', '));
        }
        return response.data;
      }
    };

    return handler(req, res);
  };
}
```

**shopify.js:**
```javascript
import { shopifyApp } from '@shopify/shopify-app-express';
import { getFirestore } from 'firebase-admin/firestore';

function createSessionStorage() {
  let collection;

  const getCollection = () => {
    if (!collection) {
      collection = getFirestore().collection('shopify-sessions');
    }
    return collection;
  };

  return {
    async storeSession(session) {
      await getCollection().doc(session.id).set(session.toObject());
      return true;
    },
    async loadSession(id) {
      const doc = await getCollection().doc(id).get();
      if (!doc.exists) return undefined;
      return new Session(doc.data());
    },
    async deleteSession(id) {
      await getCollection().doc(id).delete();
      return true;
    },
    async deleteSessions(ids) {
      await Promise.all(ids.map(id => this.deleteSession(id)));
      return true;
    },
    async findSessionsByShop(shop) {
      const snapshot = await getCollection().where('shop', '==', shop).get();
      return snapshot.docs.map(doc => new Session(doc.data()));
    }
  };
}

export const shopify = shopifyApp({
  sessionStorage: createSessionStorage(),
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || [],
    hostName: process.env.SHOPIFY_HOST_NAME,
    apiVersion: '2025-10'
  },
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
  webhooks: {
    path: '/webhook',
  }
});
```

**entry.js:**
```javascript
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { shopify } from './shopify.js';
import express from 'express';
import apiRoutes from 'virtual:api-routes';
import webhooks from 'virtual:webhooks';

initializeApp();

// Auth function
function createAuthApp() {
  const app = express();
  app.get(shopify.config.auth.path, shopify.auth.begin());
  app.get(shopify.config.auth.callbackPath,
    shopify.auth.callback(),
    shopify.redirectToShopifyOrAppRoot()
  );
  return app;
}

// Webhooks function
function createWebhooksApp() {
  const app = express();

  // Firebase Functions v2 provides rawBody for HMAC verification
  app.use((req, res, next) => {
    if (req.rawBody) {
      req.body = req.rawBody;
    }
    next();
  });

  app.post(shopify.config.webhooks.path,
    shopify.processWebhooks({ webhookHandlers: webhooks })
  );
  return app;
}

// API function - Create Express app from routes
function createApiApp(routes) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  routes.forEach(route => {
    HTTP_METHODS.forEach(method => {
      if (route.module[method]) {
        const handler = route.module[method];

        // Auto error handling wrapper
        const wrappedHandler = async (req, res) => {
          try {
            await handler(req, res);
          } catch (error) {
            console.error(`Error in ${method} ${route.path}:`, error);
            if (!res.headersSent) {
              res.status(500).json({ error: error.message });
            }
          }
        };

        app[method.toLowerCase()](route.path, wrappedHandler);
      }
    });
  });

  return app;
}

// Export static functions
export const auth = onRequest({ memory: '512MiB' }, createAuthApp());
export const webhooks = onRequest({ memory: '512MiB' }, createWebhooksApp());

// Export API functions grouped by level-2 segment
const functionGroups = {};
apiRoutes.forEach(route => {
  if (!functionGroups[route.functionName]) {
    functionGroups[route.functionName] = {
      routes: [],
      config: route.module.config || { memory: '256MiB' }
    };
  }
  functionGroups[route.functionName].routes.push(route);
});

Object.entries(functionGroups).forEach(([name, group]) => {
  const app = createApiApp(group.routes);
  exports[name] = onRequest(group.config, app);
});
```

**firebase.json (auto-generated):**
```json
{
  "hosting": {
    "public": "dist/public",
    "rewrites": [
      { "source": "/auth", "function": "auth" },
      { "source": "/auth/**", "function": "auth" },
      { "source": "/webhook", "function": "webhooks" },
      { "source": "/api/users/**", "function": "api-users" },
      { "source": "/api/posts/**", "function": "api-posts" },
      { "source": "/api/", "function": "api-index" },
      { "source": "/api/**", "function": "api-index" },
      { "source": "/app", "destination": "/app/index.html" },
      { "source": "/app/**", "destination": "/app/index.html" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": {
    "source": "dist/functions"
  },
  "emulators": {
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

**Note:** API rewrites are dynamically generated based on scanned `api.*` files. Sorted from most specific to least specific.

---

## Templates

### 1. `@ryziz-firebase/create-react`

**Purpose:** Default React template with Firebase.

**Structure:**
```
templates/create-react/
├── package.json          # Published package
├── gitignore             # Copied as .gitignore
├── public/
│   └── index.html
└── src/
    ├── pages.index.jsx   # Home page
    └── api.index.js      # API endpoint
```

**package.json:**
```json
{
  "name": "@ryziz-firebase/create-react",
  "version": "1.0.0",
  "type": "module",
  "bin": "node_modules/@ryziz-firebase/cli/index.js",
  "scripts": {
    "dev": "ryziz dev",
    "build": "ryziz build",
    "deploy": "ryziz deploy"
  },
  "dependencies": {
    "@ryziz-firebase/cli": "^1.0.0",
    "@ryziz-firebase/router": "^1.0.0",
    "@ryziz-firebase/functions": "^1.0.0",
    "react": "^18.2.0"
  }
}
```

**How it works:**
1. User: `npx @ryziz-firebase/create-react my-app`
2. npm downloads `create-react` + dependencies (including `cli`)
3. npm creates symlink: `.bin/create-react -> @ryziz-firebase/cli/index.js`
4. CLI `detectTemplate()` detects `create-react` from script name
5. CLI copies template files to `my-app/`
6. CLI modifies `package.json` (remove bin, rename, move cli to devDeps)

**public/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Firebase App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/index.js"></script>
</body>
</html>
```

**src/pages.index.jsx:**
```jsx
export default function Home() {
  return (
    <div>
      <h1>Welcome to Ryziz Firebase!</h1>
      <p>Edit src/pages.index.jsx to get started.</p>
    </div>
  );
}
```

**src/api.index.js:**
```javascript
export const GET = async (req, res) => {
  res.json({ message: 'Hello from Firebase Functions!' });
};
```

---

### 2. `@ryziz-firebase/create-shopify`

**Purpose:** Shopify embedded app template.

**Structure:**
```
templates/create-shopify/
├── package.json
├── gitignore
├── shopify.app.toml                  # Shopify config
├── public/
│   ├── index.html                    # Public pages
│   └── app/
│       └── index.html                # Embedded app
└── src/
    ├── pages.index.jsx               # Public home page
    ├── app.index.jsx                 # Embedded app dashboard
    ├── api.index.js                  # API with Shopify GraphQL
    └── webhooks.app-uninstalled.js   # Webhook handler
```

**package.json:**
```json
{
  "name": "@ryziz-firebase/create-shopify",
  "version": "1.0.0",
  "type": "module",
  "bin": "node_modules/@ryziz-firebase/cli/index.js",
  "scripts": {
    "dev": "ryziz dev",
    "build": "ryziz build",
    "deploy": "ryziz deploy"
  },
  "dependencies": {
    "@ryziz-firebase/cli": "^1.0.0",
    "@ryziz-firebase/router": "^1.0.0",
    "@ryziz-firebase/shopify": "^1.0.0",
    "@shopify/polaris": "...",
    "@shopify/app-bridge-react": "...",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@shopify/cli": "...",
    "cloudflared": "..."
  }
}
```

**shopify.app.toml:**
```toml
name = "my-shopify-app"
client_id = ""
application_url = "https://your-app.web.app"
embedded = true

[access_scopes]
scopes = "read_products,write_products"

[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true
```

**public/app/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify App</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.shopifyConfig = {
      apiKey: '%SHOPIFY_API_KEY%',
      host: new URLSearchParams(location.search).get('host')
    };
  </script>
  <script type="module" src="/index.js"></script>
</body>
</html>
```

**src/app.index.jsx:**
```jsx
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div>
      <h1>Shopify Dashboard</h1>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

**src/api.index.js:**
```javascript
import { withShopify } from '@ryziz-firebase/shopify';

export const GET = withShopify(async (req, res) => {
  const shopData = await req.shopify.graphql(`
    query {
      shop {
        name
        email
      }
    }
  `);

  res.json({ shop: shopData.shop });
});
```

**src/webhooks.app-uninstalled.js:**
```javascript
export const TOPIC = 'APP_UNINSTALLED';

export default async function handle(topic, shop, body) {
  console.log('App uninstalled:', { topic, shop, body });
  // Cleanup logic here
}
```

---

## File-Based Routing

### Frontend Routes (pages.*, app.*)

**Pattern:** `pages.<route>.jsx` or `app.<route>.jsx`

**Mapping Rules:**
```
pages.index.jsx                 → /
pages.about.jsx                 → /about
pages.posts.$id.jsx             → /posts/:id
pages.users.$id.posts.$pid.jsx  → /users/:id/posts/:pid

app.index.jsx                   → /app/
app.settings.jsx                → /app/settings
app.products.$id.jsx            → /app/products/:id
```

**Key Points:**
- `.` separates path segments
- `$` prefix becomes route parameter (`:id`)
- `index` maps to root of that section
- Each page is standalone (no shared layout system)
- 404 page: `pages.404.jsx` catches all unmatched routes

**Sorting Rules:**
Learn from Ryziz implementation at `/Users/tien.h.nguyen/Downloads/ryziz-master_2/packages/cli/src/build.js` for route priority sorting. This is critical for correct route matching (static routes before dynamic routes).

**Generated Virtual Routes:**
```javascript
// virtual:routes
import Page0 from '/absolute/path/to/src/pages.index.jsx';
import Page1 from '/absolute/path/to/src/pages.about.jsx';
import Page2 from '/absolute/path/to/src/pages.posts.$id.jsx';

export default [
  { path: '/', component: Page0 },
  { path: '/about', component: Page1 },
  { path: '/posts/:id', component: Page2 }
];
```

---

### Backend Routes (api.*)

**Pattern:** `api.<route>.js`

**Mapping Rules:**
```
api.index.js                    → /api/          (Function: api-index)
api.posts.js                    → /api/posts     (Function: api-posts)
api.posts.$id.js                → /api/posts/:id (Function: api-posts)
api.users.$id.orders.js         → /api/users/:id/orders (Function: api-users)
```

**Function Naming (Level-2 Grouping):**

Routes are grouped by their **level-2 segment** (first segment after `api.`):

```
api.index.js                    → exports['api-index']
api.posts.js                    → exports['api-posts']  (group: posts)
api.posts.$id.js                → exports['api-posts']  (group: posts)
api.users.$id.js                → exports['api-users']  (group: users)
api.users.$id.orders.js         → exports['api-users']  (group: users)
```

**Grouping Logic:**
- All routes starting with `api.posts` → 1 function `api-posts`
- All routes starting with `api.users` → 1 function `api-users`
- `api.index` → 1 function `api-index`

**Benefits:**
- **Per-group config**: Each function group can have different memory/timeout
- **Manageable function count**: ~10 functions instead of hundreds
- **Firebase rewrites**: Dynamic generation based on function groups

**HTTP Method Exports:**
```javascript
// src/api.posts.$id.js

export const config = {
  memory: '512MB',
  timeout: 60,
  region: 'us-central1'
};

export const GET = async (req, res) => {
  const { id } = req.params;
  res.json({ id, title: 'Post title' });
};

export const POST = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  res.json({ id, title });
};

export const PUT = async (req, res) => { ... };
export const DELETE = async (req, res) => { ... };
export const PATCH = async (req, res) => { ... };
```

**Generated Virtual Routes:**
```javascript
// virtual:api-routes
import * as apiModule0 from '/absolute/path/to/src/api.index.js';
import * as apiModule1 from '/absolute/path/to/src/api.posts.js';
import * as apiModule2 from '/absolute/path/to/src/api.posts.$id.js';
import * as apiModule3 from '/absolute/path/to/src/api.users.$id.js';

export default [
  {
    path: '/api/',
    functionName: 'api-index',    // Firebase Function name
    module: apiModule0
  },
  {
    path: '/api/posts',
    functionName: 'api-posts',    // Same function as below
    module: apiModule1
  },
  {
    path: '/api/posts/:id',
    functionName: 'api-posts',    // Grouped with above
    module: apiModule2
  },
  {
    path: '/api/users/:id',
    functionName: 'api-users',    // Different function group
    module: apiModule3
  }
];
```

---

### Webhooks (webhooks.*)

**Pattern:** `webhooks.<name>.js` (Shopify only)

**Mapping:**
```
webhooks.app-uninstalled.js     → APP_UNINSTALLED topic
webhooks.orders-create.js       → ORDERS_CREATE topic
```

**File Structure:**
```javascript
// src/webhooks.app-uninstalled.js

export const TOPIC = 'APP_UNINSTALLED';

export default async function handle(topic, shop, body) {
  console.log('Webhook received:', { topic, shop, body });
  // Handle webhook logic
}
```

**Generated Virtual Module:**
```javascript
// virtual:webhooks
import * as webhook0 from '/absolute/path/to/src/webhooks.app-uninstalled.js';

export default {
  [webhook0.TOPIC]: webhook0.default
};
```

**Auto-Registration:**
- CLI scans `src/webhooks.*.js` files
- Extracts `TOPIC` export
- Updates `shopify.app.toml` with webhook URLs
- Registers webhooks via Shopify CLI during dev/deploy

---

## Build System

### esbuild Configuration

**Two Separate Builds:**
1. **Frontend Build** (React app)
2. **Backend Build** (Firebase Functions)

---

### Frontend Build

**Entry Point:** `@ryziz-firebase/router/entry.jsx`

**Output:** `dist/public/`

**Config:**
```javascript
{
  entryPoints: {
    index: '@ryziz-firebase/router/entry.jsx'
  },
  bundle: true,
  outdir: 'dist/public',
  splitting: true,
  format: 'esm',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch,
  plugins: [
    virtualPageRoutesPlugin(),   // Generate virtual:routes
    copyPublicPlugin(),          // Copy public/ to dist/public/
    injectApiKeyPlugin()         // Replace %SHOPIFY_API_KEY% (Shopify only)
  ]
}
```

**Plugins:**

1. **virtualPageRoutesPlugin:**
   - Scans `src/pages.*.jsx` and `src/app.*.jsx`
   - Sorts routes using Ryziz sorting logic (static before dynamic)
   - Generates virtual module `virtual:routes`
   - Returns array of `{ path, component }`

2. **copyPublicPlugin:**
   - Copies `public/` to `dist/public/`
   - Preserves directory structure

3. **injectApiKeyPlugin:** (Shopify only)
   - Replaces `%SHOPIFY_API_KEY%` in HTML files

---

### Backend Build

**Entry Point:** `@ryziz-firebase/functions/entry.js` or `@ryziz-firebase/shopify/entry.js`

**Output:** `dist/functions/`

**Config:**
```javascript
{
  entryPoints: {
    index: '@ryziz-firebase/functions/entry.js'
  },
  bundle: true,
  outdir: 'dist/functions',
  format: 'cjs',
  platform: 'node',
  external: [
    'firebase-admin',
    'firebase-functions',
    // ... other dependencies
  ],
  minify: !watch,
  sourcemap: watch,
  plugins: [
    virtualApiRoutesPlugin(),    // Generate virtual:api-routes
    virtualWebhooksPlugin(),     // Generate virtual:webhooks (Shopify only)
    generatePackageJsonPlugin(), // Create package.json
    copyFirebaseConfigPlugin()   // Generate firebase.json, copy .firebaserc
  ]
}
```

**Plugins:**

1. **virtualApiRoutesPlugin:**
   - Scans `src/api.*.js`
   - Extracts level-2 segment for function grouping (e.g., `api.posts.$id.js` → group: `posts`)
   - Generates virtual module `virtual:api-routes`
   - Returns array of `{ path, functionName, module }` where:
     - `path`: Express route path (e.g., `/api/posts/:id`)
     - `functionName`: Firebase Function name (e.g., `api-posts`)
     - `module`: Imported module with HTTP methods and config

2. **virtualWebhooksPlugin:** (Shopify only)
   - Scans `src/webhooks.*.js`
   - Extracts `TOPIC` from each file
   - Generates virtual module `virtual:webhooks`

3. **generatePackageJsonPlugin:**
   - Creates `dist/functions/package.json`
   - Includes only production dependencies
   - Sets `type: "commonjs"`

4. **copyFirebaseConfigPlugin:**
   - Auto-generates `firebase.json` with dynamic rewrites:
     - For each function group (level-2 segment), creates rewrite rules
     - Sorts rewrites from most specific to least specific
     - Adds static rewrites for Shopify (auth, webhooks, app routes)
     - Adds catch-all SPA rewrite
   - Copies `.firebaserc` if exists (or generates demo project for dev)
   - Copies `firestore.rules` if exists

---

### Watch Mode

```javascript
const ctx = await esbuild.context(buildOptions);
await ctx.watch();
```

**Watches:**
- `src/pages.*.jsx` - Rebuild frontend
- `src/app.*.jsx` - Rebuild frontend
- `src/api.*.js` - Rebuild functions
- `src/webhooks.*.js` - Rebuild functions
- `public/**` - Copy to dist

---

## CLI Commands

### 1. `ryziz dev`

**Purpose:** Start development server with Firebase emulators.

**Usage:**
```bash
ryziz dev
ryziz dev --config staging  # For multiple shopify.app*.toml
```

**Steps:**

1. Detect template type (check if `shopify.app.toml` exists)

2. If Shopify:
   - Check for multiple `shopify.app*.toml` configs
   - If `--config` flag: use specified config
   - Else: use default `shopify.app.toml`
   - Start Cloudflare tunnel
   - Fetch Shopify credentials via Shopify CLI
   - Write credentials to `dist/functions/.env` (auto-generated, gitignored)

3. Build frontend (watch mode)

4. Build backend (watch mode)

5. Auto-generate `firebase.json` with rewrites

6. Auto-generate `.firebaserc` with demo project:
   ```json
   {
     "projects": {
       "default": "demo-ryziz-firebase"
     }
   }
   ```

7. Start Firebase emulators:
   - Functions: `localhost:5001`
   - Hosting: `localhost:5000`
   - Firestore: `localhost:8080`
   - UI: `localhost:4000`

8. If Shopify:
   - Scan webhooks and update `shopify.app.toml`
   - Deploy app config via Shopify CLI

**Console Output:**
```
Building frontend...
✓ Frontend built

Building functions...
✓ Functions built

Starting Firebase emulators...
✓ Functions emulator: http://localhost:5001
✓ Hosting emulator: http://localhost:5000
✓ Firestore emulator: http://localhost:8080
✓ Emulator UI: http://localhost:4000

Ready! Open http://localhost:5000
```

---

### 2. `ryziz build`

**Purpose:** Build for production.

**Usage:**
```bash
ryziz build
ryziz build --watch  # Watch mode for testing
```

**Steps:**
1. Build frontend (production, minified, no sourcemap)
2. Build backend (production, minified, no sourcemap)
3. Auto-generate `firebase.json`
4. Generate `dist/functions/package.json`

**Console Output:**
```
Building frontend...
✓ Frontend built (123 KB)

Building functions...
✓ Functions built (456 KB)

Build complete! Output in dist/
```

---

### 3. `ryziz deploy`

**Purpose:** Deploy to Firebase.

**Prerequisites:**
- User must have `.firebaserc` in project root (created manually via `firebase use --add`)
- User must be logged in: `firebase login`
- User must have Firebase project with Blaze plan

**Usage:**
```bash
ryziz deploy
```

**Steps:**
1. Run production build

2. If Shopify:
   - Fetch production Shopify credentials
   - Update `shopify.app.toml` with production URL
   - Deploy Shopify app config

3. Install production dependencies:
   ```bash
   npm install --production
   ```
   (in `dist/functions/`)

4. Deploy to Firebase:
   ```bash
   firebase deploy --only hosting,functions
   ```

**Console Output:**
```
Building for production...
✓ Build complete

Installing dependencies...
✓ Dependencies installed

Deploying to Firebase...
✓ Hosting: https://your-project.web.app
✓ Functions: 3 deployed

Deployment complete!
```

---

## Development Workflow

### Default Template

**1. Create Project:**
```bash
npx @ryziz-firebase/create-react my-app
cd my-app
npm install
```

**2. Start Development:**
```bash
npm run dev
```

**3. Add Routes:**

Frontend route:
```jsx
// src/pages.about.jsx
export default function About() {
  return <h1>About Page</h1>;
}
// Available at http://localhost:5000/about
```

API route:
```javascript
// src/api.users.$id.js
export const GET = async (req, res) => {
  res.json({ userId: req.params.id });
};
// Available at http://localhost:5000/api/users/123
```

---

### Shopify Template

**1. Create Project:**
```bash
npx @ryziz-firebase/create-shopify my-shopify-app
cd my-shopify-app
npm install
```

**2. Setup Shopify App:**
- Create app in Shopify Partners
- Update `shopify.app.toml` with `client_id`

**3. Start Development:**
```bash
npm run dev
```

**4. Add Shopify API:**
```javascript
// src/api.products.js
import { withShopify } from '@ryziz-firebase/shopify';

export const GET = withShopify(async (req, res) => {
  const products = await req.shopify.graphql(`
    query {
      products(first: 10) {
        edges {
          node { id title }
        }
      }
    }
  `);
  res.json(products);
});
```

**5. Add Webhook:**
```javascript
// src/webhooks.orders-create.js
export const TOPIC = 'ORDERS_CREATE';

export default async function handle(topic, shop, body) {
  console.log('New order:', body);
}
```

---

## Deployment Workflow

### Prerequisites

1. **Create Firebase Project:**
   - Go to https://console.firebase.google.com
   - Create new project
   - Upgrade to Blaze plan

2. **Login & Link:**
   ```bash
   firebase login
   firebase use --add
   ```

### Deploy

```bash
npm run deploy
```

---

## Release Automation

### Versioning Strategy

**Version:** `1.0.0` (SemVer)

**Scope:** All packages share the same version.

**Bump Strategy:** Automatic patch version bump on every commit.

---

### Git Hook (Pre-commit)

**Setup:** Runs via `postinstall` script.

**Root package.json:**
```json
{
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "postinstall": "node scripts/release.js setup"
  }
}
```

**Hook installs:** `.git/hooks/pre-commit`

**Hook content:**
```bash
#!/bin/sh
node scripts/release.js bump
```

---

### Bump Logic

**Script:** `scripts/release.js bump`

**Steps:**
1. Get staged files: `git diff --cached --name-only`
2. Filter to `packages/*/package.json` and `templates/*/package.json`
3. For each changed package:
   - Bump patch version: `1.0.0` → `1.0.1`
4. Update dependent packages with `^` prefix
5. Stage modified `package.json` files

---

### Publish Logic

**Trigger:** Automatic on push to `master` branch.

**Workflow:** `.github/workflows/publish.yml`

```yaml
name: Publish to NPM

on:
  push:
    branches:
      - master

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm install

      - run: node scripts/release.js publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Publish script:**
1. Get last commit files
2. Filter to changed packages
3. Publish packages first, then templates
4. For templates: rename `.gitignore` → `gitignore` before publish, restore after

---

## Implementation Plan

### Phase 1: Monorepo Setup

**Tasks:**
1. Create root directory structure
2. Create root `package.json` (private, workspaces)
3. Create `.gitignore`
4. Create `scripts/release.js` (basic structure)
5. Create `.github/workflows/publish.yml`
6. Initialize git repository

**Deliverables:**
- Root `package.json`
- `scripts/release.js`
- `.github/workflows/publish.yml`

---

### Phase 2: CLI Package (Basic)

**Tasks:**
1. Create `packages/cli/` structure
2. Create `package.json`
3. Create `index.js` with commander
4. Implement `commands/init.js` (detectTemplate, initTemplate)
5. Test locally: `npm link`

**Deliverables:**
- `packages/cli/` with init command
- Functional template detection

---

### Phase 3: Create React Template

**Tasks:**
1. Create `templates/create-react/` structure
2. Create `package.json` with bin field
3. Create sample files:
   - `public/index.html`
   - `src/pages.index.jsx`
   - `src/api.index.js`
4. Test: `npx @ryziz-firebase/create-react my-app`

**Deliverables:**
- Working template creation

---

### Phase 4: Router Package

**Tasks:**
1. Create `packages/router/` structure
2. Create `package.json`
3. Create `index.js` (re-exports)
4. Create `entry.jsx`
5. Install dependencies: `npm install react-router react-dom`

**Deliverables:**
- `packages/router/` complete

---

### Phase 5: Build System (Frontend)

**Tasks:**
1. Install esbuild in CLI package
2. Create `build/pages.js`
3. Create `build/plugins.js`
4. Implement `virtualPageRoutesPlugin`
5. Implement `copyPublicPlugin`
6. Test: Build sample pages

**Deliverables:**
- Working frontend build
- `dist/public/` output

---

### Phase 6: Functions Package

**Tasks:**
1. Create `packages/functions/` structure
2. Create `package.json`
3. Create `index.js` (export db)
4. Create `entry.js` (export createApiApp)
5. Create base `firebase.json`
6. Install dependencies

**Deliverables:**
- `packages/functions/` complete

---

### Phase 7: Build System (Backend)

**Tasks:**
1. Create `build/api.js`
2. Implement `virtualApiRoutesPlugin`
3. Implement `generatePackageJsonPlugin`
4. Implement `copyFirebaseConfigPlugin`
5. Test: Build sample API

**Deliverables:**
- Working backend build
- `dist/functions/` output

---

### Phase 8: Dev Command

**Tasks:**
1. Implement `commands/dev.js`
2. Integrate frontend + backend builds in watch mode
3. Auto-generate `firebase.json` with rewrites
4. Auto-generate `.firebaserc` with demo project
5. Start Firebase emulators
6. Test: Full dev workflow

**Deliverables:**
- Working `ryziz dev` command

---

### Phase 9: Build & Deploy Commands

**Tasks:**
1. Implement `commands/build.js`
2. Implement `commands/deploy.js`
3. Test: Build + deploy workflow

**Deliverables:**
- Working `ryziz build` and `ryziz deploy`

---

### Phase 10: Shopify Package

**Tasks:**
1. Create `packages/shopify/` structure
2. Create all files (index, entry, shopify, middleware)
3. Install dependencies
4. Test: Basic Shopify integration

**Deliverables:**
- `packages/shopify/` complete

---

### Phase 11: Shopify Dev Integration

**Tasks:**
1. Update `commands/dev.js` for Shopify
2. Add Cloudflare tunnel integration
3. Add Shopify CLI credential fetching
4. Add webhook scanning
5. Implement `injectApiKeyPlugin`
6. Test: Full Shopify dev workflow

**Deliverables:**
- Shopify dev mode working

---

### Phase 12: Create Shopify Template

**Tasks:**
1. Create `templates/create-shopify/` structure
2. Create all files (package.json, shopify.app.toml, etc)
3. Test: Full Shopify template workflow

**Deliverables:**
- Working Shopify template

---

### Phase 13: Release Automation

**Tasks:**
1. Complete `scripts/release.js`
2. Test git hook installation
3. Test version bumping
4. Setup GitHub secrets
5. Test publish workflow

**Deliverables:**
- Working release automation

---

### Phase 14: Polish & Documentation

**Tasks:**
1. Write README.md
2. Add error handling
3. Add CLI help messages
4. Create example projects
5. Test all workflows end-to-end

**Deliverables:**
- Complete documentation
- Production-ready framework

---

## Next Steps

1. **Review & Approve** this architecture document
2. **Setup development environment**
3. **Start Phase 1** - Monorepo setup
4. **Iterate through phases**
5. **Test & publish**

---

**End of Architecture Document**

Ready for implementation! 🚀
