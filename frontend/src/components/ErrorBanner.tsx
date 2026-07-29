interface ErrorBannerProps {
  title?: string;
  message: string;
}

export function ErrorBanner({ title = 'Something failed', message }: ErrorBannerProps) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 opacity-90">{message}</p>
    </div>
  );
}
