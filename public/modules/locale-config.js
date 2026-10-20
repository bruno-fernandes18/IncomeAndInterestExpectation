export const LOCALES = Object.freeze([
  { id: 'en', tag: 'en-US', currency: 'USD', direction: 'ltr', brandOrder: 'suffix' },
  { id: 'zh-Hans', tag: 'zh-CN', currency: 'CNY', direction: 'ltr', brandOrder: 'suffix' },
  { id: 'hi', tag: 'hi-IN', currency: 'INR', direction: 'ltr', brandOrder: 'suffix' },
  { id: 'es', tag: 'es-MX', currency: 'MXN', direction: 'ltr', brandOrder: 'prefix' },
  { id: 'ar', tag: 'ar-SA', currency: 'SAR', direction: 'rtl', brandOrder: 'prefix' },
  { id: 'fr', tag: 'fr-FR', currency: 'EUR', direction: 'ltr', brandOrder: 'prefix' },
  { id: 'bn', tag: 'bn-BD', currency: 'BDT', direction: 'ltr', brandOrder: 'suffix' },
  { id: 'pt', tag: 'pt-BR', currency: 'BRL', direction: 'ltr', brandOrder: 'prefix' },
  { id: 'id', tag: 'id-ID', currency: 'IDR', direction: 'ltr', brandOrder: 'prefix' },
  { id: 'ur', tag: 'ur-PK', currency: 'PKR', direction: 'rtl', brandOrder: 'suffix' },
]);

export const LOCALE_BY_ID = Object.freeze(Object.fromEntries(LOCALES.map((locale) => [locale.id, locale])));
