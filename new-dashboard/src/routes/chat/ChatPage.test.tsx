// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createChatSession,
  getChatSession,
  getConfigProfile,
  listChatConfigs,
  listChatProjects,
  listChatSessions,
  listCommands,
  listConfigRoutes,
  listProviders,
  updateChatSession,
} from '@/api/openapi';
import { apiResponse, renderRoute } from '@/test/render';
import { runChatStream } from './chatTransport';
import ChatPage from './ChatPage';

vi.mock('@/api/openapi');
vi.mock('./chatTransport', () => ({ runChatStream: vi.fn() }));
vi.mock('@/routes/configuration/ProviderPage', () => ({ default: () => <div>provider workspace</div> }));
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en-US' }, t: translate }),
}));

describe('ChatPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listChatSessions).mockResolvedValue(apiResponse({ sessions: [] }) as never);
    vi.mocked(listChatProjects).mockResolvedValue(apiResponse({ projects: [] }) as never);
    vi.mocked(listProviders).mockResolvedValue(apiResponse({ model_metadata: {}, providers: [] }) as never);
    vi.mocked(listChatConfigs).mockResolvedValue(apiResponse({ info_list: [] }) as never);
    vi.mocked(listConfigRoutes).mockResolvedValue(apiResponse({ routes: [] }) as never);
    vi.mocked(listCommands).mockResolvedValue(apiResponse({ items: [] }) as never);
    vi.mocked(getConfigProfile).mockResolvedValue(apiResponse({ config: {} }) as never);
    vi.mocked(updateChatSession).mockResolvedValue(apiResponse({}) as never);
    vi.mocked(runChatStream).mockResolvedValue(undefined);
  });

  it('renders the successful empty-chat state', async () => {
    renderRoute(<ChatPage />, { route: '/chat' });

    expect(await screen.findByText('features.chat.welcome.title')).toBeInTheDocument();
  });

  it('shows a page-level error when conversations cannot load', async () => {
    vi.mocked(listChatSessions).mockRejectedValue(new Error('conversation service unavailable'));

    renderRoute(<ChatPage />, { route: '/chat' });

    expect(await screen.findByRole('alert')).toHaveTextContent('conversation service unavailable');
  });

  it('creates a session and sends a message through the stream layer', async () => {
    const user = userEvent.setup();
    vi.mocked(createChatSession).mockResolvedValue(apiResponse({ session_id: 'session-new' }) as never);

    renderRoute(<ChatPage />, { route: '/chat' });
    const composer = await screen.findByPlaceholderText('features.chat.input.placeholder');
    await user.type(composer, 'Hello AstrBot');
    await waitFor(() => expect(screen.getByRole('button', { name: 'features.chat.input.send' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'features.chat.input.send' }));

    await waitFor(() => expect(createChatSession).toHaveBeenCalled());
    expect(runChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'send',
        message: [{ text: 'Hello AstrBot', type: 'plain' }],
        sessionId: 'session-new',
      }),
      expect.any(AbortSignal),
      expect.any(Object),
    );
  });

  it('keeps the newest conversation when requests resolve out of order', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: unknown) => void;
    vi.mocked(getChatSession)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)) as never)
      .mockResolvedValueOnce(
        apiResponse({
          history: [{ content: { message: [{ text: 'newest response', type: 'plain' }], type: 'bot' }, id: 'm2' }],
        }) as never,
      );

    render(
      <MemoryRouter initialEntries={['/chat/first']}>
        <Link to="/chat/second">Switch conversation</Link>
        <Routes>
          <Route element={<ChatPage />} path="/chat/:conversationId" />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('link', { name: 'Switch conversation' }));
    expect(await screen.findByText('newest response')).toBeInTheDocument();
    resolveFirst(
      apiResponse({
        history: [{ content: { message: [{ text: 'stale response', type: 'plain' }], type: 'bot' }, id: 'm1' }],
      }),
    );

    await waitFor(() => expect(screen.queryByText('stale response')).not.toBeInTheDocument());
    expect(screen.getByText('newest response')).toBeInTheDocument();
  });
});
