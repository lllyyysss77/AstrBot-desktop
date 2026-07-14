import { type ReactNode } from 'react';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { Dialog, DialogClose } from '@/components/headless/Dialog';

export function ConfigPageShell({ actions, children, description, title }: { actions?: ReactNode; children: ReactNode; description: string; title: string }) {
  return <div className="monitor-page config-page"><header className="monitor-header"><div><h1>{title}</h1><p>{description}</p></div><div className="monitor-actions">{actions}</div></header>{children}</div>;
}

export function JsonConfigDialog({ busy, onChange, onOpenChange, onSave, open, title, value }: { busy?: boolean; onChange: (value: string) => void; onOpenChange: (open: boolean) => void; onSave: () => void; open: boolean; title: string; value: string }) {
  return <Dialog onOpenChange={onOpenChange} open={open} title={title}>
    <div className="json-editor json-editor--dialog"><MonacoEditor ariaLabel={`${title} JSON`} language="json" onChange={onChange} value={value} /></div>
    <div className="dialog-actions"><DialogClose asChild><button type="button">Cancel</button></DialogClose><button className="button--primary" disabled={busy} onClick={onSave} type="button">{busy ? 'Saving…' : 'Save'}</button></div>
  </Dialog>;
}

export function LoadingState({ error, loading }: { error: string; loading: boolean }) {
  if (loading) return <div className="monitor-loading" role="status">Loading…</div>;
  if (error) return <div className="monitor-error" role="alert">{error}</div>;
  return null;
}
