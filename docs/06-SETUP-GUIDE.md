# Slice It! — Setup & Configuration Guide

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23

---

## Prerequisites

| Requirement | Minimum Version | Check Command |
|---|---|---|
| **Node.js** | 20.x LTS | `node --version` |
| **npm** | 10.x | `npm --version` |
| **Git** | 2.40+ | `git --version` |
| **Vercel CLI** (optional) | latest | `npx vercel --version` |

---

## 1. Local Repository Setup

### 1.1 Initialize Git Repository

```bash
# Navigate to project directory
cd /Users/matthewcook/Library/CloudStorage/Dropbox/Viz/SliceIT

# Initialize git
git init

# Create the initial branch
git checkout -b main
```

### 1.2 Create `.gitignore`

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Vercel
.vercel

# TailwindCSS
.tailwind/
EOF
```

### 1.3 Scaffold the Vite + React Project

```bash
# Create Vite project in current directory (non-interactive)
npx -y create-vite@latest ./ --template react-ts

# Install core dependencies
npm install three @react-three/fiber @react-three/drei three-mesh-bvh
npm install zustand
npm install manifold-3d
npm install comlink
npm install earcut

# Install TailwindCSS 4
npm install tailwindcss @tailwindcss/vite

# Install dev dependencies
npm install -D @types/three @types/earcut
```

### 1.4 Configure Vite

Replace `vite.config.ts` with:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    headers: {
      // Required for SharedArrayBuffer (manifold3d WASM performance)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          manifold: ['manifold-3d'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },
});
```

### 1.5 Configure TypeScript

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

### 1.6 Configure TailwindCSS 4

Update `src/index.css`:

```css
@import "tailwindcss";

/* === Design Tokens === */
:root {
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-bg-tertiary: #1a1a2e;
  --color-border: #2a2a3e;
  --color-border-active: #06b6d4;
  --color-text-primary: #e4e4e7;
  --color-text-secondary: #a1a1aa;
  --color-accent: #06b6d4;
  --color-accent-hover: #22d3ee;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-tool-fill: rgba(239, 68, 68, 0.25);
  --color-tool-stroke: rgba(239, 68, 68, 0.6);
}
```

### 1.7 Initial Commit

```bash
git add -A
git commit -m "feat: initial project scaffold with Vite + React + Three.js"
```

---

## 2. Remote Repository Setup (GitHub)

### 2.1 Create GitHub Repository

```bash
# Option A: Using GitHub CLI
gh repo create SliceIT --public --source=. --remote=origin

# Option B: Manual
# 1. Go to https://github.com/new
# 2. Create repo named "SliceIT"
# 3. Don't initialize with README (we already have files)
# 4. Copy the remote URL and run:
git remote add origin https://github.com/<YOUR_USERNAME>/SliceIT.git
```

### 2.2 Push to GitHub

```bash
git push -u origin main
```

### 2.3 Create Development Branch

```bash
git checkout -b dev
git push -u origin dev
```

---

## 3. Vercel Deployment Setup

### 3.1 Connect to Vercel

```bash
# Option A: Vercel CLI
npx -y vercel link

# Option B: Vercel Dashboard
# 1. Go to https://vercel.com/new
# 2. Import your GitHub repository
# 3. Vercel auto-detects Vite and configures the build
```

### 3.2 Create `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

### 3.3 Deployment Workflow

| Trigger | Branch | Environment | URL |
|---|---|---|---|
| Push to `main` | `main` | Production | `sliceit.vercel.app` |
| Push to `dev` | `dev` | Preview | `sliceit-dev.vercel.app` |
| Pull Request | `feature/*` | Preview | Auto-generated URL |

---

## 4. Development Workflow

### 4.1 Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4.2 Feature Development Flow

```bash
# 1. Start from dev branch
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b feature/viewport-grid

# 3. Develop and commit
git add -A
git commit -m "feat(viewport): implement 3x3 viewport grid"

# 4. Push feature branch
git push -u origin feature/viewport-grid

# 5. Create Pull Request on GitHub (dev ← feature/viewport-grid)

# 6. After review and merge, clean up
git checkout dev
git pull origin dev
git branch -d feature/viewport-grid
```

### 4.3 Release Flow

```bash
# 1. Merge dev into main for release
git checkout main
git pull origin main
git merge dev

# 2. Tag the release
git tag -a v1.0.0 -m "v1.0 — Initial release"

# 3. Push
git push origin main --tags

# Vercel auto-deploys to production
```

### 4.4 Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## 5. Directory Structure (Post-Setup)

```
SliceIT/
├── docs/                          # Architecture & planning docs
│   ├── 01-ARCHITECTURE.md
│   ├── 02-IMPLEMENTATION-PLAN.md
│   ├── 03-COMPONENT-SPEC.md
│   ├── 04-STATE-MANAGEMENT.md
│   ├── 05-WORKER-CSG-ENGINE.md
│   └── 06-SETUP-GUIDE.md         # This file
│
├── public/                        # Static assets
│   └── favicon.svg
│
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/                # React components
│   ├── store/                     # Zustand store
│   ├── hooks/                     # Custom hooks
│   ├── workers/                   # Web Workers
│   ├── loaders/                   # 3D file loaders
│   ├── exporters/                 # 3D file exporters
│   ├── utils/                     # Utility functions
│   ├── config/                    # Configuration constants
│   └── types/                     # TypeScript type definitions
│
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json
└── README.md
```

---

## 6. Environment Notes

### Browser Requirements

| Feature | Required Browser Version |
|---|---|
| WebGL 2.0 | Chrome 56+, Firefox 51+, Safari 15+, Edge 79+ |
| WebAssembly | Chrome 57+, Firefox 52+, Safari 11+, Edge 16+ |
| Web Workers | All modern browsers |
| SharedArrayBuffer | Chrome 68+, Firefox 79+, Safari 15.2+, Edge 79+ |
| ES Modules in Workers | Chrome 80+, Firefox 114+, Safari 15+, Edge 80+ |

### Known Limitations

1. **Safari**: SharedArrayBuffer requires `Cross-Origin-Isolation` headers and Safari 15.2+.
2. **Firefox**: ES module workers require Firefox 114+. Older versions may need a bundled worker.
3. **Mobile**: Performance will be significantly reduced on mobile GPUs. The 9-view layout falls back to fewer views on small screens.

### Troubleshooting

| Issue | Solution |
|---|---|
| `SharedArrayBuffer is not defined` | Ensure COOP/COEP headers are set in `vite.config.ts` |
| WASM fails to load | Check `optimizeDeps.exclude` includes `manifold-3d` in Vite config |
| Canvas is black | Ensure `localClippingEnabled: true` in Canvas `gl` prop |
| Worker type error | Ensure `worker.format: 'es'` in Vite config |
| Zustand doesn't update views | Use selective subscriptions, not `useStore()` without selector |
