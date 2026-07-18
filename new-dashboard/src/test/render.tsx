import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

export function renderRoute(
  element: ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>, options);
}

export function apiResponse(data: unknown) {
  return { data: { data, status: 'ok' } };
}
