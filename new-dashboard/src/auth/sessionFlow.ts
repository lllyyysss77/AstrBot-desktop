import type { AuthSession } from '@/auth/storage';

type Envelope = { data?: unknown; status?: string };

function responseData(response: unknown): unknown {
  if (!response || typeof response !== 'object') return undefined;
  const axiosData = (response as { data?: unknown }).data;
  if (!axiosData || typeof axiosData !== 'object') return axiosData;
  return (axiosData as Envelope).data ?? axiosData;
}

export function sessionNeedsPasswordSetup(session: AuthSession) {
  return Boolean(
    session.changePwdHint
    || (session.md5PwdHint && !session.passwordUpgradeRequired),
  );
}

export async function checkOnboardingCompleted(): Promise<boolean> {
  try {
    const { getProviderSchema, getSystemConfig } = await import('@/api/openapi');
    const configResponse = await getSystemConfig();
    const configData = responseData(configResponse) as { config?: { platform?: unknown[] } } | undefined;
    const platforms = configData?.config?.platform;
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return false;
    }

    const providerResponse = await getProviderSchema();
    const providerData = responseData(providerResponse) as {
      provider_sources?: Array<{ id?: string; provider_type?: string }>;
      providers?: Array<{
        provider_source_id?: string;
        provider_type?: string;
        type?: string;
      }>;
    } | undefined;
    const sourceTypes = new Map(
      (providerData?.provider_sources ?? []).map((source) => [source.id, source.provider_type]),
    );
    return (providerData?.providers ?? []).some((provider) => (
      provider.provider_type === 'chat_completion'
      || sourceTypes.get(provider.provider_source_id) === 'chat_completion'
      || String(provider.type ?? '').includes('chat_completion')
    ));
  } catch {
    return false;
  }
}

export async function resolveAuthenticatedRoute(
  session: AuthSession,
  onboardingCheck: () => Promise<boolean> = checkOnboardingCompleted,
) {
  if (sessionNeedsPasswordSetup(session)) return '/auth/setup';
  return await onboardingCheck() ? '/dashboard/default' : '/welcome';
}
