import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { SUPPORTED_IMPORT_FORMATS } from '../config/constants';
import { validateFileSize, detectFormat } from '../utils/fileUtils';

export function FileDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const importModel = useStore(s => s.importModel);
  const addToast = useStore(s => s.addToast);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only stop dragging when leaving the window
    if (e.relatedTarget === null) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    // Validate format
    const format = detectFormat(file.name);
    if (!format) {
      addToast('error', `Unsupported format. Supported: ${SUPPORTED_IMPORT_FORMATS.join(', ')}`);
      return;
    }

    // Validate size
    const sizeCheck = validateFileSize(file.size);
    if (!sizeCheck.valid) {
      addToast('error', sizeCheck.message!);
      return;
    }
    if (sizeCheck.warning) {
      addToast('warning', sizeCheck.message!);
    }

    await importModel(file);
  }, [importModel, addToast]);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  if (!isDragging) return null;

  return (
    <div className="file-drop-overlay">
      <div className="drop-zone dragging" style={{ pointerEvents: 'none' }}>
        <div className="drop-zone-icon">📁</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-accent)' }}>
          Drop to load model
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {SUPPORTED_IMPORT_FORMATS.join('  ')}
        </div>
      </div>
    </div>
  );
}
