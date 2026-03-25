# Slice It! — UI/UX Design Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-23  

---

## 1. Visual Identity & Aesthetics

The design of "Slice It!" follows a **Cyber-Industrial** aesthetic. It should feel like high-end CAD software (like Fusion 360 or Blender) but with the accessibility and vibrance of a modern web application.

### 1.1 Color Palette (Dark Mode Primary)

| Layer | Color | Hex | Purpose |
|---|---|---|---|
| **Background (Depth 0)** | Midnight Navy | `#050508` | Deepest base background |
| **Surface (Depth 1)** | Obsidian | `#0d0d14` | Viewport backgrounds, Sidebar |
| **Surface (Depth 2)** | Iron | `#1a1a24` | Toolbar, Modals, Popovers |
| **Accent (Primary)** | Electric Cyan | `#06b6d4` | Active states, Highlight glow, Primary buttons |
| **Accent (Secondary)** | Indigo Ghost | `#6366f1` | Secondary indicators, Hover states |
| **Success** | Emerald Sky | `#10b981` | Apply Slice, Export success |
| **Danger** | Red Alert | `#ef4444` | Negative space primitives, Error toasts |
| **Border (Subtle)** | Steel | `#2a2a3e` | Common borders, separators |

### 1.2 Typography

- **Primary Font**: [Inter](https://fonts.google.com/specimen/Inter) — Clean, legible, and professional for UI controls.
- **Monospace Font**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — For vertex counts, coordinate displays, and status text.

### 1.3 Material Effects

- **Glassmorphism**: Modals and Floating Panels use a 60% opaque background with a 12px backdrop-blur.
- **Gradients**: Subtle linear gradients (e.g., `Obsidian` to `Iron`) on larger surfaces to avoid flat, "cheap" looks.
- **Inner Shadows**: Used on the Viewport Grid cells to create a "recessed" industrial feel.

---

## 2. Layout & Workspace

### 2.1 The 9-View Grid

The core of the application is the 3x3 grid.
- **Outer Margin**: 4px gap between viewports.
- **Active State**: The active viewport has a `2px solid Electric Cyan` border with a `0 0 15px rgba(6, 182, 212, 0.4)` outer glow.
- **Ortho Indicators**: Each viewport has a small 3D triad (X, Y, Z axes) in the bottom-left corner.

### 2.2 Floating Toolbar

Located at the top, centered.
- **Sleek Pill Shape**: Rounded corners (`full`) with a glass-blur background.
- **Micro-interactions**: Subtle `scale-105` on hover, and a tiny `translate-y-px` on click for tactile feedback.

### 2.3 Side Panels (Collapsible)

- **Left Panel**: Tools & Properties.
- **Right Panel**: Outliner (Layer Management) & Export Settings.
- Panels should slide out smoothly using Framer Motion animations.

---

## 3. Interaction Design

### 3.1 Primitive Placement

When a user clicks "Box Cut":
1. The tool button glows.
2. A semi-transparent red box pulses into existence at the center of the model.
3. A "Ghost" clipping preview instantly shows what the model *would* look like if cut.
4. TransformControls (Gizmo) fade in smoothly around the box.

### 3.2 Drawing (Knife/Lasso)

- **Lasso Trail**: As the user drags, the line should have a "neon glow" effect (cyan shadow) to make it highly visible against complex models.
- **Point Snapping**: When using the Knife tool, the cursor should subtly snap to existing vertices on the model mesh (visualized by a small circle).

### 3.3 The "Slice!" Execution

When the user clicks "Slice!":
1. The model should briefly "glitch" or pulse with a cyan highlight.
2. A sleek progress ring appears in the center of the screen (blurring the background).
3. On completion, a subtle "shwink" sound effect (optional) and the new geometry fades in while the old one fades out over 200ms.

---

## 4. Animation Principles

- **Duration**: Fast but visible. `200ms` for UI transitions, `400ms` for panel slides.
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (Standard Out-Sine) for most movements.
- **Feedback**: Every click must result in a visual change (color shift, scale, or ripple).

---

## 5. Mobile & Tablet Adaptations

- **Tablet (2x2)**: Shows Top, Front, Right, and Perspective only. Others move to a "More Views" picker.
- **Mobile (1x1)**: Single viewport with a carousel/tab-bar at the bottom to switch views.
- **Touch Targets**: All toolbar buttons expanded to `44x44px` minimum.
