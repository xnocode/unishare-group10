import ProductDetailView from './ProductDetailView';

export default async function ProductDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <ProductDetailView productId={id || '1'} />;
}
