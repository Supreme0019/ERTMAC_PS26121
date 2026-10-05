import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({ message = 'An error occurred', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-red-500 w-full h-full min-h-[200px]">
      <AlertTriangle className="w-8 h-8 mb-4" />
      <p className="text-sm font-medium mb-4 text-center max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
