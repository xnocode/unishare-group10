import ProductDetailView from '../../product-details/ProductDetailView';
import { DEFAULT_ITEMS } from '../marketplace-data';

export function generateStaticParams() {
  return DEFAULT_ITEMS.map((item) => ({
    id: item.id,
  }));
}

export default async function MarketplaceItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}
