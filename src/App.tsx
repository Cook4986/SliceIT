import { useStore } from './store/useStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsMobile } from './hooks/useIsMobile';
import { MobilePlaceholder } from './components/MobilePlaceholder';
import { Header } from './components/Header';
import { MainContent } from './layouts/MainContent';
import { EmptyState } from './components/EmptyState';
import { FileDropZone } from './components/FileDropZone';
import { ToastContainer } from './components/ToastContainer';
import { StatusBar } from './components/StatusBar';
import { FloatingInspector } from './components/FloatingInspector';
import { DebugConsole } from './components/DebugConsole';
import { ExportModal } from './components/ExportModal';
import { BusyOverlay } from './components/BusyOverlay';
import { ShortcutHelp } from './components/ShortcutHelp';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const isMobile = useIsMobile();

  // On mobile we render ONLY the placeholder. Keeping the desktop tree in its
  // own component means its hooks, global listeners, Three.js canvases and
  // slicing workers never mount on phones.
  if (isMobile) {
    return <MobilePlaceholder />;
  }

  return <DesktopApp />;
}

function DesktopApp() {
  const hasModel = useStore(s => s.model.geometry !== null);

  useKeyboardShortcuts();

  return (
    <div className="app-root">
      <Header />
      {hasModel ? (
        <>
          <MainContent />
          <StatusBar />
        </>
      ) : (
        <EmptyState />
      )}
      <FileDropZone />
      <ToastContainer />
      <FloatingInspector />
      <DebugConsole />
      <ExportModal />
      <BusyOverlay />
      <ShortcutHelp />
      <SettingsModal />
    </div>
  );
}
