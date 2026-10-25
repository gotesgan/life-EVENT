import type { TourDefinition } from './types';

/**
 * The admin walkthrough.
 *
 * Ordered as an operator actually works: watch the queue, onboard supply, then
 * triage the leads that supply produces. Steps that navigate carry a `path`, so
 * the tour crosses pages while staying a single continuous overlay — the engine
 * lives in the admin shell, which stays mounted across route changes.
 *
 * Targets are ordinary links and page sections rather than special tour ids
 * wherever possible, so the tour teaches the interface a user will actually see.
 */
export const ADMIN_TOUR: TourDefinition = {
  id: 'admin',
  title: 'Admin walkthrough',
  storageKey: 'lifeevents.tour.admin.v1',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to the back office',
      body: 'This is where the marketplace is run: onboarding businesses, approving listings and answering enquiries. Takes about two minutes. You can leave at any point with the Skip button or the Esc key.',
    },
    {
      id: 'overview',
      title: 'Start with the overview',
      body: 'The dashboard counts the work waiting for you — new enquiries, pending applications and listings that still need review. The badge on Enquiries is the number nobody has picked up yet.',
      target: 'a[href="/admin"]',
      path: '/admin',
      placement: 'right',
    },
    {
      id: 'vendor-applications-nav',
      title: 'Supply lives here',
      body: 'Vendor applications is where businesses ask to be listed. Open it with a click — the tour will follow you.',
      target: 'a[href="/admin/vendor-applications"]',
      path: '/admin',
      placement: 'right',
    },
    {
      id: 'invite-form',
      title: 'Send the vendor a form',
      body: 'Enter the business email and create a single-use onboarding link. The business fills in its own details — name, category, city, contact, prices and photos — without an account. Copy the link once; it expires in fourteen days and can be revoked.',
      target: '[data-tour="vendor-invite-form"]',
      path: '/admin/vendor-applications',
      placement: 'bottom',
    },
    {
      id: 'applications-list',
      title: 'Review what came back',
      body: 'Submissions appear here with their source and contact details. Mark one reviewing, reject it with a note, or approve it: approving creates a draft listing and opens the editor. A second approval is refused, so a business cannot be duplicated.',
      target: '[data-tour="vendor-applications-list"]',
      path: '/admin/vendor-applications',
      placement: 'top',
    },
    {
      id: 'finish-listing',
      title: 'Finish the listing',
      body: 'The draft opens in the listing editor, where the team checks prices, capacity, photos and published contact details before publishing. Until it is published it is invisible to customers.',
      target: 'a[href="/admin/listings"]',
      path: '/admin/vendor-applications',
      placement: 'right',
    },
    {
      id: 'enquiry-filters',
      title: 'Finding an enquiry',
      body: 'The enquiry inbox is every customer brief. Search by reference, email or name; filter by status, assignee, category or listing; date windows narrow it further. These filters live in the URL, so a filtered view can be bookmarked or sent to a colleague.',
      target: '[data-tour="enquiry-filters"]',
      path: '/admin/enquiries',
      placement: 'bottom',
    },
    {
      id: 'enquiry-inbox',
      title: 'Handling a query',
      body: 'Open an enquiry to see the customer, the event brief and one lead per business. From there you assign an owner, move each lead through its pipeline, add internal notes and share replies with the customer. Selecting several rows lets you change status in bulk.',
      target: '[data-tour="enquiry-inbox"]',
      path: '/admin/enquiries',
      placement: 'top',
    },
    {
      id: 'settings',
      title: 'Settings and integrations',
      body: 'Settings is where the hero video, outbound email identity and Meta Pixel/Conversions API live. Delivery logs sit next to each integration, so a failure is visible instead of silent. This guided tour is always available here.',
      target: '[data-tour="settings-integrations"]',
      path: '/admin/settings',
      placement: 'top',
    },
    {
      id: 'done',
      title: 'That is the whole loop',
      body: 'Supply in, listing published, enquiry answered. Start the tour again any time from Settings → Guided tour, or from the prompt in the corner of the dashboard.',
    },
  ],
};
