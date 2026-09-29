import type { Metadata } from 'next';
import { AdminProvider } from '@/hooks/useAdmin';
import AdminShell from '@/layout/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Admin · EventWall', template: '%s · Admin · EventWall' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
