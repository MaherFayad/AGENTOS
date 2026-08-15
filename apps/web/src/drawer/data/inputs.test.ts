/**
 * INPUTS are generated from frontmatter `inputs:` — never hand-written per agent.
 *
 * REQ-DRW-16. Two different `inputs:` arrays must produce two different field lists,
 * and an unknown type must surface as a schema gap rather than a text box.
 */

import { describe, expect, it } from 'vitest';
import { initialValues, planInputs, toRunPayload, validateInputs } from './inputs';
import type { AgentInput } from './types';

describe('planInputs — the form is derived from frontmatter', () => {
  it('turns Account Enrichment’s inputs: into a required url field, nothing else', () => {
    const plan = planInputs([
      { key: 'account_url', label: 'Account website', type: 'url', required: true },
    ]);
    expect(plan.fields).toEqual([
      {
        key: 'account_url',
        label: 'Account website',
        type: 'url',
        required: true,
        options: [],
        control: 'input',
        inputType: 'url',
      },
    ]);
    expect(plan.unsupported).toEqual([]);
  });

  it('does not share a form across agents — a different inputs: array is a different form', () => {
    const enrichment = planInputs([
      { key: 'account_url', label: 'Account website', type: 'url', required: true },
    ]);
    const interview = planInputs([
      { key: 'topic', label: 'Topic', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', required: false },
      { key: 'when', label: 'Date', type: 'date', required: false },
    ]);
    expect(enrichment.fields.map((f) => f.key)).toEqual(['account_url']);
    expect(interview.fields.map((f) => f.key)).toEqual(['topic', 'notes', 'when']);
    expect(interview.fields.find((f) => f.key === 'notes')?.control).toBe('textarea');
    expect(interview.fields.find((f) => f.key === 'when')?.inputType).toBe('date');
    expect(interview.fields.find((f) => f.key === 'topic')?.required).toBe(true);
    expect(interview.fields.find((f) => f.key === 'notes')?.required).toBe(false);
  });

  it('renders a select from options[] and refuses a select with none', () => {
    const ok = planInputs([
      { key: 'region', label: 'Region', type: 'select', required: true, options: ['EMEA', 'AMER'] },
    ]);
    expect(ok.fields[0]?.control).toBe('select');
    expect(ok.fields[0]?.options).toEqual(['EMEA', 'AMER']);

    const gap = planInputs([{ key: 'region', label: 'Region', type: 'select', required: true }]);
    expect(gap.fields).toEqual([]);
    expect(gap.unsupported[0]?.declared).toBe('select');
  });

  it('reports an unknown type as a schema gap instead of inventing a text box', () => {
    const plan = planInputs([
      { key: 'file', label: 'Attachment', type: 'file' as AgentInput['type'], required: true },
    ]);
    expect(plan.fields).toEqual([]);
    expect(plan.unsupported).toHaveLength(1);
    expect(plan.unsupported[0]?.declared).toBe('file');
    expect(plan.unsupported[0]?.reason).toMatch(/not one of the input types/);
  });

  it('skips duplicate keys and empty keys rather than rendering two controls for one payload key', () => {
    const plan = planInputs([
      { key: 'url', label: 'First', type: 'url', required: true },
      { key: 'url', label: 'Second', type: 'text', required: false },
      { key: '', label: 'Ghost', type: 'text', required: false },
    ]);
    expect(plan.fields).toHaveLength(1);
    expect(plan.fields[0]?.label).toBe('First');
  });
});

describe('validateInputs / toRunPayload', () => {
  const fields = planInputs([
    { key: 'account_url', label: 'Account website', type: 'url', required: true },
    { key: 'limit', label: 'Limit', type: 'number', required: false },
  ]).fields;

  it('blocks a missing required field and a malformed url', () => {
    expect(validateInputs(fields, initialValues(fields)).ok).toBe(false);
    expect(validateInputs(fields, { account_url: 'not-a-url', limit: '' }).ok).toBe(false);
    expect(validateInputs(fields, { account_url: 'https://example.com', limit: '' }).ok).toBe(true);
  });

  it('omits blank optional fields from the POST /api/run payload', () => {
    expect(toRunPayload(fields, { account_url: 'https://example.com', limit: '' })).toEqual({
      account_url: 'https://example.com',
    });
    expect(toRunPayload(fields, { account_url: 'https://example.com', limit: '12' })).toEqual({
      account_url: 'https://example.com',
      limit: 12,
    });
  });
});
