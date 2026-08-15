import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/** Unmount between tests. Without this, `screen` queries see the previous test's DOM. */
afterEach(() => cleanup());
