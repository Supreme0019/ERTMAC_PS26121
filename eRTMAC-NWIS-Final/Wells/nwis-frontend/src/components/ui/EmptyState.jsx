export function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-nwis-text-secondary w-full h-full min-h-[200px] text-center">
      {Icon && <Icon className="w-12 h-12 mb-4 text-nwis-border" />}
      <h3 className="text-lg font-medium text-nwis-text mb-2">{title}</h3>
      {message && <p className="text-sm max-w-sm">{message}</p>}
    </div>
  );
}
