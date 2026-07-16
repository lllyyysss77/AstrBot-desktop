import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  bindPluginSource, createPluginSource, deletePluginSource, getPluginById, getPluginChangelogById,
  getPluginConfigById, getPluginReadmeById, installPluginFromUpload, installPluginFromUrl,
  listFailedPlugins, listPluginMarket, listPluginMarketCategories, listPluginPagesById,
  listPluginSources, listPlugins, reloadFailedPlugin, reloadPluginById, setPluginEnabledById,
  uninstallFailedPlugin, uninstallPluginById, updatePluginConfigById, updatePlugins,
} from '@/api/openapi';
import { Markdown } from '@/components/content/Markdown';
import { ConfigGroup } from '@/components/config/DynamicConfigForm';
import type { ConfigGroupMetadata } from '@/components/config/configFormModel';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { Dialog } from '@/components/headless/Dialog';
import { MdiIcon } from '@/components/icons/MdiIcon';
import { confirmAction, toast } from '@/stores/feedback';
import { errorMessage, isObject, type JsonObject, objectList, parseJsonObject, prettyJson, recordId, responseData } from '@/routes/configuration/model';
import { ComponentsSection, McpSection, SkillsSection } from './ExtensionSections';
import {
  categoryValue, filterPlugins, localizedPluginConfigText, localizedPluginDescription, localizedPluginTitle, markdownContent,
  marketPluginList, marketPluginTotal, normalizePluginUrl, pluginAuthor, pluginDescription, pluginId,
  pluginInstallUrl, pluginList, pluginPages, pluginTitle, sourceList,
} from './extensionModel';

type ExtensionTab = 'installed' | 'components' | 'mcp' | 'skills' | 'market';
const validTabs: ExtensionTab[] = ['installed', 'market', 'components', 'mcp', 'skills'];
const PINNED_KEY = 'astrbot-extension-pinned';

export default function ExtensionPage() {
  const { pluginId: routePluginId } = useParams(); const location = useLocation();
  if (routePluginId) return <PluginDetail pluginId={routePluginId} source={location.hash === '#market' ? 'market' : 'installed'} />;
  return <ExtensionHome marketplaceRoute={location.pathname === '/extension-marketplace'} />;
}

function ExtensionHome({ marketplaceRoute }: { marketplaceRoute: boolean }) {
  const { t } = useTranslation(); const navigate = useNavigate(); const location = useLocation();
  const e = (key: string) => t(`features.extension.${key}`);
  const requested = marketplaceRoute ? 'market' : location.hash.slice(1);
  const activeTab = validTabs.includes(requested as ExtensionTab) ? requested as ExtensionTab : 'installed';
  const selectTab = (tab: ExtensionTab) => navigate(`/extension#${tab}`);
  return <div className="extension-page"><nav aria-label={e('title')} className="extension-tabs">{validTabs.map((tab) => <button aria-pressed={activeTab === tab} key={tab} onClick={() => selectTab(tab)} type="button"><MdiIcon name={tab === 'installed' ? 'mdi-puzzle' : tab === 'components' ? 'mdi-tune-variant' : tab === 'mcp' ? 'mdi-server' : tab === 'skills' ? 'mdi-lightning-bolt' : 'mdi-store'} />{e(tab === 'installed' ? 'tabs.installedPlugins' : tab === 'components' ? 'tabs.handlersOperation' : tab === 'mcp' ? 'tabs.installedMcpServers' : tab === 'skills' ? 'tabs.skills' : 'tabs.market')}</button>)}</nav>{activeTab === 'installed' && <InstalledPlugins />}{activeTab === 'components' && <ComponentsSection />}{activeTab === 'mcp' && <McpSection />}{activeTab === 'skills' && <SkillsSection />}{activeTab === 'market' && <PluginMarket />}</div>;
}

