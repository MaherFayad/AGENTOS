/**
 * PDPL redaction rule list (spec Part VII.4).
 *
 * Jointly owned by `observability-engineer` (this file) and `rtl-arabic-pdpl-specialist`
 * (the rule set itself — see comms/inbox/rtl-arabic-pdpl-specialist/). Adding or
 * loosening a rule is a decision-request to both owners, never a silent edit.
 *
 * These rules run at the INSTRUMENTATION layer — before anything reaches the Langfuse
 * client and before anything is written to Postgres. There is deliberately no
 * "unredact" path and no viewer-side toggle: if it got redacted, it is gone.
 *
 * Two independent passes, both applied:
 *   1. KEY rules   — a denylisted object key redacts its entire subtree, whatever it holds.
 *   2. VALUE rules — regexes applied to every surviving string, in listed order.
 *
 * Order matters in the value pass. The most specific pattern must run first or a
 * broader one eats its prefix (e.g. a 16-digit PAN must be consumed before the
 * 10-digit Saudi national-ID rule looks at the same run of characters).
 */

export type ValueRule = {
  id: string;
  label: string;
  /** Global regex. Must have the `g` flag; `redactValue` relies on it. */
  pattern: RegExp;
  /** Optional extra check — a match only redacts when this returns true. */
  confirm?: (match: string) => boolean;
  /** Spec / regulation reference, for the audit trail. */
  basis: string;
};

/** Luhn check — keeps 16 consecutive digits of an order number from being called a PAN. */
export function passesLuhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * VALUE rules, in application order. Secrets first — an API key that also happens to
 * look like something else must never survive because a later rule claimed it.
 */
export const VALUE_RULES: ValueRule[] = [
  {
    id: 'anthropic_key',
    label: 'anthropic-api-key',
    pattern: /\bsk-ant-[A-Za-z0-9_\-]{8,}/g,
    basis: 'Part V — the runner key is a separate capped workspace; it is never logged, traced or stored.',
  },
  {
    id: 'langfuse_key',
    label: 'langfuse-key',
    pattern: /\b(?:sk|pk)-lf-[A-Za-z0-9_\-]{8,}/g,
    basis: '§3.5 — Langfuse credentials never travel inside a trace payload.',
  },
  {
    id: 'generic_secret_key',
    label: 'api-key',
    pattern: /\b(?:sk|rk|api)[-_][A-Za-z0-9]{2,}[-_][A-Za-z0-9_\-]{12,}/g,
    basis: 'Part V — third-party connector credentials (Exa, Firecrawl, Slack).',
  },
  {
    id: 'aws_access_key',
    label: 'aws-access-key',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    basis: 'Part V — connector credentials.',
  },
  {
    id: 'bearer_token',
    label: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9._\-]{12,}/gi,
    basis: 'Part V — Authorization headers echoed into tool inputs.',
  },
  {
    id: 'jwt',
    label: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}\b/g,
    basis: 'Part V — session tokens.',
  },
  {
    id: 'private_key_block',
    label: 'private-key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    basis: '§3.1 — session E2E keys stay client-side and never reach a trace.',
  },
  {
    id: 'email',
    label: 'email',
    pattern: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,
    basis: 'PDPL Art. 1 — personal data: a natural person is identifiable from a work email.',
  },
  {
    id: 'iban',
    label: 'iban',
    // SA IBAN is SA + 2 check digits + 20 alphanumerics; the pattern also covers foreign IBANs.
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    basis: 'PDPL Art. 1 — financial data. SA IBANs appear in invoice and payout agent outputs.',
  },
  {
    id: 'payment_card',
    label: 'payment-card',
    pattern: /\b(?:\d[ \-]?){12,18}\d\b/g,
    confirm: passesLuhn,
    basis: 'PDPL Art. 1 + card-scheme rules — a PAN must never be stored in a trace.',
  },
  {
    id: 'saudi_id',
    label: 'national-id',
    // Saudi national ID starts with 1, Iqama (resident ID) with 2. Both are 10 digits.
    pattern: /\b[12]\d{9}\b/g,
    basis: 'PDPL Art. 1 — national identifier; the single highest-sensitivity field in our market.',
  },
  {
    id: 'phone_intl',
    label: 'phone',
    pattern: /\+\d[\d\s\-().]{7,17}\d/g,
    basis: 'PDPL Art. 1 — contact data.',
  },
  {
    id: 'phone_saudi_local',
    label: 'phone',
    pattern: /\b0(?:5\d{8}|1\d{7,8})\b/g,
    basis: 'PDPL Art. 1 — local-format KSA mobile and landline numbers.',
  },
  {
    id: 'ipv4',
    label: 'ip-address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    basis: 'PDPL Art. 1 — an IP is personal data when it can be linked to a person.',
  },
];

