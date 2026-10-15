'use client';

import type { ReactNode } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import { PRICE_UNIT_LABELS } from '@/lib/format';
import type { ListingForm } from './types';

const PRICE_UNIT_OPTIONS = Object.entries(PRICE_UNIT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface RepeatableRowsProps {
  title: string;
  description: string;
  addLabel: string;
  emptyMessage: string;
  count: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  children: (index: number) => ReactNode;
}

/**
 * A repeatable collection with explicit add / remove / reorder controls.
 *
 * Reordering uses real buttons (not drag-and-drop) because drag targets are not
 * keyboard reachable without extra work, and an administrator reordering twenty
 * packages is not a gesture that should require a mouse. Removal asks for
 * confirmation through the parent's handler.
 */
function RepeatableRows({
  title,
  description,
  addLabel,
  emptyMessage,
  count,
  onAdd,
  onRemove,
  onMove,
  children,
}: RepeatableRowsProps) {
  return (
    <section>
      <Group justify="space-between" align="flex-start" mb="xs">
        <div>
          <Text fw={600}>{title}</Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </div>
        <Button
          size="compact-sm"
          variant="light"
          leftSection={<IconPlus size={15} />}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </Group>

      {count === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            {emptyMessage}
          </Text>
        </Paper>
      ) : (
        <Stack gap="sm">
          {Array.from({ length: count }, (_, index) => (
            <Paper key={index} withBorder radius="md" p="md">
              <Group justify="space-between" mb="sm" wrap="nowrap">
                <Text size="xs" fw={600} c="dimmed">
                  {title.replace(/s$/, '')} {index + 1}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Move up" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      disabled={index === 0}
                      aria-label={`Move ${title} item ${index + 1} up`}
                      onClick={() => onMove(index, index - 1)}
                    >
                      <IconArrowUp size={15} stroke={1.5} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Move down" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      disabled={index === count - 1}
                      aria-label={`Move ${title} item ${index + 1} down`}
                      onClick={() => onMove(index, index + 1)}
                    >
                      <IconArrowDown size={15} stroke={1.5} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label={`Remove ${title} item ${index + 1}`}
                      onClick={() => onRemove(index)}
                    >
                      <IconTrash size={15} stroke={1.5} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              {children(index)}
            </Paper>
          ))}
        </Stack>
      )}
    </section>
  );
}

export interface CollectionsSectionProps {
  form: ListingForm;
  onRequestRemove: (
    list: 'services' | 'packages' | 'venueSpaces',
    index: number,
    label: string,
  ) => void;
}

