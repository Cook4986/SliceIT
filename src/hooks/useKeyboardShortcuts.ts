import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { ToolType } from '../types/store';

/**
 * Global keyboard shortcut handler.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const store = useStore.getState();
      const target = e.target as HTMLElement;

      // Ignore when typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z — Undo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z — Redo
      if ((ctrl && e.key === 'y') || (ctrl && e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        store.redo();
        return;
      }

      // Skip if modifier keys are pressed (except for the above)
      if (ctrl || e.altKey) return;

      // Tool shortcuts
      const toolMap: Record<string, ToolType> = {
        b: 'box',
        s: 'sphere',
        p: 'plane',
        k: 'knife',
        l: 'lasso',
      };

      const key = e.key.toLowerCase();

      if (toolMap[key] && store.model.geometry) {
        e.preventDefault();
        const newTool = store.tool.activeTool === toolMap[key] ? null : toolMap[key];
        store.setActiveTool(newTool);
        return;
      }

      // Transform mode shortcuts
      if (key === 'g') { store.setTransformMode('translate'); return; }
      if (key === 'r') { store.setTransformMode('rotate'); return; }
      if (key === 't') { store.setTransformMode('scale'); return; }

      // View selection (1-9)
      if (/^[1-9]$/.test(key)) {
        store.setActiveView(parseInt(key) - 1);
        return;
      }

      // Enter — Execute slice
      if (key === 'enter' && store.tool.activeTool && store.model.geometry) {
        e.preventDefault();
        store.executeSlice();
        return;
      }

      // Escape — Cancel drawing / deselect tool
      if (key === 'escape') {
        if (store.tool.isDrawing) {
          store.cancelDrawing();
        } else {
          store.setActiveTool(null);
        }
        return;
      }

      // Delete — Clear tool
      if (key === 'delete' || key === 'backspace') {
        store.setActiveTool(null);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
