import { redirect } from 'next/navigation';

/**
 * `/` is MAP (§2.0 default tab, REQ-SHELL-51). The chrome lives on the `(views)`
 * route group, so the root must send people there rather than render a second,
 * shell-less page. Replaces the M0 scaffold.
 */
export default function Page(): never {
  redirect('/map');
}