export function CollectionsSection({ form, onRequestRemove }: CollectionsSectionProps) {
  const field = (index: number, key: string) => form.getInputProps(`services.${index}.${key}`);

  return (
    <Stack gap="xl">
      <RepeatableRows
        title="Services"
        description="Individual services with their own price and duration."
        addLabel="Add service"
        emptyMessage="No services listed. Services appear in the “Services” section of the public listing."
        count={form.values.services.length}
        onAdd={() =>
          form.insertListItem('services', {
            name: '',
            description: '',
            priceFrom: '',
            priceTo: '',
            priceUnit: null,
            durationMinutes: '',
            includes: [],
            isActive: true,
            sortOrder: form.values.services.length,
          })
        }
        onRemove={(index) =>
          onRequestRemove('services', index, form.values.services[index]?.name || 'this service')
        }
        onMove={(from, to) => form.reorderListItem('services', { from, to })}
      >
        {(index) => (
          <Stack gap="sm">
            <TextInput label="Name" withAsterisk {...field(index, 'name')} />
            <Textarea label="Description" minRows={2} autosize {...field(index, 'description')} />
            <Group grow align="flex-start">
              <NumberInput
                label="Price from"
                min={0}
                thousandSeparator=","
                {...field(index, 'priceFrom')}
              />
              <NumberInput
                label="Price to"
                min={0}
                thousandSeparator=","
                {...field(index, 'priceTo')}
              />
            </Group>
            <Group grow align="flex-start">
              <Select
                label="Price unit"
                data={PRICE_UNIT_OPTIONS}
                clearable
                {...field(index, 'priceUnit')}
              />
              <NumberInput
                label="Duration (minutes)"
                min={0}
                {...field(index, 'durationMinutes')}
              />
            </Group>
            <TagsInput
              label="Includes"
              description="Press Enter after each item."
              {...field(index, 'includes')}
            />
            <Switch
              label="Active"
              {...form.getInputProps(`services.${index}.isActive`, { type: 'checkbox' })}
            />
          </Stack>
        )}
      </RepeatableRows>

      <RepeatableRows
        title="Packages"
        description="Bundled offers, optionally bounded by guest count."
        addLabel="Add package"
        emptyMessage="No packages listed."
        count={form.values.packages.length}
        onAdd={() =>
          form.insertListItem('packages', {
            name: '',
            description: '',
            price: '',
            priceUnit: null,
            minGuests: '',
            maxGuests: '',
            inclusions: [],
            exclusions: [],
            isActive: true,
            sortOrder: form.values.packages.length,
          })
        }
        onRemove={(index) =>
          onRequestRemove('packages', index, form.values.packages[index]?.name || 'this package')
        }
        onMove={(from, to) => form.reorderListItem('packages', { from, to })}
      >
        {(index) => (
          <Stack gap="sm">
            <TextInput
              label="Name"
              withAsterisk
              {...form.getInputProps(`packages.${index}.name`)}
            />
            <Textarea
              label="Description"
              minRows={2}
              autosize
              {...form.getInputProps(`packages.${index}.description`)}
            />
            <Group grow align="flex-start">
              <NumberInput
                label="Price"
                min={0}
                thousandSeparator=","
                {...form.getInputProps(`packages.${index}.price`)}
              />
              <Select
                label="Price unit"
                data={PRICE_UNIT_OPTIONS}
                clearable
                {...form.getInputProps(`packages.${index}.priceUnit`)}
              />
            </Group>
            <Group grow align="flex-start">
              <NumberInput
                label="Minimum guests"
                min={0}
                {...form.getInputProps(`packages.${index}.minGuests`)}
              />
              <NumberInput
                label="Maximum guests"
                min={0}
                {...form.getInputProps(`packages.${index}.maxGuests`)}
              />
            </Group>
            <TagsInput
              label="Inclusions"
              description="Press Enter after each item."
              {...form.getInputProps(`packages.${index}.inclusions`)}
            />
            <TagsInput
              label="Exclusions"
              description="What the package price does not cover."
              {...form.getInputProps(`packages.${index}.exclusions`)}
            />
            <Switch
              label="Active"
              {...form.getInputProps(`packages.${index}.isActive`, { type: 'checkbox' })}
            />
          </Stack>
        )}
      </RepeatableRows>

      <RepeatableRows
        title="Venue spaces"
        description="Halls, lawns and rooms within the venue, with their own capacity."
        addLabel="Add space"
        emptyMessage="No spaces listed. Spaces are for venues with more than one usable area."
        count={form.values.venueSpaces.length}
        onAdd={() =>
          form.insertListItem('venueSpaces', {
            name: '',
            description: '',
            capacitySeated: '',
            capacityStanding: '',
            areaSqft: '',
            isIndoor: true,
            isOutdoor: false,
            layoutOptions: [],
            sortOrder: form.values.venueSpaces.length,
          })
        }
        onRemove={(index) =>
          onRequestRemove(
            'venueSpaces',
            index,
            form.values.venueSpaces[index]?.name || 'this space',
          )
        }
        onMove={(from, to) => form.reorderListItem('venueSpaces', { from, to })}
      >
        {(index) => (
          <Stack gap="sm">
            <TextInput
              label="Name"
              withAsterisk
              {...form.getInputProps(`venueSpaces.${index}.name`)}
            />
            <Textarea
              label="Description"
              minRows={2}
              autosize
              {...form.getInputProps(`venueSpaces.${index}.description`)}
            />
            <Group grow align="flex-start">
              <NumberInput
                label="Seated capacity"
                min={0}
                {...form.getInputProps(`venueSpaces.${index}.capacitySeated`)}
              />
              <NumberInput
                label="Standing capacity"
                min={0}
                {...form.getInputProps(`venueSpaces.${index}.capacityStanding`)}
              />
              <NumberInput
                label="Area (sq ft)"
                min={0}
                {...form.getInputProps(`venueSpaces.${index}.areaSqft`)}
              />
            </Group>
            <Group grow>
              <Switch
                label="Indoor"
                {...form.getInputProps(`venueSpaces.${index}.isIndoor`, { type: 'checkbox' })}
              />
              <Switch
                label="Outdoor"
                {...form.getInputProps(`venueSpaces.${index}.isOutdoor`, { type: 'checkbox' })}
              />
            </Group>
            <TagsInput
              label="Layout options"
              description="e.g. Theatre, Round tables, Cocktail"
              {...form.getInputProps(`venueSpaces.${index}.layoutOptions`)}
            />
          </Stack>
        )}
      </RepeatableRows>
    </Stack>
  );
}
