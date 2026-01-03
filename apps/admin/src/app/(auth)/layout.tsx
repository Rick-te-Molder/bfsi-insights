import type { ReactNode } from 'react';

// Auth layout - no sidebar, centered content
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
