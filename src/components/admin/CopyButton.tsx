'use client';

import { Button } from '@/components/ui';

import { useState } from 'react';
import { CopyButton as MantineCopyButton, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

/**
 * Copy-to-clipboard for one-time values such as an invite link.
 *
 * The link is shown in a read-only field, so it can always be selected by hand
 * if the clipboard API is unavailable; this button is a convenience, not the only
 * way to get the value.
 */
export function CopyButton({ value, label = 'Copy link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <MantineCopyButton value={value} timeout={2000}>
      {({ copy, copied: isCopied }) => (
        <Tooltip label={isCopied || copied ? 'Copied' : label} withArrow>
          <Button
            type="button"
            size="xs"
            variant="default"
            leftSection={isCopied || copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            onClick={() => {
              copy();
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {isCopied || copied ? 'Copied' : label}
          </Button>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
}
