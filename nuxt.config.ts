import { COOKIE_MAX_AGE_DAYS, CORE_LAYER_PATH, getFilesForLocale, IS_DEV } from './config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
    pageTransition: { name: 'fade', mode: 'out-in' },
    layoutTransition: { name: 'fade', mode: 'out-in' },
  },
  css: ['~/assets/css/main.css'],
  typescript: {
    typeCheck: true,
    strict: true,
  },
  nitro: {
    compressPublicAssets: {
      brotli: true,
    },
    preset: 'node-server',
  },
  vite: {
    optimizeDeps: {
      include: ['vue', 'reka-ui'],
    },
    ssr: {
      noExternal: ['reka-ui'],
    },
  },
  imports: {
    scan: false,
  },
  runtimeConfig: {
    apiBaseUrl: process.env.API_BASE_URL,

    public: {
      siteBaseUrl: process.env.PUBLIC_SITE_BASE_URL,
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL || '/api',
    },
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/fontaine',
    '@nuxtjs/google-fonts',
    '@nuxtjs/i18n',
    'nuxt-typed-router',
    '@nuxtjs/tailwindcss',
    'nuxt-ssr-api-logger',
    '@vueuse/nuxt',
    'nuxt-security',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vee-validate/nuxt',
    'reka-ui/nuxt',
  ],
  extends: [
    [
      CORE_LAYER_PATH,
      {
        install: true,
      },
    ],
    './layers/core',
    './layers/auth',
    './layers/studio',
  ],

  piniaPluginPersistedstate: {
    storage: 'cookies',
    cookieOptions: {
      maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS,
      sameSite: 'lax',
    },
  },
  googleFonts: {
    families: {
      Roboto: '400..700',
      Inter: '400..700',
      Lalezar: true,
    },
    preload: true,
  },
  fonts: {
    families: [
      {
        name: 'Arlon-Bold',
      },
    ],
    provider: 'local',
  },
  fontMetrics: {
    fonts: ['Roboto', { family: 'Roboto' }, 'Inter', 'Lalezar'],
  },
  image: {
    domains: process.env.API_BASE_URL ? [new URL(process.env.API_BASE_URL).hostname] : [],
  },
  security: {
    enabled: !IS_DEV,
    headers: {
      permissionsPolicy: {
        fullscreen: ['self'],
      },
    },
  },
  i18n: {
    baseUrl: process.env.PUBLIC_SITE_BASE_URL,
    strategy: 'no_prefix',
    langDir: 'locales',
    defaultLocale: 'pl',
    experimental: {
      typedOptionsAndMessages: 'default',
    },
    detectBrowserLanguage: false,
    locales: [
      {
        code: 'pl',
        language: 'pl-PL',
        name: 'Polish',
        files: getFilesForLocale('pl'),
      },
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        files: getFilesForLocale('en'),
      },
    ],
  },
});
