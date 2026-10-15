'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Progress,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconPhotoPlus,
  IconStar,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { AspectImage, StatusBadge, Surface } from '@/components/ui';
import { confirmAction } from '../confirm';
import { deleteJson, notifyError, notifySuccess, patchJson, postJson } from '../api';
import { MEDIA_TONES } from '../status';
import type { ListingEditorMediaModel } from './types';

/**
 * Mirrors `ALLOWED_IMAGE_MIME_TYPES` in `src/lib/storage/validation.ts`.
 *
 * It cannot be imported: that module imports `node:crypto` and the server env, so
 * pulling the constant in would drag server code into the client bundle. The
 * duplication is deliberate and checked by the pre-flight message below — the
 * server remains the authority and rejects anything this list gets wrong.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
const ALLOWED_TYPE_LABEL = 'JPEG, PNG, WebP or AVIF';

interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  publicUrl: string;
  requiredHeaders: Record<string, string>;
}

/** `fetch` cannot report upload progress; `XMLHttpRequest` can. */
function putFile(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`The storage provider refused the upload (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () =>
      reject(new Error('The upload failed. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('The upload was cancelled.'));
    xhr.send(file);
  });
}

export interface MediaManagerProps {
  listingId: string;
  media: ListingEditorMediaModel[];
  /** From the server env, so the client cap can never exceed the server's. */
  maxUploadBytes: number;
}

export function MediaManager({ listingId, media, maxUploadBytes }: MediaManagerProps) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [makeCover, setMakeCover] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const readyMedia = useMemo(() => media.filter((item) => item.status === 'READY'), [media]);

  function precheck(selected: File | null) {
    setFileError(null);
    setFile(selected);
    if (!selected) return;

    if (!(ALLOWED_TYPES as readonly string[]).includes(selected.type)) {
      setFileError(`That file is not an image we can store. Use ${ALLOWED_TYPE_LABEL}.`);
      return;
    }
    if (selected.size <= 0) {
      setFileError('That file is empty.');
      return;
    }
    if (selected.size > maxUploadBytes) {
      const megabytes = (maxUploadBytes / (1024 * 1024)).toFixed(0);
      setFileError(
        `That file is ${(selected.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${megabytes} MB.`,
      );
    }
  }

  async function upload() {
    setUploadError(null);
    setAltError(null);

    if (!file) {
      setFileError('Choose a file first.');
      return;
    }
    if (fileError) return;
    if (altText.trim().length < 3) {
      setAltError(
        'Describe the image in at least 3 characters. The description is read aloud by screen readers.',
      );
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const ticket = await postJson<{ data: UploadTicket }>(
        `/api/admin/listings/${listingId}/media/presign`,
        {
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
      );

      await putFile(ticket.data.uploadUrl, file, ticket.data.requiredHeaders ?? {}, setProgress);
      setProgress(100);

      await postJson(`/api/admin/listings/${listingId}/media/${ticket.data.mediaId}/complete`, {
        altText: altText.trim(),
        sortOrder: media.length,
        isCover: makeCover || readyMedia.length === 0,
      });

      notifySuccess('Image uploaded and verified.', 'Media added');
      setFile(null);
      setAltText('');
      setMakeCover(false);
      setProgress(0);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The upload failed.';
      setUploadError(message);
      notifyError(error, 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function reorder(next: ListingEditorMediaModel[]) {
    setBusyId('reorder');
    try {
      await patchJson(`/api/admin/listings/${listingId}/media`, {
        items: next.map((item, index) => ({ mediaId: item.id, sortOrder: index })),
      });
      notifySuccess('Gallery order saved.', 'Media');
      router.refresh();
    } catch (error) {
      notifyError(error, 'Could not save the new order');
    } finally {
      setBusyId(null);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...media];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void reorder(next);
  }

  function makeCoverImage(index: number) {
    const next = [...media];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    void reorder(next);
  }

  function remove(item: ListingEditorMediaModel) {
    confirmAction({
      title: `Delete this image?`,
      body: `The image "${item.altText}" is removed from the listing and from storage. This cannot be undone.`,
      confirmLabel: 'Delete image',
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await deleteJson(`/api/admin/listings/${listingId}/media/${item.id}`);
          notifySuccess('Image deleted.', 'Media removed');
          router.refresh();
        } catch (error) {
          notifyError(error, 'Could not delete the image');
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <Stack gap="lg">
      <Surface tone="muted" padding="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Add an image
          </Text>
          <Text size="xs" c="dimmed">
            {ALLOWED_TYPE_LABEL}, up to {(maxUploadBytes / (1024 * 1024)).toFixed(0)} MB. The file
            is uploaded directly to storage — it never passes through the application server.
          </Text>

          <FileInput
            label="Image file"
            placeholder="Choose a file"
            accept={ALLOWED_TYPES.join(',')}
            value={file}
            onChange={precheck}
            error={fileError}
            clearable
            leftSection={<IconPhotoPlus size={16} stroke={1.5} />}
          />

          <TextInput
            label="Image description (alt text)"
            description="Required. Say what the photograph shows, e.g. “Round tables under a draped marquee”."
            withAsterisk
            value={altText}
            onChange={(event) => setAltText(event.currentTarget.value)}
            error={altError}
            maxLength={200}
          />

          <Switch
            label="Make this the cover image"
            description="The cover is the thumbnail shown on cards and search results."
            checked={makeCover}
            onChange={(event) => setMakeCover(event.currentTarget.checked)}
          />

          {progress > 0 && uploading ? (
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Uploading — {progress}%
              </Text>
              <Progress value={progress} size="sm" aria-label="Upload progress" />
            </div>
          ) : null}

          {uploadError ? (
            <Alert variant="light" color="red" role="alert" icon={<IconAlertTriangle size={16} />}>
              {uploadError}
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button
              leftSection={<IconUpload size={16} stroke={1.5} />}
              loading={uploading}
              onClick={() => void upload()}
              disabled={!file}
            >
              Upload image
            </Button>
          </Group>
        </Stack>
      </Surface>

      {media.length === 0 ? (
        <Alert variant="light" color="brand">
          <Text size="sm">
            No images yet. A listing needs at least one image before it can be published.
          </Text>
        </Alert>
      ) : (
        <Stack gap="sm">
          {media.map((item, index) => (
            <Surface key={item.id} tone="raised" padding="sm">
              <Group align="flex-start" wrap="nowrap" gap="md">
                <div style={{ width: 132, flex: '0 0 auto' }}>
                  <AspectImage
                    src={item.status === 'READY' ? item.publicUrl : null}
                    alt={item.altText}
                    ratio="3/2"
                    sizes="132px"
                    seed={item.id}
                  />
                </div>

                <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="wrap">
                    <StatusBadge tone={MEDIA_TONES[item.status] ?? 'neutral'} size="sm" dot>
                      {item.status === 'READY'
                        ? 'Ready'
                        : item.status === 'PENDING'
                          ? 'Upload incomplete'
                          : 'Failed'}
                    </StatusBadge>
                    {item.isCover || index === 0 ? (
                      <Badge size="sm" radius="sm" variant="light" color="accent">
                        Cover
                      </Badge>
                    ) : null}
                    <Text size="xs" c="dimmed">
                      {item.mimeType} · {(item.sizeBytes / 1024).toFixed(0)} KB
                    </Text>
                  </Group>

                  <Text size="sm">{item.altText}</Text>

                  <Group gap={4} mt={2}>
                    <Tooltip label="Move up" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        disabled={index === 0}
                        loading={busyId === 'reorder'}
                        aria-label={`Move image ${index + 1} up`}
                        onClick={() => move(index, -1)}
                      >
                        <IconArrowUp size={15} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Move down" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        disabled={index === media.length - 1}
                        loading={busyId === 'reorder'}
                        aria-label={`Move image ${index + 1} down`}
                        onClick={() => move(index, 1)}
                      >
                        <IconArrowDown size={15} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Make cover" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        disabled={index === 0 || item.status !== 'READY'}
                        aria-label={`Make image ${index + 1} the cover`}
                        onClick={() => makeCoverImage(index)}
                      >
                        <IconStar size={15} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete image" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        loading={busyId === item.id}
                        aria-label={`Delete image ${index + 1}`}
                        onClick={() => remove(item)}
                      >
                        <IconTrash size={15} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              </Group>
            </Surface>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
