import { redirect } from 'next/navigation';

export const metadata = { title: 'Catalogue' };

/**
 * `/admin/catalogue` has no screen of its own — the catalogue is five separate
 * editors. The sidebar links straight to Categories, but a hand-typed or
 * bookmarked `/admin/catalogue` should still land somewhere useful rather than
 * a 404.
 */
export default function AdminCatalogueIndexPage() {
  redirect('/admin/catalogue/categories');
}
