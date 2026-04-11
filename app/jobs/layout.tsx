export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d12] flex flex-col h-full overflow-hidden">
      {children}
    </div>
  );
}
