export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0d0d12] min-h-0">
      {children}
    </div>
  );
}
