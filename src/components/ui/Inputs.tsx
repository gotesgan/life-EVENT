import type { NumberInputProps, SelectProps, TextareaProps, TextInputProps } from '@mantine/core';
import {
  NumberInput as MantineNumberInput,
  Select as MantineSelect,
  Textarea as MantineTextarea,
  TextInput as MantineTextInput,
} from '@mantine/core';
import { cx } from './cx';
import classes from './Inputs.module.css';

/**
 * The app's form controls.
 *
 * These are Mantine's inputs with the design system's half of the contract
 * applied — radius, height, type step, placeholder and the state set — while
 * Mantine keeps everything that is hard to re-implement: `leftSection` /
 * `rightSection` positioning, the password toggle, combobox behaviour and the
 * `label` / `description` / `error` wiring.
 *
 * Deliberately no `Field` wrapper: Mantine's `label`, `description` and `error`
 * props already produce the right structure and the right `aria-describedby` /
 * `aria-invalid` relationships, and a second layout primitive would be a second
 * place for the 12px label gap to drift.
 */

/** Classnames handed to every input so one rule set covers all of them. */
const inputClassNames = {
  input: classes.input,
  label: classes.label,
  description: classes.description,
  error: classes.error,
  section: classes.section,
  required: classes.required,
} as const;

export type AppTextInputProps = TextInputProps;

export function TextInput({ className, classNames, radius = 'md', ...rest }: AppTextInputProps) {
  return (
    <MantineTextInput
      {...rest}
      radius={radius}
      className={cx(classes.field, className)}
      classNames={{ ...inputClassNames, ...classNames }}
    />
  );
}

export type AppTextareaProps = TextareaProps;

export function Textarea({ className, classNames, radius = 'md', ...rest }: AppTextareaProps) {
  return (
    <MantineTextarea
      {...rest}
      radius={radius}
      className={cx(classes.field, className)}
      classNames={{ ...inputClassNames, ...classNames }}
    />
  );
}

export type AppSelectProps = SelectProps;

export function Select({ className, classNames, radius = 'md', ...rest }: AppSelectProps) {
  return (
    <MantineSelect
      {...rest}
      radius={radius}
      className={cx(classes.field, className)}
      classNames={{ ...inputClassNames, ...classNames }}
    />
  );
}

export type AppNumberInputProps = NumberInputProps;

export function NumberInput({
  className,
  classNames,
  radius = 'md',
  ...rest
}: AppNumberInputProps) {
  return (
    <MantineNumberInput
      {...rest}
      radius={radius}
      className={cx(classes.field, className)}
      classNames={{ ...inputClassNames, ...classNames }}
    />
  );
}
