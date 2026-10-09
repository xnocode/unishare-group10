import ProductDetailView from '../ProductDetailView';
import { DEFAULT_ITEMS } from '../../marketplace/marketplace-data';

export function generateStaticParams() {
  return DEFAULT_ITEMS.map((item) => ({
    id: item.id,
  }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}
