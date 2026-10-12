import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useLanguage, setLanguageMode } from './index';
import type { LanguageMode } from './vosLocale';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Languages } from 'lucide-react';

const namespaces = ['common', 'home', 'tasks', 'toolbox', 'modelsControl', 'translateControl', 'dubbing', 'subtitleMerge', 'resources', 'glossary', 'launchpad', 'download', 'settings', 'parameters', 'voiceClone'];
export function VosControls() {
  const { i18n } = useTranslation();
  const { locale, mode } = useLanguage();
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');
  const lang = locale === 'en-US' ? 'en' : locale === 'zh-TW' ? 'zh-TW' : 'zh';
  const label = (zh: string, tw: string, en: string) => lang === 'en' ? en : lang === 'zh-TW' ? tw : zh;
  useEffect(() => {
    let live = true;
    void Promise.all(namespaces.map(async ns => {
      if (i18n.hasResourceBundle(lang, ns)) return;
      const res = await fetch(`/app/com.ictrek.v-sub/locales/${lang}/${ns}.json`);
      if (!res.ok) throw new Error('Translation could not be loaded');
      i18n.addResourceBundle(lang, ns, await res.json(), true, true);
    })).then(() => { if (live) void i18n.changeLanguage(lang); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [i18n, lang]);
  useEffect(() => {
    const onError = (e: any) => setError(e.detail);
    window.addEventListener('v-sub-auth-error', onError);
    const remove = window.ipc.on('vos:error', (...args) => setError(String(args[0])));
    const refresh = () => window.ipc.invoke('vos:router-status').then(setStatus).catch(e => setError(e.message));
    void refresh(); const timer = setInterval(refresh, 30000);
    return () => { remove(); clearInterval(timer); window.removeEventListener('v-sub-auth-error', onError); };
  }, []);
  return <><Head><title>V-Sub</title></Head><div className="flex items-center justify-end gap-2 border-b bg-background px-4 py-2 text-sm">
    <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/#/app/app-drawer/com.ictrek.v-router/v-router`} target="_top" className="text-muted-foreground">V-Router{status ? ` · ASR ${status.asr} / TTS ${status.tts}` : ''}</a>
    {(error || status?.error || status?.local?.error) && <span role="alert" className="text-destructive">{error || status?.error || status?.local?.error}</span>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Languages />{mode === 'auto' ? label('跟随 VOS', '跟隨 VOS', 'Follow VOS') : lang === 'en' ? 'English' : lang === 'zh-TW' ? '繁體中文' : '简体中文'}</Button></DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuGroup>{([['auto', label('跟随 VOS', '跟隨 VOS', 'Follow VOS')], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en-US', 'English']] as [LanguageMode, string][]).map(([value, title]) => <DropdownMenuItem key={value} onSelect={() => setLanguageMode(value)}>{title}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>
  </div></>;
}
