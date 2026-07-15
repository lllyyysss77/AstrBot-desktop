import { describe, expect, it } from 'vitest';
import { appendStreamPayload, normalizeRecord, parseSseEvents, sessionList, stagedAttachmentType } from './model';

describe('chat model', () => {
  it('classifies recorded audio as a record attachment', () => {
    expect(stagedAttachmentType('record', 'application/octet-stream')).toBe('record');
    expect(stagedAttachmentType(undefined, 'audio/webm;codecs=opus')).toBe('record');
    expect(stagedAttachmentType(undefined, 'image/png')).toBe('image');
  });

  it('normalizes stored history and appends streaming text', () => {
    const record = normalizeRecord({ sender_id: 'bot', content: { message: 'Hello' } });
    appendStreamPayload(record, { type: 'plain', data: ' world', streaming: true });
    appendStreamPayload(record, { type: 'plain', data: { content: '!' }, streaming: true });
    expect(record.content.type).toBe('bot');
    expect(record.content.message[0].text).toBe('Hello world!');
  });

  it('merges streaming reasoning chunks', () => {
    const record = normalizeRecord({ sender_id: 'bot', content: { message: [] } });
    appendStreamPayload(record, { type: 'plain', chain_type: 'reasoning', data: { message: 'Step ' } });
    appendStreamPayload(record, { type: 'plain', chain_type: 'reasoning', data: { text: 'one' } });
    expect(record.content.reasoning).toBe('Step one');
    expect(record.content.message).toEqual([{ type: 'think', think: 'Step one' }]);
  });

  it('parses complete SSE events and preserves an incomplete event', () => {
    const result = parseSseEvents('data: {"type":"plain","data":"A"}\n\ndata: {"type"');
    expect(result.payloads).toEqual([{ type: 'plain', data: 'A' }]);
    expect(result.remainder).toBe('data: {"type"');
  });

  it('accepts list and envelope session shapes', () => {
    expect(sessionList([{ session_id: 'a' }])).toHaveLength(1);
    expect(sessionList({ sessions: [{ session_id: 'b' }] })[0].session_id).toBe('b');
  });
});
