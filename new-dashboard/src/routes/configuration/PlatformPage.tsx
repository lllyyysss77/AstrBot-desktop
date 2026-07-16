import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createBot, createConfigProfile, deleteBotById, getConfigProfileSchema, getSystemConfigRuntime, listBotStats, listConfigProfiles, setBotEnabledById, updateBotById, upsertConfigRoute } from '@/api/openapi';
import { ConfigGroup } from '@/components/config/DynamicConfigForm';
import type { ConfigGroupMetadata, ConfigRecord } from '@/components/config/configFormModel';
import { Dialog, DialogClose } from '@/components/headless/Dialog';
import { MdiIcon } from '@/components/icons/MdiIcon';
import { i18n } from '@/i18n';
import { confirmAction, toast } from '@/stores/feedback';
import { errorMessage, isObject, JsonObject, objectList, recordId, responseData } from './model';
import { hasScanAndManualCreation, isScanOnlyCreation, platformLogo, scanRegistrationComplete } from './platformAssets';
import { isValidPlatformId, mergePlatformTemplate, platformFormMetadata, platformQrPayload, platformTemplates, readPlatformRuntime, webhookUrl } from './platformModel';
import { PlatformRegistrationPanel } from './PlatformRegistrationPanel';

type EditorState = { config: JsonObject; originalId: string } | null;
type ConfigProfileOption = { id: string; name: string };

