import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';

import { getSubagentConfig, listPersonas, listProviders, updateSubagentConfig } from '@/api/openapi';
import { MdiIcon } from '@/components/icons/MdiIcon';
import { confirmAction, toast } from '@/stores/feedback';
import {
  EMPTY_SUBAGENT_CONFIG,
  newSubagent,
  normalizeSubagentConfig,
  serializeSubagentConfig,
  subagentPayload,
  validateSubagentConfig,
  type SubagentConfig,
  type SubagentItem,
} from './subagentModel';
import { errorMessage, type JsonObject, objectList, recordId, responseData } from './model';

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default function SubagentPage() {
  const { t } = useTranslation();
  const prefix = 'features.subagent';
  const k = (key: string, values?: Record<string, unknown>) => t(`${prefix}.${key}`, values);
  const keyCounter = useRef(0);
  const createKey = useCallback(() => `${Date.now()}_${keyCounter.current++}`, []);
  const [config, setConfig] = useState<SubagentConfig>(EMPTY_SUBAGENT_CONFIG);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [personas, setPersonas] = useState<JsonObject[]>([]);
  const [providers, setProviders] = useState<JsonObject[]>([]);

  const snapshot = useMemo(() => serializeSubagentConfig(config), [config]);
  const hasUnsavedChanges = loaded && snapshot !== savedSnapshot;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [configResponse, personaResponse, providerResponse] = await Promise.all([
        getSubagentConfig(),
        listPersonas(),
        listProviders({ query: { capability: 'chat' } }).catch(() => null),
      ]);
      const next = normalizeSubagentConfig(responseData(configResponse), createKey);
      setConfig(next);
      setSavedSnapshot(serializeSubagentConfig(next));
      setExpanded(new Set());
      setPersonas(objectList(responseData(personaResponse), ['personas', 'items']));
      setProviders(providerResponse ? objectList(responseData(providerResponse), ['providers', 'items', 'data']) : []);
      setLoaded(true);
    } catch (cause) {
      setError(errorMessage(cause, k('messages.loadConfigFailed')));
    } finally { setLoading(false); }
  }, [createKey, t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedChanges]);

  const blocker = useBlocker(hasUnsavedChanges);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirmAction({ title: k('page.title'), message: k('messages.unsavedChangesLeaveConfirm') }).then((confirmed) => {
      if (confirmed) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker.state]);

  const reload = async () => {
    if (hasUnsavedChanges && !await confirmAction({ title: k('actions.refresh'), message: k('messages.unsavedChangesReloadConfirm') })) return;
    await load();
  };
  const save = async () => {
    const validation = validateSubagentConfig(config);
    if (validation) { toast.warning(k(`messages.${validation.key}`, validation.values)); return; }
    setSaving(true);
    try {
      await updateSubagentConfig({ body: subagentPayload(config) });
      setSavedSnapshot(serializeSubagentConfig(config));
      setLoaded(true);
      toast.success(k('messages.saveSuccess'));
    } catch (cause) { toast.error(errorMessage(cause, k('messages.saveFailed'))); }
    finally { setSaving(false); }
  };
  const addAgent = () => {
    const agent = newSubagent(createKey());
    setConfig((current) => ({ ...current, agents: [...current.agents, agent] }));
    setExpanded((current) => new Set(current).add(agent.key));
  };
  const updateAgent = <Key extends keyof SubagentItem>(index: number, key: Key, value: SubagentItem[Key]) => {
    setConfig((current) => ({ ...current, agents: current.agents.map((agent, agentIndex) => agentIndex === index ? { ...agent, [key]: value } : agent) }));
  };
  const removeAgent = (index: number) => {
    const removed = config.agents[index];
    setConfig((current) => ({ ...current, agents: current.agents.filter((_, agentIndex) => agentIndex !== index) }));
    if (removed) setExpanded((current) => { const next = new Set(current); next.delete(removed.key); return next; });
  };
  const toggleExpanded = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return <div className="subagent-page-react">
    <div className="subagent-page-react__inner">
      <header className="subagent-header"><div><div><h1>{k('page.title')}</h1><span>{k('page.beta')}</span></div><p>{k('page.subtitle')}</p></div><div><button disabled={loading} onClick={() => void reload()} type="button"><MdiIcon className={loading ? 'mdi-spin' : ''} name="mdi-refresh" />{k('actions.refresh')}</button><button className="button--primary" disabled={loading || saving || !hasUnsavedChanges} onClick={() => void save()} type="button"><MdiIcon name="mdi-content-save" />{k('actions.save')}</button></div></header>
      {hasUnsavedChanges && <div className="subagent-unsaved" role="status"><MdiIcon name="mdi-alert-circle-outline" />{k('messages.unsavedChangesNotice')}</div>}
      {error && <div className="monitor-error" role="alert">{error}</div>}
      {loading ? <div className="monitor-loading"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : <>
        <section className="subagent-section-head"><div><h2>{k('section.globalSettings')}</h2><p>{k(config.mainEnable ? 'description.enabled' : 'description.disabled')}</p></div></section>
        <div className="subagent-global-grid"><SettingCard checked={config.mainEnable} description={k('switches.enableHint')} onChange={(checked) => setConfig((current) => ({ ...current, mainEnable: checked }))} title={k('switches.enable')} /><SettingCard checked={config.removeMainDuplicateTools} description={k('switches.dedupeHint')} disabled={!config.mainEnable} onChange={(checked) => setConfig((current) => ({ ...current, removeMainDuplicateTools: checked }))} title={k('switches.dedupe')} /></div>
        <section className="subagent-section-head subagent-section-head--agents"><div><h2>{k('section.title')}</h2><p>{k('section.subtitle')}</p></div><div><span><MdiIcon name="mdi-robot-outline" />{config.agents.length}</span><button className="button--primary" onClick={addAgent} type="button"><MdiIcon name="mdi-plus" />{k('actions.add')}</button></div></section>
        {config.agents.length === 0 ? <section className="subagent-empty"><MdiIcon name="mdi-robot-off" /><h2>{k('empty.title')}</h2><p>{k('empty.subtitle')}</p><button className="button--primary" onClick={addAgent} type="button"><MdiIcon name="mdi-plus" />{k('empty.action')}</button></section> : <div className="subagent-list-react">{config.agents.map((agent, index) => {
          const isExpanded = expanded.has(agent.key);
          const persona = personas.find((item) => recordId(item, 'persona_id', 'id') === agent.personaId);
          return <article className="subagent-card" key={agent.key}><header><div className="subagent-card__summary"><span className={agent.enabled ? 'is-enabled' : ''} /><div><div><h2>{agent.name || k('cards.unnamed')}</h2><em className={agent.enabled ? 'is-enabled' : ''}>{k(agent.enabled ? 'cards.statusEnabled' : 'cards.statusDisabled')}</em></div><p>{agent.publicDescription || k('cards.noDescription')}</p></div></div><div className="subagent-card__actions"><button onClick={() => toggleExpanded(agent.key)} type="button">{k(isExpanded ? 'actions.collapse' : 'actions.expand')}<MdiIcon name={isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'} /></button><label className="cron-switch" title={k('cards.switchLabel')}><input checked={agent.enabled} onChange={(event) => updateAgent(index, 'enabled', event.target.checked)} type="checkbox" /><span /></label><button className="button--danger" onClick={() => removeAgent(index)} title={k('actions.delete')} type="button"><MdiIcon name="mdi-delete-outline" /></button></div></header>{isExpanded && <div className="subagent-card__editor"><section><h3>{k('section.agentSetup')}</h3><div className="subagent-form"><label><span>{k('form.nameLabel')}</span><input aria-invalid={Boolean(agent.name && !/^[a-z][a-z0-9_]{0,63}$/.test(agent.name))} onChange={(event) => updateAgent(index, 'name', event.target.value)} placeholder="research_agent" value={agent.name} /><small>{k('form.nameHint')}</small></label><label><span>{k('form.providerLabel')}</span><select onChange={(event) => updateAgent(index, 'providerId', event.target.value || undefined)} value={agent.providerId || ''}><option value="">—</option>{providers.map((provider, providerIndex) => { const id = recordId(provider, 'id', 'provider_id') || `provider-${providerIndex}`; return <option key={id} value={id}>{String(provider.name || provider.model || id)}</option>; })}</select><small>{k('form.providerHint')}</small></label><label><span>{k('form.personaLabel')}</span><select onChange={(event) => updateAgent(index, 'personaId', event.target.value)} value={agent.personaId}><option value="">—</option>{personas.map((item, personaIndex) => { const id = recordId(item, 'persona_id', 'id') || `persona-${personaIndex}`; return <option key={id} value={id}>{id}</option>; })}</select><small>{k('form.personaHint')}</small></label><label><span>{k('form.descriptionLabel')}</span><textarea onChange={(event) => updateAgent(index, 'publicDescription', event.target.value)} rows={4} value={agent.publicDescription} /><small>{k('form.descriptionHint')}</small></label></div></section><PersonaPreview k={k} persona={persona} personaId={agent.personaId} /></div>}</article>;
        })}</div>}
      </>}
    </div>
  </div>;
}

