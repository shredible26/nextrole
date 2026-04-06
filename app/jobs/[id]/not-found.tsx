export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Job not found</h1>
      <p className="text-muted-foreground">This job may have been filled or removed.</p>
      <a href="/jobs" className="text-primary hover:underline">Browse all jobs →</a>
    </div>
  )
}
