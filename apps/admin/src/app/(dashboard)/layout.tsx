import { Sidebar } from '@/components/ui/sidebar';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-neutral-950">
      <Sidebar />
      {/* Main content: account for mobile header (pt-14) and desktop sidebar (md:ml-64) */}
      <main className="min-h-screen p-4 pt-18 md:ml-64 md:p-6 md:pt-6">{children}</main>
    </div>
  );
}
