import { confirmAction, type ConfirmOptions } from '@/stores/feedback';

export type DestructiveConfirmOptions = Omit<ConfirmOptions, 'danger'>;

export function confirmDestructiveAction(options: DestructiveConfirmOptions | string) {
  return confirmAction(typeof options === 'string' ? { danger: true, message: options } : { ...options, danger: true });
}
