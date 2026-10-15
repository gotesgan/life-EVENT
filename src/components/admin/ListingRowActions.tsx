'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import {
  IconArchive,
  IconArrowBackUp,
  IconCheck,
  IconDots,
  IconExternalLink,
  IconEyeOff,
  IconPencil,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { confirmAction } from './confirm';
import { notifyError, notifySuccess, postJson } from './api';

export interface ListingRowActionsProps {
  id: string;
  name: string;
  slug: string;
  publicationStatus: string;
  verificationStatus: string;
  /** Called after a successful mutation; defaults to a router refresh. */
  onDone?: () => void;
}

type PublicationAction = 'publish' | 'unpublish' | 'archive' | 'restore';
type VerificationAction = 'verify' | 'reject' | 'reset';

/**
 * Row actions for one listing.
 *
 * Every action posts to the admin API and then refreshes the server-rendered
 * table — the row is never optimistically patched, so what is shown is always
 * what the database holds. A refusal (for example, publishing without an image)
 * surfaces the service's own message verbatim rather than a generic failure,
 * because that sentence tells the administrator what to fix.
 */
export function ListingRowActions({
  id,
  name,
  slug,
  publicationStatus,
  verificationStatus,
  onDone,
}: ListingRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const done = () => {
    if (onDone) onDone();
    else router.refresh();
  };

  async function setPublication(action: PublicationAction, successMessage: string) {
    setBusy(true);
    try {
      await postJson(`/api/admin/listings/${id}/publication`, { action });
      notifySuccess(successMessage, 'Listing updated');
      done();
    } catch (error) {
      notifyError(error, 'Change refused');
    } finally {
      setBusy(false);
    }
  }

  async function setVerification(action: VerificationAction, successMessage: string) {
    setBusy(true);
    try {
      await postJson(`/api/admin/listings/${id}/verification`, { action });
      notifySuccess(successMessage, 'Verification updated');
      done();
    } catch (error) {
      notifyError(error, 'Change refused');
    } finally {
      setBusy(false);
    }
  }

  const isArchived = publicationStatus === 'ARCHIVED';
  // Only a published listing has a public profile: an unpublished, draft or
  // archived slug is a 404 on the public site, so pointing "View on site" at
  // it would open a broken tab. Say why it is unavailable instead.
  const isPubliclyVisible = publicationStatus === 'PUBLISHED';

  return (
    <Menu withinPortal position="bottom-end" shadow="md" radius="md">
      <Menu.Target>
        <Tooltip label="Listing actions" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            loading={busy}
            aria-label={`Actions for ${name}`}
          >
            <IconDots size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        {isPubliclyVisible ? (
          <Menu.Item
            component="a"
            href={`/vendors/${slug}`}
            target="_blank"
            rel="noreferrer"
            leftSection={<IconExternalLink size={15} stroke={1.5} />}
          >
            View on site
          </Menu.Item>
        ) : (
          <Menu.Item disabled leftSection={<IconExternalLink size={15} stroke={1.5} />}>
            No public page — not published
          </Menu.Item>
        )}
        <Menu.Item
          component="a"
          href={`/admin/listings/${id}`}
          leftSection={<IconPencil size={15} stroke={1.5} />}
        >
          Edit listing
        </Menu.Item>

        <Menu.Divider />

        {isArchived ? (
          <Menu.Item
            leftSection={<IconArrowBackUp size={15} stroke={1.5} />}
            onClick={() => void setPublication('restore', `"${name}" restored to draft.`)}
          >
            Restore to draft
          </Menu.Item>
        ) : (
          <>
            {publicationStatus !== 'PUBLISHED' ? (
              <Menu.Item
                leftSection={<IconUpload size={15} stroke={1.5} />}
                onClick={() => void setPublication('publish', `"${name}" is now published.`)}
              >
                Publish
              </Menu.Item>
            ) : null}

            {publicationStatus === 'PUBLISHED' ? (
              <Menu.Item
                leftSection={<IconEyeOff size={15} stroke={1.5} />}
                onClick={() =>
                  confirmAction({
                    title: `Unpublish "${name}"?`,
                    body: 'The listing stops appearing in search and on its public page immediately. You can publish it again at any time.',
                    confirmLabel: 'Unpublish',
                    danger: false,
                    onConfirm: () => setPublication('unpublish', `"${name}" is unpublished.`),
                  })
                }
              >
                Unpublish
              </Menu.Item>
            ) : null}

            <Menu.Item
              color="red"
              leftSection={<IconArchive size={15} stroke={1.5} />}
              onClick={() =>
                confirmAction({
                  title: `Archive "${name}"?`,
                  body: `Archiving takes "${name}" out of the directory. Customers will not find it, and it has to be restored to draft before it can be published again.`,
                  confirmLabel: 'Archive listing',
                  onConfirm: () => setPublication('archive', `"${name}" is archived.`),
                })
              }
            >
              Archive
            </Menu.Item>
          </>
        )}

        <Menu.Divider />

        {verificationStatus !== 'VERIFIED' ? (
          <Menu.Item
            leftSection={<IconCheck size={15} stroke={1.5} />}
            onClick={() => void setVerification('verify', `"${name}" is marked verified.`)}
          >
            Mark verified
          </Menu.Item>
        ) : null}

        {verificationStatus !== 'REJECTED' ? (
          <Menu.Item
            color="red"
            leftSection={<IconX size={15} stroke={1.5} />}
            onClick={() =>
              confirmAction({
                title: `Reject verification for "${name}"?`,
                body: 'The listing is recorded as verification-rejected, which is a visible trust signal. Only do this when the submitted details could not be confirmed.',
                confirmLabel: 'Reject verification',
                onConfirm: () =>
                  setVerification('reject', `Verification for "${name}" is rejected.`),
              })
            }
          >
            Reject verification
          </Menu.Item>
        ) : null}

        {verificationStatus !== 'UNVERIFIED' ? (
          <Menu.Item
            onClick={() => void setVerification('reset', `Verification for "${name}" was reset.`)}
          >
            Reset verification
          </Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
}
