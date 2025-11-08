import { useEffect } from 'react';
import Split from 'react-split';
import { Toolbar } from './components/Toolbar';
import { BottomBar } from './components/BottomBar';
import { FileExplorer } from './components/FileExplorer';
import { DocumentViewer } from './components/DocumentViewer';
import { ChatPanel } from './components/ChatPanel';
import { useAppStore } from './stores/appStore';

function App() {
  const { theme } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="h-screen w-screen flex flex-col bg-editor-light dark:bg-editor-dark">
      <Toolbar />
      
      <div className="flex-1 overflow-hidden">
        <Split
          className="flex h-full"
          sizes={[15, 60, 25]}
          minSize={[200, 400, 250]}
          gutterSize={3}
          gutterAlign="center"
          direction="horizontal"
          cursor="col-resize"
        >
          {/* Left Sidebar - File Explorer */}
          <div className="h-full overflow-hidden border-r border-border-light dark:border-border-dark">
            <FileExplorer />
          </div>

          {/* Middle - Document Viewer */}
          <div className="h-full overflow-hidden">
            <DocumentViewer />
          </div>

          {/* Right Sidebar - Chat Panel */}
          <div className="h-full overflow-hidden border-l border-border-light dark:border-border-dark">
            <ChatPanel />
          </div>
        </Split>
      </div>

      <BottomBar />
    </div>
  );
}

export default App;

