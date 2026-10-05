import { Loader2 } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-nwis-text-secondary w-full h-full min-h-[200px]">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-nwis-primary" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
