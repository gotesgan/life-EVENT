'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { Button, type ButtonProps } from '@/components/ui';
import { ListingEnquiryForm, type SelectOption } from './ListingEnquiryForm';
import classes from './EnquiryModal.module.css';

export interface EnquiryModalProps {
  /** Opaque `ul_<id>` reference — never the slug, which would spell the name out. */
  listingRef: string;
  /** True while the trading name is withheld; the form renders its locked copy. */
  hidden: boolean;
  /**
   * Event types are passed on the profile page, where they are already loaded.
   * Cards omit them and the dialog fetches `/api/event-types` when it opens.
   */
  eventTypeOptions?: readonly SelectOption[];
  title?: string;
  triggerLabel?: string;
  triggerVariant?: ButtonProps['variant'];
  triggerSize?: ButtonProps['size'];
  triggerFullWidth?: boolean;
  triggerClassName?: string;
}

/**
 * The enquiry form in a dialog.
 *
 * Rationale: the form is the page's conversion action, but on a profile it sat
 * below a long rail and on a card it was only reachable by navigating away. A
 * dialog keeps the visitor on the surface they were scanning, and Mantine's
 * Modal supplies the accessible contract — focus trap, `aria-modal`, Escape,
 * overlay click — instead of a hand-rolled popover.
 *
 * The form inside is the same `ListingEnquiryForm` used before, with its own
 * heading suppressed because the dialog title already says it. Nothing is
 * submitted until the visitor presses "Send enquiry", and the success panel
 * replaces the form in place.
 */
export function EnquiryModal({
  listingRef,
  hidden,
  eventTypeOptions,
  title = 'Send an enquiry',
  triggerLabel = hidden ? 'Enquire' : 'Send an enquiry',
  triggerVariant = 'primary',
  triggerSize = 'sm',
  triggerFullWidth = false,
  triggerClassName,
}: EnquiryModalProps) {
  const [opened, setOpened] = useState(false);
  const [options, setOptions] = useState<readonly SelectOption[]>(eventTypeOptions ?? []);

  useEffect(() => {
    if (!opened || eventTypeOptions) return;

    let cancelled = false;
    fetch('/api/event-types')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const rows = body?.data;
        if (!Array.isArray(rows)) return;
        setOptions(
          rows
            .filter(
              (row): row is { slug: string; name: string } =>
                typeof row?.slug === 'string' && typeof row?.name === 'string',
            )
            .map((row) => ({ value: row.slug, label: row.name })),
        );
      })
      .catch(() => {
        /* Event type is optional on the enquiry; failing to load it must not
           block the form. */
      });

    return () => {
      cancelled = true;
    };
  }, [opened, eventTypeOptions]);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        fullWidth={triggerFullWidth}
        className={triggerClassName}
        onClick={() => setOpened(true)}
      >
        {triggerLabel}
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={title}
        centered
        size="lg"
        radius="var(--app-radius-card)"
        classNames={{ title: classes.title, body: classes.body, content: classes.content }}
      >
        <ListingEnquiryForm
          listingRef={listingRef}
          eventTypeOptions={options}
          hidden={hidden}
          showHeading={false}
        />
      </Modal>
    </>
  );
}
