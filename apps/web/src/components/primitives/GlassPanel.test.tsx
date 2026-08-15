/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GlassPanel } from './GlassPanel';

describe('GlassPanel (§1.5)', () => {
  it('is --glass plus the 14px backdrop blur', () => {
    const { container } = render(<GlassPanel>drawer</GlassPanel>);
    // .glass carries both the fill and backdrop-filter (tailwind.config.ts).
    expect(container.firstElementChild!.className).toContain('glass');
  });

  it('carries the one shadow dark mode allows', () => {
    const { container } = render(<GlassPanel>drawer</GlassPanel>);
    expect(container.firstElementChild!.className).toContain('shadow-drawer');
  });

  it('drops the shadow for floating chrome that is not a drawer', () => {
    const { container } = render(
      <GlassPanel shadow="none" radius="pill">
        top bar
      </GlassPanel>,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).not.toContain('shadow-drawer');
    expect(cls).toContain('rounded-pill');
  });

  it('uses a 16–20px radius by default', () => {
    const { container } = render(<GlassPanel>x</GlassPanel>);
    expect(container.firstElementChild!.className).toMatch(/rounded-panel(-lg)?\b/);
  });
});
