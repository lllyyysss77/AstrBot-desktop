// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProviderSchema, listProviders, setProviderEnabledById } from '@/api/openapi';
import { apiResponse, renderRoute } from '@/test/render';
import ProviderPage from './ProviderPage';

vi.mock('@/api/openapi');
vi.mock('@/components/config/DynamicConfigForm', () => ({ ConfigGroup: () => <div data-testid="config-group" /> }));
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en-US' }, t: translate }),
}));

const schema = (providers: unknown[] = []) =>
  apiResponse({
    config_schema: { provider: { config_template: {} } },
    model_metadata: {},
    provider_sources: [],
    providers,
  });

describe('ProviderPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listProviders).mockResolvedValue(apiResponse({ providers: [] }) as never);
  });

  it('renders loading, empty and successful provider states', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(getProviderSchema).mockReturnValue(new Promise((done) => (resolve = done)) as never);

    renderRoute(<ProviderPage />, { route: '/providers' });
    expect(screen.getByText('core.common.loading')).toBeInTheDocument();
    resolve(schema([]));

    expect(await screen.findByText('features.provider.providerSources.empty')).toBeInTheDocument();
  });

  it('shows an error after schema and fallback requests fail', async () => {
    vi.mocked(getProviderSchema).mockRejectedValue(new Error('schema unavailable'));
    vi.mocked(listProviders).mockRejectedValue(new Error('fallback unavailable'));

    renderRoute(<ProviderPage />, { route: '/providers' });

    expect(await screen.findByRole('alert')).toHaveTextContent('schema unavailable');
  });

  it('toggles a provider through the page control', async () => {
    const user = userEvent.setup();
    vi.mocked(getProviderSchema).mockResolvedValue(
      schema([{ enabled: true, id: 'embed-provider', model: 'embed-v1', provider_type: 'embedding' }]) as never,
    );
    vi.mocked(setProviderEnabledById).mockResolvedValue(apiResponse({}) as never);

    renderRoute(<ProviderPage />, { route: '/providers' });
    await user.click(await screen.findByRole('button', { name: 'features.provider.providers.tabs.embedding' }));
    await user.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(setProviderEnabledById).toHaveBeenCalledWith({
        body: { enabled: false, provider_id: 'embed-provider' },
      }),
    );
  });
});
