// Re-mounts on every route change → soft macOS-style cross-view fade.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
