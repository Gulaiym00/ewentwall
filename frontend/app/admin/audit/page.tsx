import type { Metadata } from 'next';
import AdminAudit from '@/components/pages/admin/audit';

export const metadata: Metadata = { title: 'Audit log' };

export default function Page() {
  return <AdminAudit />;
}
