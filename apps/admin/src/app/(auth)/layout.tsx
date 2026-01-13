import type { ReactNode } from 'react';

// Auth layout - no sidebar, centered content
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