export default function PlatformPage() {
  const { t } = useTranslation();
  const tm = useCallback((key: string, options?: Record<string, unknown>) => t(`features.platform.${key}`, options), [t]);
  const [config, setConfig] = useState<JsonObject>({});
  const [metadata, setMetadata] = useState<JsonObject>({});
  const [stats, setStats] = useState(new Map<string, JsonObject>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [selectedType, setSelectedType] = useState('');
  const [configProfiles, setConfigProfiles] = useState<ConfigProfileOption[]>([{ id: 'default', name: 'default' }]);
  const [configMode, setConfigMode] = useState<'existing' | 'new'>('existing');
  const [selectedConfigId, setSelectedConfigId] = useState('default');
  const [creationMode, setCreationMode] = useState<'scan' | 'manual' | ''>('');
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<{ kind: 'error' | 'qr' | 'webhook'; item: JsonObject; stat?: JsonObject } | null>(null);

  const loadConfig = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const runtime = readPlatformRuntime(responseData(await getSystemConfigRuntime()));
      setConfig(runtime.config);
      setMetadata(runtime.metadata);
      if (runtime.translations) {
        for (const [locale, resources] of Object.entries(runtime.translations)) {
          i18n.addResourceBundle(locale, 'translation', { features: { 'config-metadata': resources } }, true, true);
        }
      }
    } catch (cause) {
      setError(errorMessage(cause, 'Failed to load platforms.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const next = new Map<string, JsonObject>();
      objectList(responseData(await listBotStats()), ['platforms']).forEach((item) => next.set(recordId(item, 'id', 'bot_id'), item));
      setStats(next);
    } catch { /* Runtime statistics are supplementary. */ }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadStats();
    const timer = window.setInterval(() => void loadStats(), 5_000);
    const localeChanged = () => void loadConfig(true);
    window.addEventListener('astrbot-locale-changed', localeChanged);
    return () => { window.clearInterval(timer); window.removeEventListener('astrbot-locale-changed', localeChanged); };
  }, [loadConfig, loadStats]);

  const items = objectList(config.platform, []);
  const templates = useMemo(() => platformTemplates(metadata), [metadata]);
  const formMetadata = useMemo(() => platformFormMetadata(metadata), [metadata]);

  const loadConfigProfiles = useCallback(async () => {
    try {
      const data = responseData(await listConfigProfiles());
      const profiles = objectList(data, ['info_list', 'configs', 'profiles']).map((profile, index) => ({
        id: recordId(profile, 'conf_id', 'id') || `profile-${index}`,
        name: String(profile.name || recordId(profile, 'conf_id', 'id') || `profile-${index}`),
      }));
      setConfigProfiles(profiles.some((profile) => profile.id === 'default') ? profiles : [{ id: 'default', name: 'default' }, ...profiles]);
    } catch { /* The default profile remains available when the profile list cannot be loaded. */ }
  }, []);

  const openCreate = () => {
    setSelectedType('');
    setConfigMode('existing');
    setSelectedConfigId('default');
    setCreationMode('');
    setEditor({ config: { id: '', type: '', enable: true }, originalId: '' });
    void loadConfigProfiles();
  };
  const openEdit = (item: JsonObject) => {
    const type = String(item.type || '');
    setSelectedType(type);
    setEditor({ config: mergePlatformTemplate(item, templates[type]), originalId: recordId(item, 'id', 'bot_id') });
  };
  const chooseType = (type: string) => {
    setSelectedType(type);
    setCreationMode('');
    setEditor({ config: mergePlatformTemplate({}, templates[type]), originalId: '' });
  };

  const save = async () => {
    if (!editor) return;
    const id = recordId(editor.config, 'id', 'bot_id');
    const type = String(editor.config.type || selectedType);
    if (!isValidPlatformId(id)) { toast.warning(tm('dialog.invalidPlatformId')); return; }
    if (!type) { toast.warning(tm('createDialog.platformTypeLabel')); return; }
    if (!editor.originalId && items.some((item) => recordId(item, 'id', 'bot_id') === id)) { toast.warning(tm('dialog.idConflict.message', { id })); return; }
    setSaving(true);
    try {
      if (editor.originalId) await updateBotById({ body: { bot_id: editor.originalId, config: editor.config } });
      else {
        await createBot({ body: { id, type, enabled: editor.config.enable !== false, config: editor.config } });
        let configId = selectedConfigId;
        if (configMode === 'new') {
          const schema = responseData<JsonObject>(await getConfigProfileSchema()) ?? {};
          const created = responseData<JsonObject>(await createConfigProfile({ body: { name: selectedConfigId.trim(), config: isObject(schema.config) ? schema.config : {} } })) ?? {};
          configId = recordId(created, 'conf_id', 'id');
        }
        if (configId) await upsertConfigRoute({ path: { umo: `${id}:*:*` }, body: { config_id: configId } });
      }
      toast.success(tm(editor.originalId ? 'messages.updateSuccess' : 'messages.addSuccess'));
      setEditor(null);
      await Promise.all([loadConfig(true), loadStats()]);
    } catch (cause) { toast.error(errorMessage(cause, tm('messages.platformUpdateFailed'))); }
    finally { setSaving(false); }
  };

  const toggle = async (item: JsonObject) => {
    const id = recordId(item, 'id', 'bot_id');
    if (!id) return;
    try {
      await setBotEnabledById({ body: { bot_id: id, enabled: (item.enable ?? item.enabled) === false } });
      toast.success(tm('messages.statusUpdateSuccess'));
      await loadConfig(true);
    } catch (cause) { toast.error(errorMessage(cause, tm('messages.platformUpdateFailed'))); }
  };

  const remove = async (item: JsonObject) => {
    const id = recordId(item, 'id', 'bot_id');
    if (!id || !await confirmAction({ danger: true, title: tm('messages.deleteConfirm'), message: `${tm('messages.deleteConfirm')} ${id}?` })) return;
    try {
      await deleteBotById({ query: { bot_id: id } });
      toast.success(tm('messages.deleteSuccess'));
      await loadConfig(true);
    } catch (cause) { toast.error(errorMessage(cause, tm('messages.platformUpdateFailed'))); }
  };

  return (
    <div className="platform-page-react">
      <header className="platform-page-react__header">
        <div className="platform-page-react__heading"><MdiIcon name="mdi-robot" /><div><h1>{tm('title')}</h1><p>{tm('subtitle')}</p></div></div>
        <button className="platform-primary-button" onClick={openCreate} type="button"><MdiIcon name="mdi-plus" />{tm('addAdapter')}</button>
      </header>

      {loading && <div className="monitor-loading" role="status">Loading…</div>}
      {error && <div className="monitor-error" role="alert">{error}</div>}
      {!loading && !items.length && <div className="platform-empty"><MdiIcon name="mdi-connection" size={58} /><p>{tm('emptyText')}</p></div>}
      <section className="platform-grid">
        {items.map((item, index) => { const type = String(item.type || ''); return <PlatformCard config={config} deleteLabel={t('core.common.itemCard.delete')} item={item} key={recordId(item, 'id', 'bot_id') || index} logo={platformLogo(type, findTemplateByType(templates, type))} onDetails={setDetails} onEdit={openEdit} onRemove={(value) => void remove(value)} onToggle={(value) => void toggle(value)} stat={stats.get(recordId(item, 'id', 'bot_id'))} t={tm} />; })}
      </section>

      <PlatformEditor configMode={configMode} configProfiles={configProfiles} creationMode={creationMode} editor={editor} formMetadata={formMetadata} onChange={(next) => setEditor((current) => current ? { ...current, config: next } : current)} onConfigModeChange={setConfigMode} onCreationModeChange={setCreationMode} onOpenChange={(open) => !open && setEditor(null)} onSave={() => void save()} onSelectedConfigChange={setSelectedConfigId} onTypeChange={chooseType} saving={saving} selectedConfigId={selectedConfigId} selectedType={selectedType} t={tm} templates={templates} />
      <DetailsDialog config={config} details={details} onOpenChange={(open) => !open && setDetails(null)} t={tm} />
    </div>
  );
}

