import { Suspense } from 'react';
import ProductDetailView from '../ProductDetailView';
import { DEFAULT_ITEMS } from '../../marketplace/marketplace-data';

export function generateStaticParams() {
  return DEFAULT_ITEMS.map((item) => ({
    id: item.id,
  }));
}

async function ProductDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#ffffff' }} />}>
      <ProductDetailLoader params={params} />
    </Suspense>
  );
}