function InstalledPlugins() {
  const { t, i18n } = useTranslation(); const e = (key: string, options?: Record<string, unknown>) => t(`features.extension.${key}`, options); const navigate = useNavigate();
  const [items, setItems] = useState<JsonObject[]>([]); const [failed, setFailed] = useState<JsonObject[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; } });
  const [configPlugin, setConfigPlugin] = useState<JsonObject | null>(null); const [config, setConfig] = useState<JsonObject>({}); const [configMetadata, setConfigMetadata] = useState<JsonObject | null>(null); const [configI18n, setConfigI18n] = useState<unknown>({}); const [configLoading, setConfigLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [installOpen, setInstallOpen] = useState(false); const [uninstalling, setUninstalling] = useState<JsonObject | null>(null); const [deleteConfig, setDeleteConfig] = useState(false); const [deleteData, setDeleteData] = useState(false);
  const [documentDialog, setDocumentDialog] = useState<{ item: JsonObject; content: string; error: string; loading: boolean } | null>(null);
  const [sourceBinding, setSourceBinding] = useState<{ candidates: JsonObject[]; item: JsonObject; loading: boolean; saving: boolean; selected: string } | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [pluginResponse, failedResponse] = await Promise.all([listPlugins({ query: { include_reserved: true } }), listFailedPlugins().catch(() => null)]); setItems(pluginList(responseData(pluginResponse))); setFailed(pluginList(responseData(failedResponse))); } catch (cause) { setError(errorMessage(cause, e('messages.refreshFailed'))); } finally { setLoading(false); } }, [t]);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (item: JsonObject) => { const id = pluginId(item); try { await setPluginEnabledById({ body: { plugin_id: id, enabled: (item.activated ?? item.enabled) === false } }); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  const reload = async (item: JsonObject) => { const id = pluginId(item); try { await reloadPluginById({ body: { plugin_id: id } }); toast.success(e('messages.reloadSuccess')); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.reloadFailed'))); } };
  const update = async (item: JsonObject) => { try { await updatePlugins({ body: { plugin_id: pluginId(item) } }); toast.success(e('messages.updateSuccess')); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  const updateAll = async () => { if (!await confirmAction({ title: e('dialogs.updateAllConfirm.title'), message: e('dialogs.updateAllConfirm.message', { count: items.filter((item) => Boolean(item.has_update)).length }) })) return; try { await updatePlugins({ body: { update_all: true } }); toast.success(e('messages.updateAllSuccess')); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  const openConfig = async (item: JsonObject) => {
    const id = pluginId(item);
    setConfigPlugin(item); setConfig({}); setConfigMetadata(null); setConfigI18n({}); setConfigLoading(true);
    try {
      const payload = responseData<unknown>(await getPluginConfigById({ query: { plugin_id: id } }));
      if (isObject(payload)) {
        setConfig(isObject(payload.config) ? payload.config : {});
        setConfigMetadata(isObject(payload.metadata) ? payload.metadata : null);
        setConfigI18n(payload.i18n);
      }
    } catch (cause) {
      toast.error(errorMessage(cause, e('messages.operationFailed')));
    } finally {
      setConfigLoading(false);
    }
  };
  const saveConfig = async () => { if (!configPlugin) return; setSaving(true); try { await updatePluginConfigById({ body: { plugin_id: pluginId(configPlugin), config } }); toast.success(e('messages.saveSuccess')); setConfigPlugin(null); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } finally { setSaving(false); } };
  const uninstall = async () => { if (!uninstalling) return; try { await uninstallPluginById({ query: { plugin_id: pluginId(uninstalling) }, body: { delete_config: deleteConfig, delete_data: deleteData } }); toast.success(e('messages.deleteSuccess')); setUninstalling(null); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  const togglePin = (id: string) => { const next = pinned.includes(id) ? pinned.filter((name) => name !== id) : [id, ...pinned]; setPinned(next); localStorage.setItem(PINNED_KEY, JSON.stringify(next)); };
  const visible = useMemo(() => filterPlugins(items, search).sort((a, b) => {
    const ai = pinned.indexOf(pluginId(a)); const bi = pinned.indexOf(pluginId(b));
    if ((ai < 0 ? 9999 : ai) !== (bi < 0 ? 9999 : bi)) return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
    if (Boolean(a.reserved) !== Boolean(b.reserved)) return Number(Boolean(a.reserved)) - Number(Boolean(b.reserved));
    return pluginTitle(a).localeCompare(pluginTitle(b));
  }), [items, pinned, search]);
  const viewDocs = async (item: JsonObject) => {
    setDocumentDialog({ item, content: '', error: '', loading: true });
    try {
      const response = await getPluginReadmeById({ query: { plugin_id: pluginId(item) } });
      const payload = responseData<unknown>(response);
      setDocumentDialog({ item, content: markdownContent(payload) || markdownContent(response.data), error: '', loading: false });
    } catch (cause) {
      setDocumentDialog({ item, content: '', error: errorMessage(cause, e('detail.docsEmpty')), loading: false });
    }
  };
  const openSourceBinding = async (item: JsonObject) => {
    const repo = pluginInstallUrl(item);
    setSourceBinding({ candidates: [], item, loading: true, saving: false, selected: '' });
    try {
      const sources = sourceList(responseData(await listPluginSources()));
      const candidates: JsonObject[] = [];
      for (const source of [{ name: e('market.defaultOfficialSource'), url: '' }, ...sources]) {
        try {
          const market = marketPluginList(responseData(await listPluginMarket({ query: { custom_registry: String(source.url || '') || undefined, page: 1, page_size: 100 } })));
          const match = market.find((candidate) => normalizePluginUrl(pluginInstallUrl(candidate)) === normalizePluginUrl(repo));
          if (match) candidates.push({
            key: `market:${String(source.url || 'official')}:${pluginId(match)}`,
            install_method: 'market', market_plugin_id: String(match.market_plugin_id || pluginId(match)),
            registry_name: String(source.name || e('market.defaultOfficialSource')), registry_url: String(source.url || '') || null,
          });
        } catch { /* An unavailable registry should not block the remaining candidates. */ }
      }
      if (repo) candidates.push({ key: `github:${normalizePluginUrl(repo)}`, install_method: 'github', registry_name: e('dialogs.sourceBinding.repoOption'), repo });
      setSourceBinding({ candidates, item, loading: false, saving: false, selected: String(candidates[0]?.key || '') });
    } catch (cause) {
      toast.error(errorMessage(cause, e('messages.operationFailed')));
      setSourceBinding({ candidates: repo ? [{ key: `github:${normalizePluginUrl(repo)}`, install_method: 'github', registry_name: e('dialogs.sourceBinding.repoOption'), repo }] : [], item, loading: false, saving: false, selected: repo ? `github:${normalizePluginUrl(repo)}` : '' });
    }
  };
  const saveSourceBinding = async () => {
    if (!sourceBinding) return;
    const candidate = sourceBinding.candidates.find((entry) => entry.key === sourceBinding.selected);
    if (!candidate) return;
    setSourceBinding({ ...sourceBinding, saving: true });
    try {
      await bindPluginSource({
        path: { plugin_id: pluginId(sourceBinding.item) },
        body: candidate.install_method === 'github'
          ? { install_method: 'github' }
          : { install_method: 'market', market_plugin_id: String(candidate.market_plugin_id || ''), registry_url: typeof candidate.registry_url === 'string' ? candidate.registry_url : null },
      });
      toast.success(e('messages.sourceBindSuccess')); setSourceBinding(null); await load();
    } catch (cause) {
      toast.error(errorMessage(cause, e('messages.operationFailed')));
      setSourceBinding({ ...sourceBinding, saving: false });
    }
  };
  const reloadFailed = async (item: JsonObject) => { const id = recordId(item, 'dir_name', 'name', 'id'); try { await reloadFailedPlugin({ path: { plugin_id: id } }); toast.success(e('messages.reloadSuccess')); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.reloadFailed'))); } };
  const removeFailed = async (item: JsonObject) => { const id = recordId(item, 'dir_name', 'name', 'id'); if (!await confirmAction({ danger: true, title: e('buttons.uninstall'), message: id })) return; try { await uninstallFailedPlugin({ path: { plugin_id: id } }); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  return <section className="extension-section extension-installed">
    <header className="extension-installed__header">
      <h2>{e('titles.installedAstrBotPlugins')}</h2>
      <label className="extension-installed__search"><MdiIcon name="mdi-magnify" /><input onChange={(event) => setSearch(event.target.value)} placeholder={e('search.placeholder')} value={search} />{search && <button aria-label={e('buttons.close')} onClick={() => setSearch('')} type="button"><MdiIcon name="mdi-close" /></button>}</label>
    </header>
    {error && <div className="monitor-error">{error}</div>}
    {failed.length > 0 && <section className="extension-failed"><h3><MdiIcon name="mdi-alert-circle" />{e('failedPlugins.title', { count: failed.length })}</h3><p>{e('failedPlugins.hint')}</p>{failed.map((item) => { const id = recordId(item, 'dir_name', 'name', 'id'); return <article key={id}><div><strong>{String(item.display_name || id)}</strong><small>{id}</small></div><p>{String(item.error || e('status.unknown'))}</p><span><button onClick={() => void reloadFailed(item)} type="button"><MdiIcon name="mdi-refresh" />{e('buttons.reload')}</button><button className="button--danger" disabled={Boolean(item.reserved)} onClick={() => void removeFailed(item)} type="button"><MdiIcon name="mdi-delete" />{e('buttons.uninstall')}</button></span></article>; })}</section>}
    {loading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : <div className="extension-plugin-grid">{visible.map((item, index) => {
      const id = pluginId(item) || `plugin-${index}`; const pages = pluginPages(item); const enabled = (item.activated ?? item.enabled) !== false;
      const tags = Array.isArray(item.tags) ? item.tags.map(String) : []; const platforms = Array.isArray(item.support_platforms) ? item.support_platforms.map(String) : [];
      const installSource = isObject(item.install_source) ? item.install_source : {};
      const installMethod = String(installSource.install_method || '').toLowerCase();
      const hasRepo = Boolean(pluginInstallUrl(item));
      const canUpdate = !item.reserved && (['market', 'github'].includes(installMethod) && installSource.implicit !== true || hasRepo);
      return <article className="extension-plugin-card" key={id} onClick={() => navigate(`/extension/${encodeURIComponent(id)}#installed`)}>
        <div className="extension-plugin-card__body">
          <div className="extension-plugin-card__logo"><MdiIcon name="mdi-puzzle" />{Boolean(item.logo) && <img alt="" onError={(event) => event.currentTarget.remove()} src={String(item.logo)} />}</div>
          <div className="extension-plugin-card__content">
            <header><div className="extension-plugin-card__title"><h3 title={localizedPluginTitle(item, i18n.language)}>{localizedPluginTitle(item, i18n.language)}</h3>{Boolean(item.version) && <span>{String(item.version)}</span>}{Boolean(item.reserved) && <span className="is-system">{e('status.system')}</span>}{Boolean(item.has_update) && <button aria-label={e('buttons.update')} className="extension-plugin-card__update" onClick={(event) => { event.stopPropagation(); void update(item); }} title={`${e('card.status.hasUpdate')}: ${String(item.online_version || '')}`} type="button"><MdiIcon name="mdi-update" /></button>}</div><label className="extension-plugin-switch" onClick={(event) => event.stopPropagation()} title={enabled ? e('buttons.disable') : e('buttons.enable')}><input checked={enabled} onChange={() => void toggle(item)} type="checkbox" /><span /></label></header>
            <div className="extension-plugin-card__chips">{Boolean(item.has_update) && <button className="is-update" onClick={(event) => { event.stopPropagation(); void update(item); }} type="button"><MdiIcon name="mdi-arrow-up-bold" />{String(item.online_version || '')}</button>}{tags.map((tag) => <span className={tag === 'danger' ? 'is-danger' : ''} key={tag}>{tag === 'danger' ? e('tags.danger') : tag}</span>)}{platforms.length > 0 && <span className="is-platform"><MdiIcon name="mdi-devices" />{platforms.join(', ')}</span>}{Boolean(item.astrbot_version) && <span className="is-version">AstrBot: {String(item.astrbot_version)}</span>}</div>
            <p>{localizedPluginDescription(item, i18n.language)}</p>
          </div>
        </div>
        <footer onClick={(event) => event.stopPropagation()}>
          <button aria-label={pinned.includes(id) ? e('buttons.unpin') : e('buttons.pin')} className={pinned.includes(id) ? 'is-active' : ''} onClick={() => togglePin(id)} title={pinned.includes(id) ? e('buttons.unpin') : e('buttons.pin')} type="button"><MdiIcon name={pinned.includes(id) ? 'mdi-pin' : 'mdi-pin-outline'} /></button>
          <button aria-label={e('buttons.viewDocs')} className="is-info" onClick={() => void viewDocs(item)} title={e('buttons.viewDocs')} type="button"><MdiIcon name="mdi-book-open-page-variant" /></button>
          {pages.length > 0 && <Link aria-label={e('buttons.openWebui')} className={!enabled ? 'is-disabled' : ''} onClick={(event) => !enabled && event.preventDefault()} title={e('buttons.openWebui')} to={`/plugin-page/${encodeURIComponent(id)}/${encodeURIComponent(pages[0])}`}><MdiIcon name="mdi-monitor-dashboard" /></Link>}
          <button aria-label={e('card.actions.pluginConfig')} onClick={() => void openConfig(item)} title={e('card.actions.pluginConfig')} type="button"><MdiIcon name="mdi-cog" /></button>
          <button aria-label={e('card.actions.reloadPlugin')} onClick={() => void reload(item)} title={e('card.actions.reloadPlugin')} type="button"><MdiIcon name="mdi-refresh" /></button>
          <details className="extension-plugin-card__menu"><summary aria-label={e('buttons.actions')} title={e('buttons.actions')}><MdiIcon name="mdi-dots-horizontal" /></summary><div><button onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); navigate(`/extension/${encodeURIComponent(id)}#plugin-components`); }} type="button"><MdiIcon name="mdi-information" />{e('buttons.viewInfo')}</button><button disabled={!canUpdate} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void update(item); }} title={!canUpdate ? e('messages.updateDisabled') : undefined} type="button"><MdiIcon name="mdi-update" />{item.has_update ? `${e('card.actions.updateTo')} ${String(item.online_version || '')}` : e('card.actions.reinstall')}</button><button disabled={!hasRepo} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void openSourceBinding(item); }} title={!hasRepo ? e('messages.changeSourceDisabled') : undefined} type="button"><MdiIcon name="mdi-source-branch" />{e('card.actions.changeSource')}</button><button className="button--danger" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setUninstalling(item); }} type="button"><MdiIcon name="mdi-delete" />{e('card.actions.uninstallPlugin')}</button></div></details>
        </footer>
      </article>;
    })}</div>}
    {!loading && !visible.length && <div className="extension-installed__empty"><MdiIcon name="mdi-puzzle-outline" /><h3>{e('empty.noPlugins')}</h3><p>{e('empty.noPluginsDesc')}</p></div>}
    {typeof document !== 'undefined' && createPortal(<div className="extension-installed__fabs"><button aria-label={e('buttons.updateAll')} disabled={loading} onClick={() => void updateAll()} title={e('buttons.updateAll')} type="button"><MdiIcon name="mdi-update" /></button><button aria-label={e('market.installPlugin')} onClick={() => setInstallOpen(true)} title={e('market.installPlugin')} type="button"><MdiIcon name="mdi-plus" /></button></div>, document.body)}
    <Dialog onOpenChange={(open) => !open && setConfigPlugin(null)} open={configPlugin !== null} title={e('dialogs.config.title')}><div className="extension-plugin-config">{configLoading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : configPlugin && configMetadata && isObject(configMetadata[pluginId(configPlugin)]) ? <ConfigGroup fieldsFromValue metadata={configMetadata[pluginId(configPlugin)] as ConfigGroupMetadata} onChange={setConfig} resolveText={(path, field, fallback) => localizedPluginConfigText(configI18n, i18n.language, path, field, fallback)} translationPath={pluginId(configPlugin)} value={config} /> : <p>{e('dialogs.config.noConfig')}</p>}</div><div className="dialog-actions"><button disabled={saving} onClick={() => void saveConfig()} type="button">{e('buttons.saveAndClose')}</button><button onClick={() => setConfigPlugin(null)} type="button">{e('buttons.close')}</button></div></Dialog>
    <InstallPluginDialog onInstalled={() => void load()} onOpenChange={setInstallOpen} open={installOpen} />
    <Dialog onOpenChange={(open) => !open && setDocumentDialog(null)} open={documentDialog !== null} title={t('core.common.readme.title')}><div className="extension-doc-dialog__toolbar">{Boolean(documentDialog?.item.repo) && <a href={String(documentDialog?.item.repo)} rel="noreferrer" target="_blank"><MdiIcon name="mdi-github" />{t('core.common.readme.buttons.viewOnGithub')}</a>}<button onClick={() => documentDialog && void viewDocs(documentDialog.item)} type="button"><MdiIcon name="mdi-refresh" />{t('core.common.readme.buttons.refresh')}</button></div><div className="extension-doc-dialog">{documentDialog?.loading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : documentDialog?.error ? <div className="extension-doc-dialog__state"><MdiIcon name="mdi-alert-circle-outline" /><p>{documentDialog.error}</p></div> : documentDialog?.content ? <Markdown content={documentDialog.content} /> : <div className="extension-doc-dialog__state"><MdiIcon name="mdi-file-question-outline" /><p>{e('detail.docsEmpty')}</p></div>}</div><div className="dialog-actions"><button onClick={() => setDocumentDialog(null)} type="button">{e('buttons.close')}</button></div></Dialog>
    <Dialog onOpenChange={(open) => !open && setSourceBinding(null)} open={sourceBinding !== null} title={e('dialogs.sourceBinding.title')}><div className="extension-source-binding">{sourceBinding?.loading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : !sourceBinding?.candidates.length ? <div className="extension-source-binding__empty">{e('dialogs.sourceBinding.noCandidates')}</div> : sourceBinding.candidates.map((candidate) => <label key={String(candidate.key)}><input checked={sourceBinding.selected === candidate.key} name="plugin-source" onChange={() => setSourceBinding({ ...sourceBinding, selected: String(candidate.key) })} type="radio" /><span><strong>{String(candidate.registry_name)}</strong>{Boolean(candidate.repo) && <small>{String(candidate.repo)}</small>}</span></label>)}</div><div className="dialog-actions"><button onClick={() => setSourceBinding(null)} type="button">{e('buttons.cancel')}</button><button className="button--primary" disabled={!sourceBinding?.selected || sourceBinding?.saving} onClick={() => void saveSourceBinding()} type="button">{e('dialogs.sourceBinding.confirm')}</button></div></Dialog>
    <Dialog onOpenChange={(open) => !open && setUninstalling(null)} open={uninstalling !== null} title={e('dialogs.uninstall.title')}><div className="extension-uninstall"><p>{e('dialogs.uninstall.message')}</p><label><input checked={deleteConfig} onChange={(event) => setDeleteConfig(event.target.checked)} type="checkbox" />{e('dialogs.uninstall.deleteConfig')}<small>{e('dialogs.uninstall.configHint')}</small></label><label><input checked={deleteData} onChange={(event) => setDeleteData(event.target.checked)} type="checkbox" />{e('dialogs.uninstall.deleteData')}<small>{e('dialogs.uninstall.dataHint')}</small></label></div><div className="dialog-actions"><button onClick={() => setUninstalling(null)} type="button">{e('buttons.cancel')}</button><button className="button--danger" onClick={() => void uninstall()} type="button">{e('buttons.uninstall')}</button></div></Dialog>
  </section>;
}

function InstallPluginDialog({ initial, onInstalled, onOpenChange, open }: { initial?: JsonObject; onInstalled: () => void; onOpenChange: (open: boolean) => void; open: boolean }) {
  const { t } = useTranslation(); const e = (key: string) => t(`features.extension.${key}`); const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'url'>(initial ? 'url' : 'file'); const [file, setFile] = useState<File | null>(null); const [url, setUrl] = useState(''); const [installing, setInstalling] = useState(false);
  useEffect(() => { if (open) { setUrl(initial ? pluginInstallUrl(initial) : ''); setFile(null); setMode(initial ? 'url' : 'file'); } }, [initial, open]);
  const install = async () => { if (mode === 'file' && !file || mode === 'url' && !url.trim()) { toast.warning(e('messages.fillUrlOrFile')); return; } setInstalling(true); try { if (mode === 'file') await installPluginFromUpload({ body: { file: file! } }); else await installPluginFromUrl({ body: { url: url.trim(), download_url: typeof initial?.download_url === 'string' ? initial.download_url : undefined, market_plugin_id: pluginId(initial ?? {}) || undefined } }); toast.success(e('messages.addSuccess')); onOpenChange(false); onInstalled(); } catch (cause) { toast.error(errorMessage(cause, e('messages.installFailed'))); } finally { setInstalling(false); } };
  return <Dialog onOpenChange={onOpenChange} open={open} title={e('dialogs.install.title')}><nav className="extension-subtabs"><button aria-pressed={mode === 'file'} onClick={() => setMode('file')} type="button">{e('dialogs.install.fromFile')}</button><button aria-pressed={mode === 'url'} onClick={() => setMode('url')} type="button">{e('dialogs.install.fromUrl')}</button></nav><div className="extension-install-form">{mode === 'file' ? <><input accept=".zip,application/zip" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} ref={input} type="file" /><button onClick={() => input.current?.click()} type="button"><MdiIcon name="mdi-file-upload" />{file?.name || e('buttons.selectFile')}</button><small>{e('messages.supportedFormats')}</small></> : <label>{e('upload.enterUrl')}<input onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/..." value={url} /></label>}</div><div className="extension-warning"><MdiIcon name="mdi-alert-outline" />{e('dialogs.install.githubSecurityWarning')}</div><div className="dialog-actions"><button onClick={() => onOpenChange(false)} type="button">{e('buttons.cancel')}</button><button className="button--primary" disabled={installing} onClick={() => void install()} type="button">{installing ? e('messages.installing') : e('buttons.install')}</button></div></Dialog>;
}

function PluginMarket() {
  const { t } = useTranslation(); const e = (key: string) => t(`features.extension.${key}`);
  const [items, setItems] = useState<JsonObject[]>([]); const [categories, setCategories] = useState<JsonObject[]>([]); const [sources, setSources] = useState<JsonObject[]>([]); const [selectedSource, setSelectedSource] = useState(''); const [keyword, setKeyword] = useState(''); const [category, setCategory] = useState(''); const [sort, setSort] = useState<'recommended' | 'downloads' | 'updated' | 'name'>('recommended'); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [installing, setInstalling] = useState<JsonObject | null>(null); const [sourceDialog, setSourceDialog] = useState(false); const [sourceName, setSourceName] = useState(''); const [sourceUrl, setSourceUrl] = useState('');
  const load = useCallback(async (refresh = false) => { setLoading(true); setError(''); try { const response = await listPluginMarket({ query: { force_refresh: refresh, keyword: keyword.trim() || undefined, category: category || undefined, custom_registry: selectedSource || undefined, sort, page, page_size: 24 } }); const data = responseData<unknown>(response); const plugins = marketPluginList(data); setItems(plugins); setTotal(marketPluginTotal(data, plugins.length)); } catch (cause) { setError(errorMessage(cause, e('messages.getMarketDataFailed'))); } finally { setLoading(false); } }, [category, keyword, page, selectedSource, sort, t]);
  const loadMeta = useCallback(async () => { const [categoryResponse, sourceResponse] = await Promise.all([listPluginMarketCategories().catch(() => null), listPluginSources().catch(() => null)]); setCategories(pluginList(responseData(categoryResponse))); setSources(sourceList(responseData(sourceResponse))); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]); useEffect(() => { void loadMeta(); }, [loadMeta]);
  const addSource = async () => { if (!sourceUrl.trim()) { toast.warning(e('messages.fillSourceUrl')); return; } try { await createPluginSource({ body: { name: sourceName.trim() || sourceUrl.trim(), url: sourceUrl.trim() } }); toast.success(e('market.sourceAdded')); setSourceName(''); setSourceUrl(''); await loadMeta(); } catch (cause) { toast.error(errorMessage(cause, e('market.sourceError'))); } };
  const removeSource = async (item: JsonObject) => { const id = recordId(item, 'id', 'source_id'); if (!id || !await confirmAction({ danger: true, title: e('market.removeSource'), message: e('market.confirmRemoveSource') })) return; try { await deletePluginSource({ path: { source_id: id } }); toast.success(e('market.sourceRemoved')); if (selectedSource === String(item.url || '')) setSelectedSource(''); await loadMeta(); } catch (cause) { toast.error(errorMessage(cause, e('market.sourceError'))); } };
  return <section className="extension-section"><header className="extension-section__header"><div><h2>{e('tabs.market')}</h2><p>{e('market.sourceSafetyWarning')}</p></div><div><button onClick={() => setSourceDialog(true)} type="button"><MdiIcon name="mdi-source-branch" />{e('market.sourceManagement')}</button><button onClick={() => void load(true)} type="button"><MdiIcon name="mdi-refresh" />{e('buttons.refresh')}</button></div></header><div className="extension-market-controls"><input onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder={e('search.marketPlaceholder')} value={keyword} /><select onChange={(event) => { setSelectedSource(event.target.value); setPage(1); }} value={selectedSource}><option value="">{e('market.defaultSource')}</option>{sources.map((item) => <option key={recordId(item, 'id', 'source_id') || String(item.url)} value={String(item.url || '')}>{String(item.name || item.url)}</option>)}</select><select onChange={(event) => { setCategory(event.target.value); setPage(1); }} value={category}><option value="">{e('market.categories.all')}</option>{categories.map((item, index) => { const value = String(item.value || item.name || item.id || ''); return <option key={value || index} value={value}>{String(item.label || item.name || value)} ({String(item.count || 0)})</option>; })}</select><select onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="recommended">{e('sort.default')}</option><option value="downloads">Downloads</option><option value="updated">{e('sort.updated')}</option><option value="name">{e('sort.name')}</option></select></div>{error && <div className="monitor-error">{error}</div>}{loading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : <div className="extension-market-grid">{items.map((item, index) => { const id = pluginId(item) || `market-${index}`; return <article className="extension-market-card" key={id}><Link to={`/extension/${encodeURIComponent(id)}#market`}>{item.logo ? <img alt="" src={String(item.logo)} /> : <MdiIcon name="mdi-puzzle" />}<div><h3>{pluginTitle(item)}</h3><p>{pluginDescription(item)}</p></div></Link><div className="extension-market-card__meta"><span>{pluginAuthor(item) || '—'}</span><span>★ {String(item.stars || 0)}</span><span>{categoryValue(item)}</span></div><button className="button--primary" disabled={!pluginInstallUrl(item)} onClick={() => setInstalling(item)} type="button">{e('buttons.install')}</button></article>; })}</div>}{!loading && !items.length && <div className="monitor-empty">{e('empty.noPlugins')}</div>}{total > 24 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">‹</button><span>{page} / {Math.ceil(total / 24)}</span><button disabled={page * 24 >= total} onClick={() => setPage((value) => value + 1)} type="button">›</button></div>}<footer className="extension-market-links"><a href="https://docs.astrbot.app/dev/star/plugin-new.html" rel="noreferrer" target="_blank"><MdiIcon name="mdi-book-open-variant" />{e('market.devDocs')}</a><a href="https://github.com/AstrBotDevs/AstrBot_Plugins_Collection" rel="noreferrer" target="_blank"><MdiIcon name="mdi-github" />{e('market.submitRepo')}</a></footer><InstallPluginDialog initial={installing ?? undefined} onInstalled={() => void load(true)} onOpenChange={(open) => !open && setInstalling(null)} open={installing !== null} /><Dialog onOpenChange={setSourceDialog} open={sourceDialog} title={e('market.sourceManagement')}><div className="extension-source-manager"><div><input onChange={(event) => setSourceName(event.target.value)} placeholder={e('market.sourceName')} value={sourceName} /><input onChange={(event) => setSourceUrl(event.target.value)} placeholder={e('market.sourceUrl')} value={sourceUrl} /><button className="button--primary" onClick={() => void addSource()} type="button"><MdiIcon name="mdi-plus" />{e('market.addSource')}</button></div>{sources.map((item) => <article key={recordId(item, 'id', 'source_id') || String(item.url)}><span><strong>{String(item.name || item.url)}</strong><small>{String(item.url || '')}</small></span><button className="button--danger" onClick={() => void removeSource(item)} type="button">{e('buttons.deleteSource')}</button></article>)}</div><div className="dialog-actions"><button onClick={() => setSourceDialog(false)} type="button">{e('buttons.close')}</button></div></Dialog></section>;
}

function pluginComponents(plugin: JsonObject): JsonObject[] {
  const components = plugin.components;
  if (Array.isArray(components)) return components.filter(isObject);
  if (isObject(components)) return ['page', 'skill', 'command', 'llm_tool', 'listener', 'hook'].flatMap((key) => {
    const group = components[key];
    return Array.isArray(group) ? group.filter(isObject).map((item) => ({ ...item, component_type: key })) : [];
  });
  for (const key of ['handlers', 'command_handlers', 'commands']) {
    const group = plugin[key];
    if (!Array.isArray(group)) continue;
    return group.map((item) => typeof item === 'string' ? { cmd: item, type: 'command' } : item).filter(isObject);
  }
  return [];
}

function PluginDetail({ pluginId: id, source }: { pluginId: string; source: 'installed' | 'market' }) {
  const { t } = useTranslation(); const e = (key: string) => t(`features.extension.${key}`); const navigate = useNavigate(); const location = useLocation();
  const [plugin, setPlugin] = useState<JsonObject>({}); const [pages, setPages] = useState<JsonObject[]>([]); const [config, setConfig] = useState('{}'); const [savedConfig, setSavedConfig] = useState('{}'); const [readme, setReadme] = useState(''); const [changelog, setChangelog] = useState(''); const [tab, setTab] = useState<'overview' | 'config' | 'readme' | 'changelog'>('overview'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [installing, setInstalling] = useState(false);
  const components = useMemo(() => pluginComponents(plugin), [plugin]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (source === 'market') {
        const market = marketPluginList(responseData(await listPluginMarket({ query: { keyword: id, page: 1, page_size: 50 } })));
        const found = market.find((item) => pluginId(item) === id || normalizePluginUrl(item.repo) === normalizePluginUrl(id));
        if (!found) throw new Error(e('detail.notFound'));
        setPlugin(found); return;
      }
      const [detailResponse, configResponse, pageResponse] = await Promise.all([getPluginById({ query: { plugin_id: id } }), getPluginConfigById({ query: { plugin_id: id } }).catch(() => null), listPluginPagesById({ query: { plugin_id: id } }).catch(() => null)]);
      setPlugin(responseData<JsonObject>(detailResponse) ?? {});
      const configData = responseData<JsonObject>(configResponse);
      const text = prettyJson(isObject(configData?.config) ? configData.config : {});
      setConfig(text); setSavedConfig(text); setPages(objectList(responseData(pageResponse), ['pages', 'items']));
    } catch (cause) { setError(errorMessage(cause, e('detail.notFound'))); } finally { setLoading(false); }
  }, [id, source, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loading && location.hash === '#plugin-components') window.setTimeout(() => document.getElementById('plugin-components')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }, [loading, location.hash]);
  useEffect(() => {
    if (source !== 'installed') return;
    if (tab === 'readme' && !readme) void getPluginReadmeById({ query: { plugin_id: id } }).then((response) => setReadme(markdownContent(responseData(response)) || markdownContent(response.data))).catch(() => setReadme(''));
    if (tab === 'changelog' && !changelog) void getPluginChangelogById({ query: { plugin_id: id } }).then((response) => setChangelog(markdownContent(responseData(response)) || markdownContent(response.data))).catch(() => setChangelog(''));
  }, [changelog, id, readme, source, tab]);
  const save = async () => { let value: JsonObject; try { value = parseJsonObject(config); } catch (cause) { toast.error(errorMessage(cause, 'Invalid JSON')); return; } setSaving(true); try { await updatePluginConfigById({ body: { plugin_id: id, config: value } }); setSavedConfig(prettyJson(value)); toast.success(e('messages.saveSuccess')); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } finally { setSaving(false); } };
  const action = async (kind: 'reload' | 'update' | 'uninstall') => { try { if (kind === 'reload') await reloadPluginById({ body: { plugin_id: id } }); if (kind === 'update') await updatePlugins({ body: { plugin_id: id } }); if (kind === 'uninstall') { if (!await confirmAction({ danger: true, title: e('buttons.uninstall'), message: pluginTitle(plugin) })) return; await uninstallPluginById({ query: { plugin_id: id } }); navigate('/extension#installed'); return; } toast.success(e(kind === 'reload' ? 'messages.reloadSuccess' : 'messages.updateSuccess')); await load(); } catch (cause) { toast.error(errorMessage(cause, e('messages.operationFailed'))); } };
  return <div className="extension-page extension-detail">
    <header className="extension-detail__breadcrumb"><button onClick={() => navigate(`/extension#${source}`)} type="button"><MdiIcon name="mdi-arrow-left" /></button><span>{e(source === 'market' ? 'tabs.market' : 'titles.installedAstrBotPlugins')}</span><MdiIcon name="mdi-chevron-right" /><strong>{pluginTitle(plugin)}</strong></header>
    {error && <div className="monitor-error">{error}</div>}
    {loading ? <div className="extension-state"><MdiIcon className="mdi-spin" name="mdi-loading" /></div> : <>
      <section className="extension-detail__summary">{plugin.logo ? <img alt="" src={String(plugin.logo)} /> : <MdiIcon name="mdi-puzzle" />}<div><h1>{pluginTitle(plugin)}</h1><p>{pluginDescription(plugin)}</p><div><span>{pluginAuthor(plugin) || '—'}</span><span>{String(plugin.version || '—')}</span></div></div><aside>{source === 'market' ? <button className="button--primary" onClick={() => setInstalling(true)} type="button">{e('buttons.install')}</button> : <><button onClick={() => void action('reload')} type="button">{e('buttons.reload')}</button><button onClick={() => void action('update')} type="button">{e('buttons.update')}</button>{!plugin.reserved && <button className="button--danger" onClick={() => void action('uninstall')} type="button">{e('buttons.uninstall')}</button>}</>}</aside></section>
      {source === 'installed' && <nav className="extension-subtabs">{(['overview', 'config', 'readme', 'changelog'] as const).map((name) => <button aria-pressed={tab === name} key={name} onClick={() => setTab(name)} type="button">{name === 'overview' ? e('buttons.viewInfo') : name === 'config' ? e('buttons.configure') : name === 'readme' ? e('detail.docsTitle') : e('detail.changelogTitle')}</button>)}</nav>}
      {(source === 'market' || tab === 'overview') && <>
        <section className="extension-detail__info"><h2>{e('detail.info.title')}</h2><dl><dt>{e('detail.info.version')}</dt><dd>{String(plugin.version || '—')}</dd><dt>{e('detail.info.author')}</dt><dd>{pluginAuthor(plugin) || '—'}</dd><dt>{e('detail.info.category')}</dt><dd>{categoryValue(plugin)}</dd><dt>{e('detail.info.stars')}</dt><dd>{String(plugin.stars || 0)}</dd><dt>{e('detail.info.astrbotVersion')}</dt><dd>{String(plugin.astrbot_version || plugin.astrbot_version_requirement || '—')}</dd><dt>{e('detail.info.repository')}</dt><dd>{plugin.repo || plugin.repo_url ? <a href={String(plugin.repo || plugin.repo_url)} rel="noreferrer" target="_blank">{String(plugin.repo || plugin.repo_url)}</a> : '—'}</dd></dl>{pages.length > 0 && <div className="extension-detail__pages"><h2>{e('buttons.openPages')}</h2>{pages.map((page, index) => { const name = recordId(page, 'name', 'page_name', 'id') || `page-${index}`; return <Link key={name} to={`/plugin-page/${encodeURIComponent(id)}/${encodeURIComponent(name)}`}>{String(page.title || page.display_name || name)}</Link>; })}</div>}</section>
        <section className="extension-detail__components" id="plugin-components"><h2>{e('detail.contents')}</h2>{components.length ? <div>{components.map((component, index) => <article key={recordId(component, 'handler_full_name', 'name', 'cmd', 'handler_name') || index}><MdiIcon name={String(component.component_type || component.type).includes('page') ? 'mdi-monitor-dashboard' : String(component.component_type || component.type).includes('tool') ? 'mdi-tools' : 'mdi-console-line'} /><span><strong>{String(component.name || component.cmd || component.handler_name || e('status.unknown'))}</strong><small>{String(component.description || component.desc || component.event_type_h || component.event_type || '')}</small></span></article>)}</div> : <p>{e('detail.noContents')}</p>}</section>
      </>}
      {tab === 'config' && source === 'installed' && <section className="extension-config-editor extension-config-editor--detail"><MonacoEditor language="json" onChange={setConfig} value={config} /><div><button disabled={config === savedConfig} onClick={() => setConfig(savedConfig)} type="button">{e('buttons.cancel')}</button><button className="button--primary" disabled={saving || config === savedConfig} onClick={() => void save()} type="button">{e('buttons.save')}</button></div></section>}
      {tab === 'readme' && <section className="extension-markdown"><Markdown content={readme || e('detail.docsEmpty')} /></section>}
      {tab === 'changelog' && <section className="extension-markdown"><Markdown content={changelog || e('detail.changelogEmpty')} /></section>}
    </>}
    <InstallPluginDialog initial={plugin} onInstalled={() => navigate('/extension#installed')} onOpenChange={setInstalling} open={installing} />
  </div>;
}
