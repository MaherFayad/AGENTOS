'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphDelta, GraphNode, GraphPayload } from '@agnetos/contracts';
import { applyBrainCompleteness, applyGraphDelta } from './delta';
import { parseGraphPayload } from './parse';
import { graphArtifactUrl, graphHttpUrl, graphSocketUrl } from './socket';

export type GraphResource =
  | { state: 'loading' }
  | { state: 'ready'; data: GraphPayload }
  | { state: 'unavailable'; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function messageFromBody(json: unknown, fallback: string): string {
  if (!isRecord(json) || !isRecord(json.error)) return fallback;
  const message = json.error.message;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}

async function fetchPayload(url: string, signal: AbortSignal): Promise<GraphPayload | { message: string } | 'abort'> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (response.status === 404 || response.status === 501 || response.status === 503) {
      const body: unknown = await response.json().catch(() => null);
      return {
        message: messageFromBody(
          body,
          'The map layout has not been built yet. Run `npm run graph:build` — until then the galaxy is empty on purpose.',
        ),
      };
    }
    if (!response.ok) {
      return { message: "Can't reach the runner, so there is no map to draw." };
    }
    const parsed = parseGraphPayload(await response.json());
    if (!parsed) {
      return { message: 'The map layout is not a graph payload, so nothing is drawn.' };
    }
    return parsed;
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) return 'abort';
    return { message: "Can't reach the runner, so there is no map to draw." };
  }
}

async function loadGraph(signal: AbortSignal): Promise<GraphResource | 'abort'> {
  const primary = await fetchPayload(graphHttpUrl(), signal);
  if (primary === 'abort') return 'abort';
  if (!('message' in primary)) return { state: 'ready', data: primary };

  const fallback = await fetchPayload(graphArtifactUrl(), signal);
  if (fallback === 'abort') return 'abort';
  if (!('message' in fallback)) return { state: 'ready', data: fallback };

  return { state: 'unavailable', message: primary.message };
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
 * One fetch of the stored layout, then `/ws/graph` deltas. No polling — search already
 * polls `/api/graph`, and a second interval would fight the live-drop animation.
 */
export function useGraph(provided?: GraphPayload): {
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

    const controller = new AbortController();
    void loadGraph(controller.signal).then((result) => {
      if (result === 'abort') return;
      if (result.state === 'ready') payloadRef.current = result.data;
      setResource(result);
    });

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(graphSocketUrl());
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
          void loadGraph(controller.signal).then((result) => {
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
  }, [provided]);

  useEffect(() => {
    if (arrivingIds.size === 0) return;
    const frame = requestAnimationFrame(() => setArrivingIds(new Set()));
    return () => cancelAnimationFrame(frame);
  }, [arrivingIds]);

  return { resource, arrivingIds };
}