/**
 * KEY rules. The key's whole value is replaced, at any depth, whatever its type.
 * Matching is on the key normalised to lowercase alphanumerics, so `client_name`,
 * `clientName` and `Client Name` are the same key.
 *
 * Deliberately NOT here: `name`, `title`, `label`, `description`. Those carry agent,
 * tool and department names on every single span — denylisting them would redact the
 * trace into uselessness and teach everyone to distrust the redactor.
 *
 * `body` IS here, and it is the one entry whose reasoning differs from every other.
 * Added 2026-08-18 by `rtl-arabic-pdpl-specialist` (the rule-set owner) under the §9.3
 * ruling; routed to `observability-engineer` as a decision-request, not a silent edit.
 * Every other key on this list names a value with a *known shape* — an IBAN, a national
 * id, a phone. `body` names the opposite: it is the key under which **free text a human
 * typed** conventionally travels, in `ops.message`, in an email tool's output, in an HTTP
 * response from a client's CRM. `contracts/thread-model.md` §7 rules that such text may
 * never leave the process as observability data at any granularity, and the primary
 * defence is structural (`messageSpanAttributes` is a type with no `body` field). This is
 * the **backstop for when that discipline is bypassed**: before it existed, passing a
 * whole `ThreadMessage` to `trace.event()` shipped the body verbatim in three places, and
 * nothing went red. It does not carry our own identifiers the way `name` does — nothing in
 * this product's chrome puts a `body` key on a span — so the trace-legibility cost that
 * keeps `name` off this list does not apply.
 *
 * Note what it does NOT reach, because a backstop that is mistaken for the defence is
 * worse than none: a body composed into prose under any other key (`{ frame: '[note from
 * human:maher: …]' }`) has no `body:` separator and leaks in full. Flattening still wins
 * against a key rule. `body` on this list narrows the accident; only the structural rule
 * closes it.
 */
export const KEY_DENYLIST: string[] = [
  // credentials
  'password', 'passwd', 'secret', 'apikey', 'apisecret', 'token', 'accesstoken',
  'refreshtoken', 'authorization', 'auth', 'privatekey', 'clientsecret', 'sessionkey',
  'encryptionkey', 'anthropicapikey', 'langfusesecretkey', 'langfusepublickey',
  'postgrespassword', 'credential', 'credentials',
  // direct identifiers
  'nationalid', 'iqama', 'iqamanumber', 'passport', 'passportnumber', 'ssn',
  'dateofbirth', 'dob', 'birthdate',
  // financial
  'iban', 'bankaccount', 'accountnumber', 'cardnumber', 'pan', 'cvv', 'cvc',
  'taxid', 'vatnumber', 'crnumber', 'commercialregistration', 'salary',
  // contact / person
  'email', 'emailaddress', 'phone', 'phonenumber', 'mobile', 'whatsapp',
  'address', 'streetaddress', 'postalcode', 'homeaddress',
  'clientname', 'customername', 'contactname', 'patientname', 'fullname',
  'firstname', 'lastname', 'middlename',
  // free text a human typed — see the note above. `bodyChars` normalises to `bodychars`
  // and is deliberately NOT matched: a length is not content, and the sanctioned
  // projection has to keep working or the rule gets routed around.
  'body', 'messagebody', 'emailbody', 'bodytext', 'messagetext',
  // special categories (PDPL Art. 1 "sensitive data")
  'medicalrecord', 'healthdata', 'religion', 'ethnicity', 'biometric',
];

/**
 * Keys whose STRING values skip the value pass. These carry our own identifiers and
 * would otherwise be mangled by a pattern that means nothing here.
 */
export const KEY_ALLOWLIST: string[] = [
  'agent', 'agentslug', 'department', 'cluster', 'model', 'tool', 'toolname',
  'slug', 'runid', 'traceid', 'spanid', 'status', 'tier', 'phase', 'icon',
  'trigger', 'outcome', 'cron', 'schedule',
];

/** Placeholder written in place of redacted content. Readable, greppable, unambiguous. */
export function placeholder(label: string): string {
  return `[REDACTED:${label}]`;
}

/** Longest string kept in a trace payload. A trace is evidence, not a data export. */
export const MAX_STRING_LENGTH = 2_000;
/** Deepest object nesting kept. */
export const MAX_DEPTH = 8;
/** Most array elements kept. */
export const MAX_ARRAY_LENGTH = 50;

export const normaliseKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');
