export const metadata = { title: 'Job — NexTRole' };

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="text-muted-foreground text-sm">Individual job page — coming Week 3 (SEO).</p>
      <p className="text-xs text-muted-foreground mt-2">ID: {params.id}</p>
    </div>
  );
}
