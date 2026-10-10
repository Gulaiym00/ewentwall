import type { Metadata } from 'next';
import AdminSupport from '@/components/pages/admin/support';

export const metadata: Metadata = { title: 'Support' };

export default function Page() {
  return <AdminSupport />;
}
