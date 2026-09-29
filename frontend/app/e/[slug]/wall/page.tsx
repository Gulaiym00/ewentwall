import type { Metadata } from 'next';
import PhotoWall from '@/components/pages/photo-wall';

export const metadata: Metadata = { title: 'Live wall · EventWall', robots: { index: false } };

export default async function Page({ params }: PageProps<'/e/[slug]/wall'>) {
  const { slug } = await params;
  return <PhotoWall slug={slug} />;
}
