import { useCallback, useEffect, useState } from 'react';
import { createBot, deleteBotById, listBots, listBotStats, setBotEnabledById, updateBotById } from '@/api/openapi';
import { confirmAction, toast } from '@/stores/feedback';
import { ConfigPageShell, JsonConfigDialog, LoadingState } from './ConfigurationUi';
import { errorMessage, JsonObject, objectList, parseJsonObject, prettyJson, recordId, responseData } from './model';

export default function PlatformPage() {
  const [items, setItems] = useState<JsonObject[]>([]);
  const [stats, setStats] = useState(new Map<string, JsonObject>());
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [editing, setEditing] = useState<JsonObject | null>(null); const [source, setSource] = useState('{}'); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try {
    const [botsResponse, statsResponse] = await Promise.all([listBots(), listBotStats().catch(() => null)]);
    setItems(objectList(responseData(botsResponse), ['bots', 'platforms', 'config']));
    const next = new Map<string, JsonObject>();
    objectList(responseData(statsResponse), ['platforms']).forEach((item) => next.set(recordId(item, 'id', 'bot_id'), item)); setStats(next);
  } catch (cause) { setError(errorMessage(cause, 'Failed to load platforms.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const open = (item: JsonObject | null) => { setEditing(item ?? {}); setSource(prettyJson(item ?? { id: '', type: '', enable: true })); };
  const save = async () => { let config: JsonObject; try { config = parseJsonObject(source); } catch (cause) { toast.error(errorMessage(cause, 'Invalid JSON.')); return; }
    const id = recordId(editing ?? {}, 'id', 'bot_id'); const nextId = recordId(config, 'id', 'bot_id'); const type = typeof config.type === 'string' ? config.type : '';
    if (!id && (!nextId || !type)) { toast.warning('A new platform requires id and type.'); return; }
    setSaving(true); try { if (id) await updateBotById({ body: { bot_id: id, config } }); else await createBot({ body: { id: nextId, type, enabled: config.enable !== false && config.enabled !== false, config } }); toast.success('Platform saved.'); setEditing(null); await load(); } catch (cause) { toast.error(errorMessage(cause, 'Failed to save platform.')); } finally { setSaving(false); } };
  const toggle = async (item: JsonObject) => { const id = recordId(item, 'id', 'bot_id'); if (!id) return; try { await setBotEnabledById({ body: { bot_id: id, enabled: !(item.enable ?? item.enabled ?? true) } }); await load(); } catch (cause) { toast.error(errorMessage(cause, 'Failed to update status.')); } };
  const remove = async (item: JsonObject) => { const id = recordId(item, 'id', 'bot_id'); if (!id || !await confirmAction({ danger: true, title: 'Delete platform', message: `Delete ${id}?` })) return; try { await deleteBotById({ query: { bot_id: id } }); toast.success('Platform deleted.'); await load(); } catch (cause) { toast.error(errorMessage(cause, 'Failed to delete platform.')); } };
  return <ConfigPageShell actions={<><button onClick={() => open(null)} type="button">Add platform</button><button disabled={loading} onClick={() => void load()} type="button">Refresh</button></>} description="Manage messaging platform adapters and inspect their runtime status." title="Platforms">
    <LoadingState error={error} loading={loading} /><div className="config-card-grid">{items.map((item, index) => { const id = recordId(item, 'id', 'bot_id') || `platform-${index}`; const status = stats.get(id); const enabled = (item.enable ?? item.enabled) !== false; return <article className="route-card config-record" key={id}><div><h2>{String(item.name || id)}</h2><p>{String(item.type || 'unknown')} · {String(status?.status || (enabled ? 'enabled' : 'disabled'))}</p></div><label className="config-toggle"><input checked={enabled} onChange={() => void toggle(item)} type="checkbox" /> Enabled</label><div className="monitor-actions"><button onClick={() => open(item)} type="button">Edit</button><button className="button--danger" onClick={() => void remove(item)} type="button">Delete</button></div></article>; })}</div>{!loading && !items.length && <div className="monitor-empty">No platform configured.</div>}
    <JsonConfigDialog busy={saving} onChange={setSource} onOpenChange={(value) => !value && setEditing(null)} onSave={() => void save()} open={editing !== null} title={recordId(editing ?? {}, 'id', 'bot_id') ? 'Edit platform' : 'Add platform'} value={source} />
  </ConfigPageShell>;
}
