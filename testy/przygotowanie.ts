import '@testing-library/jest-dom/vitest';
import { cleanup as posprzataj } from '@testing-library/react';
import { afterEach as poKazdymTescie, vi as atrapy } from 'vitest';

poKazdymTescie(posprzataj);

atrapy.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: atrapy.fn(() => ({
    needRefresh: [false, atrapy.fn()],
    updateServiceWorker: atrapy.fn(),
  })),
}));
