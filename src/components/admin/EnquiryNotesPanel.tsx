'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { postJson, notifyError, notifySuccess } from './api';
import type { AdminEnquiryDetail } from '@/server/dto/enquiry.dto';
import { formatDateTime } from '@/lib/format';
import classes from './Enquiries.module.css';

export interface EnquiryNotesPanelProps {
  enquiryId: string;
  notes: AdminEnquiryDetail['notes'];
  /** Provider leads a note can be attached to. */
  leads: Array<{ value: string; label: string }>;
  onDone?: () => void;
}

/**
 * Private follow-up notes.
 *
 * Notes are internal by default and the UI says so twice: a labelled banner at
 * the top of the panel and a "share with customer" switch that starts off.
 * Sharing is the deliberate exception, because a note is where an administrator
 * writes something the customer must not read.
 */
export function EnquiryNotesPanel({ enquiryId, notes, leads, onDone }: EnquiryNotesPanelProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [enquiryListingId, setEnquiryListingId] = useState<string | null>(null);
  const [shareWithCustomer, setShareWithCustomer] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = body.trim();
    if (trimmed.length < 2) return;

    setBusy(true);
    try {
      await postJson(`/api/admin/enquiries/${enquiryId}/notes`, {
        body: trimmed,
        shareWithCustomer,
        ...(enquiryListingId ? { enquiryListingId } : {}),
      });
      notifySuccess(
        shareWithCustomer ? 'Note added and shared with the customer.' : 'Private note added.',
        'Note saved',
      );
      setBody('');
      setEnquiryListingId(null);
      setShareWithCustomer(false);
      if (onDone) onDone();
      else router.refresh();
    } catch (error) {
      notifyError(error, 'Note not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm" className={classes.notesPanel}>
      {/*
        The private-data notice.

        `color="yellow"` was a hard-coded palette name; it now resolves through
        the accent role, so the warning reads the same in both schemes and no
        component names a hue. The lock glyph is the non-colour channel: this
        panel is the one place in the enquiry screen that holds something the
        customer must never see.
      */}
      <Alert
        variant="light"
        color="accent"
        icon={<IconLock size={16} stroke={1.5} />}
        title="Internal notes"
      >
        <Text size="xs">
          Notes are visible to administrators only. They never appear on the customer&apos;s
          timeline unless you explicitly share one.
        </Text>
      </Alert>

      <Textarea
        label="Add a note"
        description="What happened, what was agreed, what to do next."
        value={body}
        onChange={(event) => setBody(event.currentTarget.value)}
        autosize
        minRows={3}
        maxLength={4000}
        size="xs"
      />

      {leads.length > 0 ? (
        <Select
          label="Attach to"
          description="Optional. Attaching keeps the note next to the provider lead it concerns."
          placeholder="Whole enquiry"
          data={leads}
          value={enquiryListingId}
          onChange={setEnquiryListingId}
          clearable
          size="xs"
        />
      ) : null}

      <Switch
        label="Share this note with the customer"
        description="On promotes the note into the customer-visible timeline."
        checked={shareWithCustomer}
        onChange={(event) => setShareWithCustomer(event.currentTarget.checked)}
        size="xs"
      />

      <Button
        size="xs"
        loading={busy}
        disabled={body.trim().length < 2}
        onClick={() => void submit()}
      >
        Add note
      </Button>

      {notes.length === 0 ? (
        <Text size="sm" c="dimmed">
          No notes yet.
        </Text>
      ) : (
        <ul className={classes.notesList}>
          {notes.map((note) => (
            <li key={note.id} className={classes.noteItem}>
              <div className={classes.noteMeta}>
                <IconLock
                  size={12}
                  stroke={1.5}
                  aria-label="Private note, visible to administrators only"
                  className={classes.noteLock}
                />
                <Text component="span" className={classes.noteAuthor}>
                  {note.authorName ?? 'Unknown author'}
                </Text>
                <Text component="span" className={classes.noteTimestamp}>
                  {formatDateTime(note.createdAt) ?? '—'}
                </Text>
                {note.listingName ? (
                  <Text component="span" className={classes.noteTimestamp}>
                    · {note.listingName}
                  </Text>
                ) : null}
              </div>
              <Text size="sm" className={classes.noteBody}>
                {note.body}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}