function SettingCard({ checked, description, disabled, onChange, title }: { checked: boolean; description: string; disabled?: boolean; onChange: (checked: boolean) => void; title: string }) {
  return <section className={disabled ? 'is-disabled' : ''}><div><h3>{title}</h3><p>{description}</p></div><label className="cron-switch"><input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span /></label></section>;
}

function PersonaPreview({ k, persona, personaId }: { k: (key: string, values?: Record<string, unknown>) => string; persona?: JsonObject; personaId: string }) {
  const tools = stringList(persona?.tools);
  const skills = stringList(persona?.skills);
  return <section className="subagent-persona-preview"><h3>{k('cards.personaPreview')}</h3><p>{k('cards.previewHint')}</p>{persona ? <div><header><MdiIcon name="mdi-account-heart" /><strong>{personaId}</strong></header><pre>{String(persona.system_prompt || '')}</pre><footer>{tools.map((tool) => <span key={`tool-${tool}`}><MdiIcon name="mdi-tools" />{tool}</span>)}{skills.map((skill) => <span key={`skill-${skill}`}><MdiIcon name="mdi-lightning-bolt" />{skill}</span>)}</footer></div> : <div className="monitor-empty"><MdiIcon name="mdi-account-heart" />{personaId ? k('messages.loadPersonaFailed') : k('form.personaHint')}</div>}</section>;
}