function PlatformCard({ config, deleteLabel, item, logo, onDetails, onEdit, onRemove, onToggle, stat, t }: { config: JsonObject; deleteLabel: string; item: JsonObject; logo?: string; onDetails: (details: { kind: 'error' | 'qr' | 'webhook'; item: JsonObject; stat?: JsonObject }) => void; onEdit: (item: JsonObject) => void; onRemove: (item: JsonObject) => void; onToggle: (item: JsonObject) => void; stat?: JsonObject; t: (key: string, options?: Record<string, unknown>) => string }) {
  const id = recordId(item, 'id', 'bot_id');
  const enabled = (item.enable ?? item.enabled) !== false;
  const status = String(stat?.status || (enabled ? 'running' : 'stopped'));
  const errors = Number(stat?.error_count || 0);
  const qr = platformQrPayload(stat);
  const webhook = Boolean(stat?.unified_webhook && item.webhook_uuid);
  return <article className="platform-card">
    <div className="platform-card__watermark">{logo ? <img alt="" src={logo} /> : <MdiIcon name={platformIcon(String(item.type || id))} />}</div>
    <header><h2 title={id}>{id}</h2><label className="provider-switch" title={enabled ? t('status.enabled') : t('status.disabled')}><input checked={enabled} onChange={() => onToggle(item)} type="checkbox" /><span /></label></header>
    <div className="platform-card__badges">
      {status !== 'running' && <button className={`platform-badge platform-badge--${status}`} type="button"><MdiIcon name={statusIcon(status)} />{t(`runtimeStatus.${status === 'error' || status === 'pending' || status === 'stopped' ? status : 'unknown'}`)}</button>}
      {errors > 0 && <button className="platform-badge platform-badge--error" onClick={() => onDetails({ kind: 'error', item, stat })} type="button"><MdiIcon name="mdi-bug" />{errors} {t('runtimeStatus.errors')}</button>}
      {qr && <button className="platform-badge" onClick={() => onDetails({ kind: 'qr', item, stat })} type="button"><MdiIcon name="mdi-qrcode" />{t('platformQr.show')}</button>}
      {webhook && <button className="platform-badge" onClick={() => onDetails({ kind: 'webhook', item, stat })} title={webhookUrl(config, String(item.webhook_uuid))} type="button"><MdiIcon name="mdi-webhook" />{t('viewWebhook')}</button>}
    </div>
    <footer><button className="button--danger" onClick={() => onRemove(item)} type="button">{deleteLabel}</button><button className="platform-card__edit" onClick={() => onEdit(item)} type="button">{t('dialog.edit')}</button></footer>
  </article>;
}

