import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function FloatingInspector() {
  const { showFloatingInspector, floatingInspectorPos } = useStore(s => s.ui);
  const setUIState = useStore(s => s.setUIState);
  const activeTool = useStore(s => s.tool.activeTool);
  const executeSlice = useStore(s => s.executeSlice);
  
  // Close when clicking outside
  useEffect(() => {
    if (!showFloatingInspector) return;
    
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the menu
      if ((e.target as HTMLElement).closest('.floating-inspector')) return;
      setUIState({ showFloatingInspector: false });
    };
    
    // Slight delay to prevent immediate close on the opening click
    setTimeout(() => document.addEventListener('click', handleClick), 10);
    return () => document.removeEventListener('click', handleClick);
  }, [showFloatingInspector, setUIState]);

  if (!showFloatingInspector) return null;

  return (
    <div
      className="floating-inspector absolute z-50 bg-[#3B20A1]/95 backdrop-blur border-4 border-[#00FFFF] rounded-3xl p-4 shadow-2xl shadow-[#E800A6]/40 transform -translate-x-1/2 -translate-y-[120%]"
      style={{
        left: floatingInspectorPos[0],
        top: floatingInspectorPos[1],
        boxShadow: '8px 8px 0px #F472B6',
      }}
    >
      <div className="flex flex-col gap-3 min-w-[150px]" style={{ fontFamily: 'var(--font-logo)' }}>
        {activeTool ? (
          <>
            <div className="text-center text-[#E800A6] mb-2 font-black tracking-widest text-lg" style={{ WebkitTextStroke: '1px #00FFFF' }}>
              TOOL OPTIONS
            </div>
            <button
              onClick={() => {
                executeSlice();
                setUIState({ showFloatingInspector: false });
              }}
              className="bg-[#00FF00] text-black border-4 border-[#1a1a2e] rounded-xl px-4 py-2 hover:-translate-y-1 hover:shadow-[4px_4px_0px_#F472B6] transition-all"
            >
              ✅ EXECUTE CUT
            </button>
          </>
        ) : (
          <div className="text-center text-[#00FFFF] mb-2 font-black tracking-widest" style={{ WebkitTextStroke: '1px #3B20A1' }}>
            NO TOOL ACTIVE
          </div>
        )}
        
        <button
          onClick={() => setUIState({ showFloatingInspector: false })}
          className="bg-[#F472B6] text-white border-4 border-[#1a1a2e] rounded-xl px-4 py-2 hover:-translate-y-1 hover:shadow-[4px_4px_0px_#00FFFF] transition-all"
        >
          ❌ CLOSE
        </button>
      </div>
    </div>
  );
}
