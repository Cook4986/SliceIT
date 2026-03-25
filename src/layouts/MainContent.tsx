import { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import { useStore } from '../store/useStore';
import { ViewScene } from '../components/ViewScene';
import { useResponsiveViewports } from '../hooks/useResponsiveViewports';

/**
 * MainContent — wraps the viewport grid and the single shared R3F Canvas.
 * Uses Drei <View> to render each viewport into its tracked HTML div.
 * 
 * Dynamic viewport scaling:
 * - < 600px:  1 viewport (Iso)
 * - 600px+:   2 viewports (Top + Iso)  
 * - 1000px+:  4 viewports (Top, Front, Right, Iso)
 * - 1400px+:  9 viewports (full 3×3 grid)
 */
export function MainContent() {
  const layout = useResponsiveViewports();
  const viewRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeView = useStore(s => s.activeViewIndex);
  const setActiveView = useStore(s => s.setActiveView);
  const [mounted, setMounted] = useState(false);

  // Sync refs array length with layout
  useEffect(() => {
    viewRefs.current = Array(layout.configs.length).fill(null);
  }, [layout.configs.length]);

  // Wait for refs to be populated before rendering Canvas
  useEffect(() => {
    // Small delay to ensure refs are assigned after DOM render
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Clamp activeView to valid range when layout changes
  useEffect(() => {
    if (!layout.indices.includes(activeView)) {
      setActiveView(layout.indices[0]);
    }
  }, [layout.indices, activeView, setActiveView]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* HTML Viewport Grid */}
      <div 
        className="viewport-grid" 
        style={{ 
          position: 'relative', 
          zIndex: 1,
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          useStore.getState().setUIState({ 
            showFloatingInspector: true, 
            floatingInspectorPos: [e.clientX, e.clientY] 
          });
        }}
      >
        {layout.configs.map((config, i) => (
          <div
            key={layout.indices[i]}
            ref={el => { viewRefs.current[i] = el; }}
            className={`viewport-panel ${activeView === layout.indices[i] ? 'active' : ''}`}
            onClick={() => setActiveView(layout.indices[i])}
          >
            <span className="viewport-label">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Single shared R3F Canvas */}
      {mounted && (
        <Canvas
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
          }}
          gl={{
            localClippingEnabled: true,
            antialias: true,
            alpha: true,
          }}
          frameloop="always"
          eventSource={containerRef as React.RefObject<HTMLElement>}
          eventPrefix="client"
        >
          {layout.configs.map((config, i) => {
            const ref = viewRefs.current[i];
            if (!ref) return null;
            return (
              <View key={layout.indices[i]} track={{ current: ref }}>
                <ViewScene 
                  viewIndex={layout.indices[i]} 
                  config={config} 
                  isActive={activeView === layout.indices[i]} 
                />
              </View>
            );
          })}
        </Canvas>
      )}
    </div>
  );
}