function PlatformSelect({ ariaLabel, imageForValue, onChange, options, placeholder, value }: { ariaLabel: string; imageForValue?: (value: string) => string | undefined; onChange: (value: string) => void; options: ConfigProfileOption[]; placeholder: string; value: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <div className="platform-select" ref={root}>
    <button aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} className={!selected ? 'is-placeholder' : ''} onClick={() => setOpen((current) => !current)} type="button"><span>{selected ? selected.name : placeholder}</span><MdiIcon name={open ? 'mdi-chevron-up' : 'mdi-chevron-down'} /></button>
    {open && <div className="platform-select__menu" role="listbox">{options.map((option) => { const image = imageForValue?.(option.id); return <button aria-selected={option.id === value} className={option.id === value ? 'is-selected' : ''} key={option.id} onClick={() => { onChange(option.id); setOpen(false); }} role="option" type="button">{image && <img alt="" src={image} />}<span>{option.name}</span>{option.id === value && <MdiIcon name="mdi-check" />}</button>; })}</div>}
  </div>;
}

function PlatformEditor({ configMode, configProfiles, creationMode, editor, formMetadata, onChange, onConfigModeChange, onCreationModeChange, onOpenChange, onSave, onSelectedConfigChange, onTypeChange, saving, selectedConfigId, selectedType, t, templates }: { configMode: 'existing' | 'new'; configProfiles: ConfigProfileOption[]; creationMode: 'scan' | 'manual' | ''; editor: EditorState; formMetadata: JsonObject; onChange: (next: JsonObject) => void; onConfigModeChange: (mode: 'existing' | 'new') => void; onCreationModeChange: (mode: 'scan' | 'manual') => void; onOpenChange: (open: boolean) => void; onSave: () => void; onSelectedConfigChange: (id: string) => void; onTypeChange: (type: string) => void; saving: boolean; selectedConfigId: string; selectedType: string; t: (key: string, options?: Record<string, unknown>) => string; templates: Record<string, JsonObject> }) {
  const [showConfigSection, setShowConfigSection] = useState(true);
  useEffect(() => { if (editor) setShowConfigSection(true); }, [editor]);
  const resolveText = (path: string, field: 'description' | 'hint', fallback = '') => {
    const exact = i18n.t(`features.config-metadata.${path}.${field}`, { defaultValue: '' });
    if (exact) return exact;
    if (!fallback) return '';
    return i18n.t(`features.config-metadata.${fallback}`, { defaultValue: fallback });
  };
  const editing = Boolean(editor?.originalId);
  const platformId = editor ? recordId(editor.config, 'id', 'bot_id') : '';
  const platformType = String(editor?.config.type || '');
  const hasCreationChoice = hasScanAndManualCreation(platformType);
  const scanOnly = isScanOnlyCreation(platformType);
  const scanSelected = scanOnly || creationMode === 'scan';
  const modeReady = !hasCreationChoice || Boolean(creationMode);
  const registrationReady = !scanSelected || scanRegistrationComplete(platformType, editor?.config ?? {});
  const canSave = editing ? Boolean(platformId) : Boolean(selectedType && isValidPlatformId(platformId) && selectedConfigId.trim() && modeReady && registrationReady);
  const showManualConfig = editing || (selectedType && !scanOnly && (!hasCreationChoice || creationMode === 'manual'));
  return <Dialog onOpenChange={onOpenChange} open={editor !== null} title={editing ? `${t('dialog.edit')} ${editor?.originalId} ${t('dialog.adapter')}` : t('dialog.addPlatform')}>
    {editor && <div className="platform-editor">
      <div className="platform-editor__body">
        <section className="platform-editor__step"><MdiIcon name="mdi-numeric-1-circle" /><div><h3>{t('createDialog.step1Title')}</h3><p>{t('createDialog.step1Hint')}</p>{!editing && <div className="platform-editor__type"><PlatformSelect ariaLabel={t('createDialog.platformTypeLabel')} imageForValue={(key) => platformLogo(String(templates[key]?.type || key), templates[key])} onChange={onTypeChange} options={Object.keys(templates).map((type) => ({ id: type, name: type }))} placeholder={t('createDialog.platformTypeLabel')} value={selectedType} /></div>}{selectedType && hasCreationChoice && <div className="platform-creation-mode"><strong>{t('registrationAction.mode.title')}</strong><label><input checked={creationMode === 'scan'} name="platform-creation-mode" onChange={() => onCreationModeChange('scan')} type="radio" />{t('registrationAction.mode.scan')}</label><label><input checked={creationMode === 'manual'} name="platform-creation-mode" onChange={() => onCreationModeChange('manual')} type="radio" />{t(platformType === 'lark' ? 'registrationAction.mode.larkManual' : 'registrationAction.mode.manual')}</label></div>}{selectedType && scanSelected && <div className="platform-registration-inline"><label><span>{t('registrationAction.platformIdLabel')}</span><input className={!isValidPlatformId(platformId) ? 'is-invalid' : ''} onChange={(event) => onChange({ ...editor.config, id: event.target.value })} value={platformId} /></label><PlatformRegistrationPanel config={editor.config} onChange={onChange} t={t} type={platformType} /></div>}{showManualConfig && <a className="platform-tutorial" href={tutorialLink(platformType)} rel="noreferrer" target="_blank"><MdiIcon name="mdi-book-open-variant" />{t('dialog.viewTutorial')}</a>}</div></section>
        {showManualConfig && (isObject(formMetadata) && Object.keys(formMetadata).length > 0
          ? <div className="platform-editor__config"><ConfigGroup fieldsFromValue metadata={formMetadata as ConfigGroupMetadata} onChange={(next: ConfigRecord) => onChange(next)} resolveText={resolveText} title={t('adapters')} translationPath="platform_group.platform" value={editor.config} /></div>
          : <FallbackPlatformForm config={editor.config} onChange={onChange} />)}
        {!editing && <section className="platform-editor__step platform-editor__step--config"><MdiIcon name="mdi-numeric-2-circle" /><div><div className="platform-editor__step-heading"><div><h3>{t('createDialog.configFileTitle')} <small>{t('createDialog.optional')}</small></h3><p>{t('createDialog.configHint')} {t('createDialog.configDefaultHint')}</p></div><button aria-expanded={showConfigSection} onClick={() => setShowConfigSection((current) => !current)} type="button"><MdiIcon name={showConfigSection ? 'mdi-chevron-up' : 'mdi-chevron-down'} /></button></div>{showConfigSection && <div className="platform-editor__profiles"><label><input checked={configMode === 'existing'} name="platform-config-mode" onChange={() => { onConfigModeChange('existing'); if (!selectedConfigId) onSelectedConfigChange('default'); }} type="radio" />{t('createDialog.useExistingConfig')}</label>{configMode === 'existing' && <div className="platform-editor__profile-select"><label><span>{t('createDialog.selectConfigLabel')}</span><PlatformSelect ariaLabel={t('createDialog.selectConfigLabel')} onChange={onSelectedConfigChange} options={configProfiles} placeholder={t('createDialog.selectConfigLabel')} value={selectedConfigId} /></label><a aria-label={t('createDialog.selectConfigLabel')} href="/config"><MdiIcon name="mdi-arrow-top-right-thick" /></a></div>}<label><input checked={configMode === 'new'} name="platform-config-mode" onChange={() => { onConfigModeChange('new'); onSelectedConfigChange(''); }} type="radio" />{t('createDialog.createNewConfig')}</label>{configMode === 'new' && <label className="platform-editor__new-profile"><span>{t('createDialog.newConfigNameLabel')}</span><input onChange={(event) => onSelectedConfigChange(event.target.value)} value={selectedConfigId} /></label>}</div>}</div></section>}
      </div>
      <div className="dialog-actions platform-editor__actions"><DialogClose asChild><button type="button">{t('dialog.cancel')}</button></DialogClose><button className="button--primary" disabled={saving || !canSave} onClick={onSave} type="button">{saving ? '…' : t('dialog.save')}</button></div>
    </div>}
  </Dialog>;
}

