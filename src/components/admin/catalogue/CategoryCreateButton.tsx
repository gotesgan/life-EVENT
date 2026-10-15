'use client';

import { Button, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { CategoryForm } from './CategoryForm';

export interface CategoryCreateButtonProps {
  parentOptions: Array<{ value: string; label: string }>;
}

/**
 * "New category" trigger.
 *
 * Mantine's `Modal` supplies the focus trap, Escape handling and focus return,
 * so the form inside it is reachable and dismissible by keyboard alone.
 */
export function CategoryCreateButton({ parentOptions }: CategoryCreateButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button leftSection={<IconPlus size={16} stroke={1.5} />} onClick={open}>
        New category
      </Button>

      <Modal opened={opened} onClose={close} title="New category" centered radius="lg" size="lg">
        <CategoryForm mode="create" parentOptions={parentOptions} onDone={close} onCancel={close} />
      </Modal>
    </>
  );
}
