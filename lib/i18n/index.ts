export { LanguageProvider, LanguageContext } from './LanguageProvider'
export { useTranslation } from './useTranslation'
export { LANGUAGES, DEFAULT_LANGUAGE } from './types'
export type { Language, Translations, LanguageConfig } from './types'

/**
 * Replace {key} placeholders in a translation string with actual values.
 *
 * Usage:
 *   interpolate(t.splitForm.paymentInstruction, { payerName: 'Max', amount: '42,50 €' })
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = values[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}
