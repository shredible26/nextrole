export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d0d12] flex flex-col flex-1">
      {children}
    </div>
  );
}
