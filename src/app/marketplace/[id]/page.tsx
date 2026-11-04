import { Suspense } from 'react';
import ProductDetailView from '../../product-details/ProductDetailView';
import { DEFAULT_ITEMS } from '../marketplace-data';

export function generateStaticParams() {
  return DEFAULT_ITEMS.map((item) => ({
    id: item.id,
  }));
}

async function MarketplaceItemLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}

export default function MarketplaceItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#ffffff' }} />}>
      <MarketplaceItemLoader params={params} />
    </Suspense>
  );
}
