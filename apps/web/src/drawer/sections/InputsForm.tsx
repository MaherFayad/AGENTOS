'use client';

/**
 * `INPUTS` — our addition to §2.3. The form is GENERATED from frontmatter `inputs:`.
 *
 * There is no branch anywhere in this file on an agent name, a slug or a department. It
 * renders whatever `planInputs()` produced and nothing else, which is the only way the
 * "frontmatter is the single source of truth" rule survives contact with 150 agents
 * (Part IV). A field this cannot render is reported as a schema gap, in the drawer, where
 * the person who can fix it will see it — not swallowed and not faked into a text box.
 *
 * Owner: drawer-engineer · Consumes: contracts/frontmatter-schema.md (`inputs[]`)
 */

import type { InputField, InputValues, UnsupportedField } from '../data/inputs';
import s from '../drawer.module.css';

/**
 * The one spelling of a generated field's DOM id.
 *
 * `▶ Run now` has to be able to move the reader to the first field it refused, and the only
 * handle it has is this id. Two spellings of it is one rename away from a Run button that
 * silently focuses nothing — the failure mode being fixed, rebuilt.
 */
export const INPUT_ID_PREFIX = 'drawer-input';
export const inputFieldId = (key: string, prefix: string = INPUT_ID_PREFIX): string =>
  `${prefix}-${key}`;

export function InputsForm({
  fields,
  unsupported,
  values,
  errors,
  onChange,
  idPrefix = INPUT_ID_PREFIX,
}: {
  fields: InputField[];
  unsupported: UnsupportedField[];
  values: InputValues;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix?: string;
}) {
  return (
    <div className={s.fields}>
      {fields.map((field) => {
        const id = inputFieldId(field.key, idPrefix);
        const errorId = `${id}-error`;
        const error = errors[field.key];
        const shared = {
          id,
          className: s.control,
          value: values[field.key] ?? '',
          required: field.required,
          'aria-invalid': error ? ('true' as const) : undefined,
          'aria-describedby': error ? errorId : undefined,
        };

        return (
          <div className={s.field} key={field.key}>
            <label className={s.fieldLabel} htmlFor={id}>
              {field.label}
              {field.required ? <span className={s.required}> ·&nbsp;required</span> : null}
            </label>

            {field.control === 'textarea' ? (
              <textarea
                {...shared}
                className={`${s.control} ${s.textarea}`}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : field.control === 'select' ? (
              <select {...shared} onChange={(event) => onChange(field.key, event.target.value)}>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input {...shared} type={field.inputType ?? 'text'} onChange={(event) => onChange(field.key, event.target.value)} />
            )}

            {error ? (
              <p className={s.fieldError} id={errorId}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {unsupported.map((field) => (
        <p className={s.sectionNote} key={field.key}>
          <strong>{field.label}</strong> can’t be filled in here: {field.reason} That is a gap in the frontmatter schema,
          not in this agent.
        </p>
      ))}
    </div>
  );
}