function FallbackPlatformForm({ config, onChange }: { config: JsonObject; onChange: (next: JsonObject) => void }) {
  return <div className="dialog-form"><label>ID<input onChange={(event) => onChange({ ...config, id: event.target.value })} value={String(config.id || '')} /></label><label>Type<input onChange={(event) => onChange({ ...config, type: event.target.value })} value={String(config.type || '')} /></label></div>;
}

function DetailsDialog({ config, details, onOpenChange, t }: { config: JsonObject; details: { kind: 'error' | 'qr' | 'webhook'; item: JsonObject; stat?: JsonObject } | null; onOpenChange: (open: boolean) => void; t: (key: string, options?: Record<string, unknown>) => string }) {
  const kind = details?.kind;
  const qr = platformQrPayload(details?.stat);
  const uuid = String(details?.item.webhook_uuid || '');
  const url = webhookUrl(config, uuid);
  const lastError = isObject(details?.stat?.last_error) ? details?.stat?.last_error as JsonObject : null;
  const title = kind === 'qr' ? t('platformQr.title') : kind === 'webhook' ? t('webhookDialog.title') : t('errorDialog.title');
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast.success(t('webhookCopied')); } catch { toast.error(t('webhookCopyFailed')); } };
  return <Dialog onOpenChange={onOpenChange} open={details !== null} title={title}>
    {kind === 'webhook' && <div className="platform-detail"><p>{t('webhookDialog.description')}</p><div className="platform-webhook"><input readOnly value={url} /><button onClick={() => void copy()} type="button"><MdiIcon name="mdi-content-copy" /></button></div></div>}
    {kind === 'qr' && <div className="platform-detail platform-detail--qr"><p>{t('platformQr.status')}: {qr?.status || t('platformQr.waiting')}</p>{qr && <img alt={t('platformQr.title')} src={qr.payload} />}</div>}
    {kind === 'error' && <div className="platform-detail"><p><strong>{t('errorDialog.platformId')}:</strong> {recordId(details?.item ?? {}, 'id')}</p><p><strong>{t('errorDialog.errorCount')}:</strong> {String(details?.stat?.error_count || 0)}</p>{lastError && <><div className="platform-error-message">{String(lastError.message || '')}<small>{lastError.timestamp ? `${t('errorDialog.occurredAt')}: ${new Date(String(lastError.timestamp)).toLocaleString()}` : ''}</small></div>{lastError.traceback && <pre className="platform-traceback">{String(lastError.traceback)}</pre>}</>}</div>}
    <div className="dialog-actions"><DialogClose asChild><button type="button">{kind === 'qr' ? t('platformQr.close') : kind === 'webhook' ? t('webhookDialog.close') : t('errorDialog.close')}</button></DialogClose></div>
  </Dialog>;
}

