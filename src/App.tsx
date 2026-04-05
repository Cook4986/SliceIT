import { useStore } from './store/useStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Header } from './components/Header';
import { MainContent } from './layouts/MainContent';
import { EmptyState } from './components/EmptyState';
import { FileDropZone } from './components/FileDropZone';
import { ToastContainer } from './components/ToastContainer';
import { StatusBar } from './components/StatusBar';
import { FloatingInspector } from './components/FloatingInspector';
import { DebugConsole } from './components/DebugConsole';

export default function App() {
  const hasModel = useStore(s => s.model.geometry !== null);

  useKeyboardShortcuts();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
    </div>
  );
}
