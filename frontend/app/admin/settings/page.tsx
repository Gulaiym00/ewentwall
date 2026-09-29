import type { Metadata } from 'next';
import AdminSettings from '@/components/pages/admin/settings';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <AdminSettings />;
}
