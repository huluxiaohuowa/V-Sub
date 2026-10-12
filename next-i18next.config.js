/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'zh-TW', 'en'],
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  localePath:
    typeof window === 'undefined'
      ? // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('path').resolve('./renderer/public/locales')
      : (process.env.NEXT_PUBLIC_VSUB_WEB ? '/app/com.ictrek.v-sub/locales' : '/locales'),
};
