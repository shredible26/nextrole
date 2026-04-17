export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#0d0d12]">
      {children}
    </div>
  );
}
