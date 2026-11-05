'use client';

import { useState } from 'react';
import { FileInput, Progress, Switch, Text, TextInput } from '@mantine/core';
import { IconPhotoPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import classes from './VendorOnboardingForm.module.css';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
}

interface UploadedImage {
  id: string;
  name: string;
}

function uploadBytes(url: string, method: 'PUT', file: File, headers: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the image (HTTP ${xhr.status}).`));
    xhr.onerror = () => reject(new Error('The image upload failed. Check your connection.'));
    xhr.send(file);
  });
}

export function VendorOnboardingImageUpload({
  token,
  maxUploadBytes,
  onChange,
  onUploadingChange,
}: {
  token: string;
  maxUploadBytes: number;
  onChange: (ids: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isMenu, setIsMenu] = useState(false);
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function upload() {
    setError(null);
    if (images.length + files.length > 10) {
      setError('You can add up to ten images.');
      return;
    }
    if (altText.trim().length < 3) {
      setError('Describe the selected images in at least three characters.');
      return;
    }
    const invalid = files.find(
      (file) => !IMAGE_TYPES.includes(file.type) || file.size <= 0 || file.size > maxUploadBytes,
    );
    if (invalid) {
      setError(
        `Check ${invalid.name}. Use JPEG, PNG, WebP or AVIF files up to ${Math.round(maxUploadBytes / 1048576)} MB.`,
      );
      return;
    }

    setBusy(true);
    onUploadingChange(true);
    const added: UploadedImage[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const ticketResponse = await fetch('/api/vendor-onboarding/media/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            altText: `${altText.trim()} — ${file.name}`.slice(0, 200),
            isMenu,
          }),
        });
        const ticketBody = await ticketResponse.json();
        if (!ticketResponse.ok)
          throw new Error(ticketBody?.error?.message ?? 'Could not prepare the image upload.');
        const ticket = ticketBody.data as UploadTicket;
        await uploadBytes(ticket.uploadUrl, ticket.method, file, ticket.requiredHeaders ?? {});

        const completeResponse = await fetch(
          `/api/vendor-onboarding/media/${ticket.mediaId}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          },
        );
        const completeBody = await completeResponse.json();
        if (!completeResponse.ok)
          throw new Error(completeBody?.error?.message ?? 'Could not verify the uploaded image.');
        added.push({ id: ticket.mediaId, name: file.name });
        const next = [...images, ...added];
        setImages(next);
        onChange(next.map((image) => image.id));
        setFiles(files.slice(index + 1));
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }
      setFiles([]);
      setAltText('');
      setProgress(0);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The image upload failed.');
    } finally {
      setBusy(false);
      onUploadingChange(false);
    }
  }

  async function removeImage(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/vendor-onboarding/media/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? 'Could not remove that image.');
        return;
      }
    } catch {
      setError('Could not reach the server to remove that image.');
      return;
    }
    const next = images.filter((image) => image.id !== id);
    setImages(next);
    onChange(next.map((image) => image.id));
  }

  return (
    <div className={classes.imageUploader}>
      <Text size="sm" fw={600}>
        Add menu or business images
      </Text>
      <Text size="xs" c="dimmed">
        Choose image files from your device. Menu photos, food, venue and portfolio images are
        welcome. Up to ten images; you can skip this.
      </Text>
      <FileInput
        label="Image files"
        placeholder="Choose images"
        accept={IMAGE_TYPES.join(',')}
        multiple
        value={files}
        onChange={(value) => setFiles(value ?? [])}
        leftSection={<IconPhotoPlus size={16} stroke={1.5} />}
        disabled={busy || images.length >= 10}
      />
      <TextInput
        label="Image description"
        description="Used by screen readers to describe your images."
        placeholder="e.g. Vegetarian wedding menu"
        value={altText}
        onChange={(event) => setAltText(event.currentTarget.value)}
        maxLength={160}
        disabled={busy}
      />
      <Switch
        label="These are menu images"
        checked={isMenu}
        onChange={(event) => setIsMenu(event.currentTarget.checked)}
        disabled={busy}
      />
      {busy ? <Progress value={progress} aria-label="Image upload progress" /> : null}
      {error ? (
        <p className={classes.formError} role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        onClick={() => void upload()}
        disabled={busy || files.length === 0}
      >
        {busy ? 'Uploading images…' : 'Upload selected images'}
      </Button>
      {images.length ? (
        <ul className={classes.imageList} aria-label="Uploaded images">
          {images.map((image) => (
            <li key={image.id}>
              <span>{image.name}</span>
              <button type="button" onClick={() => void removeImage(image.id)} disabled={busy}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
