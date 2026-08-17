import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectSwitcher } from './ProjectSwitcher';
import { LegacyRouteResolver } from './LegacyRouteResolver';
import { PROJECTS_FIXTURE, renderShell, routerMock, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

afterEach(() => {
  vi.unstubAllGlobals();
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
});

/** `GET /api/projects` with two mounted-ish rows, for the cases one row cannot exercise. */
const TWO_PROJECTS = {
  ...PROJECTS_FIXTURE,
  projects: [
    ...PROJECTS_FIXTURE.projects,
    {
      ...PROJECTS_FIXTURE.projects[0],
      id: 'b2c3d4e5-0000-0000-0000-000000000000',
      slug: 'client-x',
      name: 'Client X',
    },
  ],
};

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^project:/i });

describe('ProjectSwitcher — what it says it knows (M15, `Plan §23.10`)', () => {
  it('shows the runner’s name for the project once the runner confirms the slug', async () => {
    stubFetch({ '/api/projects': { json: PROJECTS_FIXTURE } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    expect(trigger().dataset.projectConfirmed).toBe('true');
  });

  it('shows the URL’s slug and marks it unconfirmed when /api/projects is not built', async () => {
    stubFetch({}); // 404
    renderShell(<ProjectSwitcher />);
    // The slug is still shown — it is the one thing that is certainly true about which
    // project this page is addressing. What is withheld is the claim that it exists.
    await waitFor(() => expect(screen.getByText('agentos')).toBeTruthy());
    expect(trigger().dataset.projectConfirmed).toBe('false');
    expect(trigger().getAttribute('title')).toMatch(/does not list projects yet/i);
  });

  it('says the URL names a project the runner does not serve, rather than 404ing later', async () => {
    stubFetch({ '/api/projects': { json: PROJECTS_FIXTURE } });
    renderShell(<ProjectSwitcher />, { pathname: '/p/ghost/map' });
    await waitFor(() => expect(trigger().dataset.projectConfirmed).toBe('false'));
    fireEvent.click(trigger());
    expect(screen.getByText(/does not list a project called “ghost”/i)).toBeTruthy();
  });

  it('says out loud that one project cannot demonstrate scoping', async () => {
    stubFetch({ '/api/projects': { json: PROJECTS_FIXTURE } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.click(trigger());
    // `project-scoping.md` §6, on screen: structural, not empirical.
    expect(screen.getByText(/nothing here shows that project scoping works/i)).toBeTruthy();
  });

  it('prints the runner’s own admission that isolation is not enforced', async () => {
    stubFetch({ '/api/projects': { json: { ...PROJECTS_FIXTURE, scopeEnforced: false } } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.click(trigger());
    expect(screen.getByText(/bypasses row-level security/i)).toBeTruthy();
  });

  it('keeps "not reported" apart from "not enforced"', async () => {
    stubFetch({ '/api/projects': { json: { ...PROJECTS_FIXTURE, scopeEnforced: null } } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.click(trigger());
    expect(screen.getByText(/did not say whether project isolation is enforced/i)).toBeTruthy();
    expect(screen.queryByText(/bypasses row-level security/i)).toBeNull();
  });

  it('marks a listed project this coordinator cannot serve as elsewhere', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.click(trigger());
    expect(screen.getByText('mounted')).toBeTruthy();
    expect(screen.getByText('elsewhere')).toBeTruthy();
  });
});

describe('ProjectSwitcher — keyboard before pointer (`Plan §23.11` rule 7)', () => {
  it('opens on ⌘K from anywhere and exposes a real listbox', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const list = await waitFor(() => screen.getByRole('listbox', { name: /projects/i }));
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    // Focus and `aria-activedescendant` are on the list, which is the only element they
    // mean anything on — a screen reader follows the arrow keys from here.
    expect(document.activeElement).toBe(list);
    expect(list.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]?.id,
    );
  });

  it('walks with the arrow keys and selects with Enter', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(<ProjectSwitcher />, { pathname: '/p/agentos/map/sales/account-enrichment' });
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' }); // trigger opens…
    const list = screen.getByRole('listbox'); // …and the list takes focus from there
    fireEvent.keyDown(list, { key: 'ArrowDown' }); // agentos → client-x
    fireEvent.keyDown(list, { key: 'Enter' });

    // The department transfers, the agent does not: `project-scoping.md` invariant 6 plus
    // ADR-014 §2 — the same slug in two projects is a different agent.
    expect(routerMock.push).toHaveBeenCalledWith('/p/client-x/map/sales');
  });

  it('closes on Escape without navigating', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('does not navigate when you pick the project you are already in', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(<ProjectSwitcher />);
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: /AgentOS/ }));
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  /**
   * From the RTL arrow-key audit that fixed §2.0's tablist. The switcher is a **vertical**
   * listbox, and `dir` does not touch the block axis: ArrowDown is the next project in both
   * directions, and `Home`/`End` are ordinals rather than edges. Correct already — pinned so
   * that a later "make the shell RTL-aware" pass cannot turn a right answer into a wrong one
   * by symmetry. Reading order mirrors; the block axis and ordinals do not.
   */
  it('RTL: ArrowDown still walks forward, and Home/End stay ordinal', async () => {
    stubFetch({ '/api/projects': { json: TWO_PROJECTS } });
    renderShell(
      <div dir="rtl">
        <ProjectSwitcher />
      </div>,
      { pathname: '/p/agentos/map/sales/account-enrichment' },
    );
    await waitFor(() => expect(screen.getByText('AgentOS')).toBeTruthy());

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' }); // agentos → client-x, as in LTR
    expect(screen.getByRole('option', { name: /Client X/ }).id).toBe(
      list.getAttribute('aria-activedescendant'),
    );

    fireEvent.keyDown(list, { key: 'Home' }); // "the first project", not "the leading edge"
    expect(screen.getByRole('option', { name: /AgentOS/ }).id).toBe(
      list.getAttribute('aria-activedescendant'),
    );
  });
});

describe('LegacyRouteResolver — a link that does not name a project', () => {
  it('asks the runner which project it mounts and rewrites the URL to say so', async () => {
    stubFetch({ '/api/projects': { json: PROJECTS_FIXTURE } });
    renderShell(<LegacyRouteResolver />, { pathname: '/map/sales' });
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/p/agentos/map/sales'));
  });

  it('picks nothing when it cannot ask — the clause that makes this not a default', async () => {
    stubFetch({}); // /api/projects 404s
    renderShell(<LegacyRouteResolver />, { pathname: '/map/sales' });
    await waitFor(() => expect(screen.getByText(/does not name a project/i)).toBeTruthy());
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('picks nothing when the runner answers without naming a mounted project', async () => {
    stubFetch({ '/api/projects': { json: { projects: [], mounted: null, scopeEnforced: null } } });
    renderShell(<LegacyRouteResolver />, { pathname: '/dashboards' });
    await waitFor(() => expect(screen.getByText(/No project to open/i)).toBeTruthy());
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
