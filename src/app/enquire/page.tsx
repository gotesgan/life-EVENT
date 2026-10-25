import { redirect } from 'next/navigation';

/**
 * The old multi-business enquiry page is gone.
 *
 * Every enquiry now belongs to exactly one listing, so it can be triaged,
 * assigned and answered on its own — and the enquiry is what unlocks that
 * listing's name and contact details. Visitors follow the "Send an enquiry"
 * action on a listing, which opens that listing's own form.
 *
 * The route is kept as a permanent redirect rather than a 404 because it existed
 * in the navigation and in shared links; a visitor arriving here wants to pick a
 * business, which is exactly what the directory is for.
 */
export default function EnquirePage() {
  redirect('/vendors');
}
