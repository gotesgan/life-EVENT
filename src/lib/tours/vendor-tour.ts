import type { TourDefinition } from './types';

/**
 * The vendor walkthrough, shown on the public registration page.
 *
 * This one does not navigate: the whole story happens on one page, and the
 * steps that matter are the four fields, the submit button and what happens
 * after it. The final step is a centred card, so the tour explains the process
 * the business cannot see yet — the call, the onboarding link and the review
 * that precede a published listing.
 */
export const VENDOR_TOUR: TourDefinition = {
  id: 'vendor',
  title: 'How listing works',
  storageKey: 'lifeevents.tour.vendor.v1',
  steps: [
    {
      id: 'welcome',
      title: 'Get your business listed',
      body: 'Four fields now, a phone call next, then your own listing form. Nothing is published until you have seen and approved the details. This short tour shows what each part does.',
    },
    {
      id: 'form',
      title: 'The four fields',
      body: 'Business name, what kind of vendor you are, a contact number and a short description of what you offer. That is deliberately all: documents, prices and photos come later, once the team has spoken to you.',
      target: '[data-tour="vendor-form"]',
      path: '/partner-with-us',
      placement: 'left',
    },
    {
      id: 'submit',
      title: 'Send the form',
      body: 'This is the only click needed today. Nothing is stored until you press it, and a failed submission shows the field that needs fixing rather than losing the form.',
      target: '[data-tour="vendor-form-submit"]',
      path: '/partner-with-us',
      placement: 'top',
    },
    {
      id: 'next',
      title: 'What happens next',
      body: 'First the team calls the number you gave to confirm the business. Then you receive a private, single-use link to a longer form where you add prices, capacity and photos yourself. A person checks the result and publishes the listing — only then do customers see it.',
      target: '[data-tour="vendor-form-steps"]',
      path: '/partner-with-us',
      placement: 'right',
    },
    {
      id: 'done',
      title: 'Ready when you are',
      body: 'You can start the form now, or come back to this page later. If anything changes, reply to the email you receive from the team.',
    },
  ],
};
