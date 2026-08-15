/**
 * INPUTS — the form is *generated* from frontmatter `inputs:` (§2.3, our addition).
 *
 * There is deliberately no way to hand-write a form for a specific agent: this module
 * turns `{key, label, type, required}` into field descriptors and everything downstream
 * renders descriptors. If an agent needs a field this can't render, the fix is a schema
 * change in `comms/contracts/frontmatter-schema.md`, not a special case here.
 *
 * Owner: drawer-engineer · Consumes: contracts/frontmatter-schema.md (`inputs[]`)
 */

import type { AgentInput, InputType } from './types';

export const SUPPORTED_INPUT_TYPES: InputType[] = ['text', 'url', 'number', 'select', 'textarea', 'date'];

export interface InputField {
  key: string;
  label: string;
  type: InputType;
  required: boolean;
  options: string[];
  placeholder?: string;
  /** `<input type>` for the control, or null for textarea/select which are their own tags. */
  control: 'input' | 'textarea' | 'select';
  inputType?: 'text' | 'url' | 'number' | 'date';
}

export interface UnsupportedField {
  key: string;
  label: string;
  /** The type we were asked for and do not know how to render. */
  declared: string;
  reason: string;
}

export interface InputPlan {
  fields: InputField[];
  /** Rendered as an honest notice, never silently dropped. */
  unsupported: UnsupportedField[];
}

function isSupported(type: string): type is InputType {
  return (SUPPORTED_INPUT_TYPES as string[]).includes(type);
}

/**
 * Frontmatter `inputs:` -> field descriptors. Order is frontmatter order: the author of
 * the agent decided it, and reordering someone's form is a change of meaning.
 */
export function planInputs(inputs: AgentInput[] | undefined | null): InputPlan {
  const fields: InputField[] = [];
  const unsupported: UnsupportedField[] = [];
  const seen = new Set<string>();

  for (const raw of inputs ?? []) {
    if (!raw || typeof raw.key !== 'string' || raw.key.length === 0) continue;
    if (seen.has(raw.key)) continue;
    seen.add(raw.key);

    const label = typeof raw.label === 'string' && raw.label.length > 0 ? raw.label : raw.key;
    const declared = typeof raw.type === 'string' ? raw.type : 'text';

    if (!isSupported(declared)) {
      unsupported.push({
        key: raw.key,
        label,
        declared,
        reason: `“${declared}” is not one of the input types the schema defines, so this field has no control to render.`,
      });
      continue;
    }

    const options = Array.isArray(raw.options) ? raw.options.filter((o) => typeof o === 'string') : [];
    if (declared === 'select' && options.length === 0) {
      unsupported.push({
        key: raw.key,
        label,
        declared,
        reason: 'A select with no `options` has nothing to choose from.',
      });
      continue;
    }

    fields.push({
      key: raw.key,
      label,
      type: declared,
      required: raw.required === true,
      options,
      placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : undefined,
      control: declared === 'textarea' ? 'textarea' : declared === 'select' ? 'select' : 'input',
      inputType:
        declared === 'url' ? 'url' : declared === 'number' ? 'number' : declared === 'date' ? 'date' : declared === 'text' ? 'text' : undefined,
    });
  }

  return { fields, unsupported };
}

export type InputValues = Record<string, string>;

/** Empty strings, one per field — a controlled form with no `undefined` transitions. */
export function initialValues(fields: InputField[]): InputValues {
  const values: InputValues = {};
  for (const field of fields) values[field.key] = field.type === 'select' ? (field.options[0] ?? '') : '';
  return values;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/** Required-empty and type-shaped checks only. The runner is the real validator (§3.2). */
export function validateInputs(fields: InputField[], values: InputValues): ValidationResult {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (field.required && value === '') {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (value === '') continue;
    if (field.type === 'number' && Number.isNaN(Number(value))) {
      errors[field.key] = `${field.label} has to be a number.`;
    }
    if (field.type === 'url' && !/^https?:\/\/\S+$/i.test(value)) {
      errors[field.key] = `${field.label} has to be a full URL, starting with http:// or https://.`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * The payload for `POST /api/run`. Blank optional fields are omitted rather than sent as
 * empty strings — the runner should see "not supplied", not "supplied as nothing".
 */
export function toRunPayload(fields: InputField[], values: InputValues): Record<string, string | number> {
  const payload: Record<string, string | number> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (value === '') continue;
    payload[field.key] = field.type === 'number' ? Number(value) : value;
  }
  return payload;
}
