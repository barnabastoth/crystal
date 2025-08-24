import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { API } from '../../utils/api';

interface InlineEditDiffProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  isDarkMode?: boolean;
  sessionId?: string;
}

export const InlineEditDiff: React.FC<InlineEditDiffProps> = ({
  filePath,
  oldContent,
  newContent,
  isDarkMode = true,
  sessionId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpeningInIDE, setIsOpeningInIDE] = useState(false);

  const handleOpenInIDE = async () => {
    setIsOpeningInIDE(true);
    try {
      const response = await API.ide.openFile({
        sessionId,
        filePath,
        lineNumber: undefined
      });
      
      if (!response.success) {
        console.error('Failed to open file in IDE:', response.error);
      }
    } catch (error) {
      console.error('Error opening file in IDE:', error);
    } finally {
      setIsOpeningInIDE(false);
    }
  };

  const customStyles = {
    variables: {
      dark: {
        diffViewerBackground: '#1a1a1a',
        diffViewerColor: '#e6e6e6',
        addedBackground: '#1e3a1e',
        addedColor: '#86efac',
        removedBackground: '#3a1e1e',
        removedColor: '#fca5a5',
        wordAddedBackground: '#2d5a2d',
        wordRemovedBackground: '#5a2d2d',
        addedGutterBackground: '#1e3a1e',
        removedGutterBackground: '#3a1e1e',
        gutterBackground: '#262626',
        gutterBackgroundDark: '#1a1a1a',
        highlightBackground: '#3a3a3a',
        highlightGutterBackground: '#404040',
        codeFoldGutterBackground: '#1a1a1a',
        codeFoldBackground: '#262626',
        emptyLineBackground: '#1a1a1a',
        gutterColor: '#666666',
        addedGutterColor: '#86efac',
        removedGutterColor: '#fca5a5',
        codeFoldContentColor: '#999999',
        diffViewerTitleBackground: '#262626',
        diffViewerTitleColor: '#e6e6e6',
        diffViewerTitleBorderColor: '#404040',
      },
      light: {
        diffViewerBackground: '#ffffff',
        diffViewerColor: '#212529',
        addedBackground: '#e6ffec',
        addedColor: '#24292e',
        removedBackground: '#ffebe9',
        removedColor: '#24292e',
        wordAddedBackground: '#acf2bd',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdffd8',
        removedGutterBackground: '#ffdce0',
        gutterBackground: '#f6f8fa',
        gutterBackgroundDark: '#f0f1f3',
        highlightBackground: '#fffbdd',
        highlightGutterBackground: '#fff5b1',
        codeFoldGutterBackground: '#f6f8fa',
        codeFoldBackground: '#f1f3f5',
        emptyLineBackground: '#fafbfc',
        gutterColor: '#666666',
        addedGutterColor: '#212529',
        removedGutterColor: '#212529',
        codeFoldContentColor: '#666666',
        diffViewerTitleBackground: '#f6f8fa',
        diffViewerTitleColor: '#212529',
        diffViewerTitleBorderColor: '#d1d5da',
      }
    }
  };

  return (
    <div className="my-2 border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-800 hover:bg-gray-750 cursor-pointer"
           onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-mono text-gray-300">{filePath}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenInIDE();
          }}
          disabled={isOpeningInIDE}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open in IDE"
        >
          <ExternalLink className="w-3 h-3" />
          {isOpeningInIDE ? 'Opening...' : 'Open in IDE'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="max-h-96 overflow-auto">
          <ReactDiffViewer
            oldValue={oldContent}
            newValue={newContent}
            splitView={false}
            useDarkTheme={isDarkMode}
            styles={customStyles}
            hideLineNumbers={false}
            showDiffOnly={true}
            compareMethod="diffLines"
          />
        </div>
      )}
    </div>
  );
};