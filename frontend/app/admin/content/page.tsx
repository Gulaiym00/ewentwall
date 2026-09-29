import type { Metadata } from 'next';
import AdminContent from '@/components/pages/admin/content';

export const metadata: Metadata = { title: 'Website content' };

export default function Page() {
  return <AdminContent />;
}
