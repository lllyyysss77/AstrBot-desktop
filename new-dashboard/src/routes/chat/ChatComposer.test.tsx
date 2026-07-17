import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChatComposer } from './ChatComposer';

describe('ChatComposer', () => {
  it('disables configuration changes while the composer is busy', () => {
    const markup = renderToStaticMarkup(
      <ChatComposer
        commandSuggestionsLabel="Commands"
        configs={[{ id: 'default', name: 'Default' }, { id: 'profile-1', name: 'Profile 1' }]}
        configId="default"
        disabled
        onChange={() => undefined}
        onConfigChange={() => undefined}
        onSend={() => undefined}
        value=""
      />,
    );

    expect(markup).toContain('<select aria-label="Configuration" disabled=""');
  });
});