function platformIcon(type: string): `mdi-${string}` {
  if (/telegram/i.test(type)) return 'mdi-send-outline';
  if (/discord|slack|lark|dingtalk/i.test(type)) return 'mdi-chat-processing';
  if (/weixin|wechat|wecom/i.test(type)) return 'mdi-message-text';
  if (/qq|onebot|aiocqhttp/i.test(type)) return 'mdi-chat';
  return 'mdi-robot-outline';
}

function statusIcon(status: string): `mdi-${string}` {
  if (status === 'error') return 'mdi-alert-circle';
  if (status === 'pending') return 'mdi-clock-outline';
  if (status === 'stopped') return 'mdi-stop-circle';
  return 'mdi-help-circle';
}

function tutorialLink(type: string) {
  const links: Record<string, string> = { qq_official_webhook: 'qqofficial/webhook.html', qq_official: 'qqofficial/websockets.html', aiocqhttp: 'aiocqhttp.html', wecom: 'wecom.html', weixin_oc: 'weixin_oc.html', wecom_ai_bot: 'wecom_ai_bot.html', lark: 'lark.html', telegram: 'telegram.html', dingtalk: 'dingtalk.html', weixin_official_account: 'weixin-official-account.html', discord: 'discord.html', slack: 'slack.html', kook: 'kook.html', vocechat: 'vocechat.html', satori: 'satori/guide.html', misskey: 'misskey.html', line: 'line.html', matrix: 'matrix.html', mattermost: 'mattermost.html' };
  return `https://docs.astrbot.app/platform/${links[type] || ''}`;
}

function findTemplateByType(templates: Record<string, JsonObject>, type: string) {
  return Object.values(templates).find((template) => String(template.type || '') === type);
}
