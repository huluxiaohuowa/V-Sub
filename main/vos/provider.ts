/** GPU workbench profiles use the exact sherpa C API/ORT libraries from V-Voice. */
export function sherpaProvider(selected?: string, modelType?: string): string {
  if (process.env.VSUB_PROFILE === 'l4t' && modelType === 'paraformer') return 'cpu';
  if (selected) return ['cpu', 'cuda', 'coreml'].includes(selected) ? selected : 'cpu';
  return process.env.VSUB_SHERPA_PROVIDER || 'cpu';
}
