# Knife & Lasso Tool Stabilization Report

The anchor placement bug causing clicks to not register or produce spurious anchors has been resolved.

## Root Cause
The `onPointerDown` listener in `ViewCamera.tsx` was attached to a general R3F `<group>`. Because Three.js Raycaster only tests intersections against `Mesh` objects, clicking on empty background space failed to trigger R3F pointer events.

## Fix
1. Removed the dead `onPointerDown` from the generic `<group>` container.
2. Introduced a `visible={false}` invisible `mesh` with a massive `planeGeometry` strictly inside each viewport camera's projection scope.
3. Used quaternions to automatically orient the invisible plane to squarely face the `OrthographicCamera` and `PerspectiveCamera` regardless of whether they view `FRONT`, `TOP`, `ISO 2`, etc.
4. Integrated R3F's `onPointerDown` on this mesh to execute the `addAnchor()` Zustand dispatch sequentially and without relying on buggy DOM event bubbling logic.

## Result
Anchor points place instantly and accurately at the 3D raycast target anywhere within the active viewport grid. Transition to CSG boolean pipeline acts correctly once all required knife coordinates (3 pts) or lasso nodes (>8) are collected.
