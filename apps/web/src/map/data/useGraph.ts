'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphDelta, GraphNode, GraphPayload } from '@agnetos/contracts';
import { applyBrainCompleteness, applyGraphDelta } from './delta';
import { parseGraphPayload } from './parse';
import { graphArtifactUrl, graphHttpUrl, graphSocketUrl } from './socket';

/**
 * Why there is no map, in two parts: a catalogue key we can translate, and the
 * runner's own English sentence when it sent one.
 *
 * They are kept apart rather than collapsed into one `message` string because
 * only one of them survives a change of locale. `serverOrCatalogue` (i18n) picks:
 * in English the runner's sentence is more specific and wins; in Arabic an
 * English sentence is not more specific, it is unreadable, and the catalogue
 * wins. Localising the runner's half means it sends a key and its variables —
 * `api-contracts.md`, `runner-engineer`'s, filed rather than assumed.
 */
export interface GraphUnavailable {
  state: 'unavailable';
  reason: MapEmptyKey;
  /** The runner's own English sentence, or null when it sent none. */
  serverMessage: string | null;
}

export type MapEmptyKey = 'map.empty.notBuilt' | 'map.empty.malformed' | 'map.empty.offline';

export type GraphResource =
  | { state: 'loading' }
  | { state: 'ready'; data: GraphPayload }
  | GraphUnavailable;

type Failure = { reason: MapEmptyKey; serverMessage: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function messageFromBody(json: unknown): string | null {
  if (!isRecord(json) || !isRecord(json.error)) return null;
  const message = json.error.message;
  return typeof message === 'string' && message.length > 0 ? message : null;
}

async function fetchPayload(url: string, signal: AbortSignal): Promise<GraphPayload | Failure | 'abort'> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (response.status === 404 || response.status === 501 || response.status === 503) {
      const body: unknown = await response.json().catch(() => null);
      return { reason: 'map.empty.notBuilt', serverMessage: messageFromBody(body) };
    }
    if (!response.ok) {
      return { reason: 'map.empty.offline', serverMessage: null };
    }
    const parsed = parseGraphPayload(await response.json());
    if (!parsed) {
      return { reason: 'map.empty.malformed', serverMessage: null };
    }
    return parsed;
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) return 'abort';
    return { reason: 'map.empty.offline', serverMessage: null };
  }
}

async function loadGraph(project: string, signal: AbortSignal): Promise<GraphResource | 'abort'> {
  const url = graphHttpUrl(project);
  if (url === null) return 'abort';
  const primary = await fetchPayload(url, signal);
  if (primary === 'abort') return 'abort';
  if (!('reason' in primary)) return { state: 'ready', data: primary };

  const fallback = await fetchPayload(graphArtifactUrl(), signal);
  if (fallback === 'abort') return 'abort';
  if (!('reason' in fallback)) return { state: 'ready', data: fallback };

  return { state: 'unavailable', reason: primary.reason, serverMessage: primary.serverMessage };
}

function parseDelta(raw: unknown): GraphDelta | null {
  if (!isRecord(raw)) return null;
  const version = typeof raw.version === 'string' ? raw.version : '';
  const added = Array.isArray(raw.added) ? (raw.added as GraphNode[]) : [];
  const changed = Array.isArray(raw.changed) ? (raw.changed as GraphNode[]) : [];
  const removed = Array.isArray(raw.removed)
    ? raw.removed.filter((id): id is string => typeof id === 'string')
    : [];
  const edges = Array.isArray(raw.edges) ? raw.edges : undefined;
  const core = isRecord(raw.core) ? (raw.core as unknown as GraphDelta['core']) : undefined;
  return { version, added, changed, removed, edges, core } as GraphDelta;
}

/**
 * One fetch of the stored layout, then `WS /ws/p/:project/graph` deltas. No polling —
 * search already polls the same graph route on its own interval, and a second one would
 * fight the live-drop animation.
 *
 * ## `project === null` waits; it does not ask
 *
 * There are only two honest answers to "the URL names no project" and this is the one
 * chosen (M15 / REQ-MAP-39): **issue no request of any kind and stay `loading`.** Not the
 * unscoped route, which now answers 400 and whose swallowed failure is exactly how this
 * regression stayed invisible for a milestone; and not the `/graph.json` artifact either,
 * because an artifact that names no project would put an unlabelled roster on screen under
 * whatever heading the reader supplies from memory.
 *
 * `loading` rather than an empty state because "not yet" is literally what is true.
 * `MapView` is only mounted by `app/(views)/p/[project]/map/**`, so a null segment is not
 * a state a person can navigate to: it means the pathname has not resolved yet, and a
 * pre-M15 link is being rewritten by `[...legacy]/page.tsx` — which renders its own
 * message, not the galaxy. Nothing is being hidden here, because nothing was asked.
 */
export function useGraph(
  project: string | null,
  provided?: GraphPayload,
): {
  resource: GraphResource;
  arrivingIds: ReadonlySet<string>;
} {
  const [resource, setResource] = useState<GraphResource>(
    provided ? { state: 'ready', data: provided } : { state: 'loading' },
  );
  const [arrivingIds, setArrivingIds] = useState<ReadonlySet<string>>(new Set());
  const payloadRef = useRef<GraphPayload | null>(provided ?? null);

  useEffect(() => {
    if (provided) {
      payloadRef.current = provided;
      setResource({ state: 'ready', data: provided });
      return;
    }

    // No project ⇒ no fetch, no socket, no artifact. See the note on this function.
    if (project === null) return;

    const controller = new AbortController();
    void loadGraph(project, controller.signal).then((result) => {
      if (result === 'abort') return;
      if (result.state === 'ready') payloadRef.current = result.data;
      setResource(result);
    });

    const socketUrl = graphSocketUrl(project);
    let socket: WebSocket | null = null;
    try {
      socket = socketUrl === null ? null : new WebSocket(socketUrl);
    } catch {
      socket = null;
    }

    if (socket) {
      socket.addEventListener('message', (event) => {
        let frame: unknown;
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!isRecord(frame) || typeof frame.type !== 'string') return;

        if (frame.type === 'hello' && typeof frame.brainCompleteness === 'number') {
          const current = payloadRef.current;
          if (!current) return;
          const next = applyBrainCompleteness(current, frame.brainCompleteness);
          payloadRef.current = next;
          setResource({ state: 'ready', data: next });
          return;
        }

        if (frame.type === 'stale') {
          void loadGraph(project, controller.signal).then((result) => {
            if (result === 'abort') return;
            if (result.state === 'ready') payloadRef.current = result.data;
            setResource(result);
          });
          return;
        }

        if (frame.type !== 'delta') return;
        const delta = parseDelta(isRecord(frame.delta) ? frame.delta : frame);
        const current = payloadRef.current;
        if (!delta || !current) return;
        const next = applyGraphDelta(current, delta);
        payloadRef.current = next;
        setResource({ state: 'ready', data: next });
        if (delta.added.length > 0) {
          setArrivingIds(new Set(delta.added.map((n) => n.id)));
        }
      });
    }

    return () => {
      controller.abort();
      socket?.close();
    };
  }, [project, provided]);

  useEffect(() => {
    if (arrivingIds.size === 0) return;
    const frame = requestAnimationFrame(() => setArrivingIds(new Set()));
    return () => cancelAnimationFrame(frame);
  }, [arrivingIds]);

  return { resource, arrivingIds };
}
