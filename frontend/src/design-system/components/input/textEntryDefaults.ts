import type { InputHTMLAttributes } from 'react'

type TextEntryAttributes = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoCapitalize' | 'autoComplete' | 'autoCorrect' | 'spellCheck'
>

export const textEntryDefaults = {
  autoCapitalize: 'off',
  autoComplete: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  // This standard HTML attribute disables WebKit's inline predictive text.
  // React's current native-prop types do not yet include it; lowercase is forwarded to the DOM.
  writingsuggestions: 'false',
} as const

export const textEntryAttributes = (props: TextEntryAttributes) => ({
  autoCapitalize: props.autoCapitalize ?? textEntryDefaults.autoCapitalize,
  autoComplete: props.autoComplete ?? textEntryDefaults.autoComplete,
  autoCorrect: props.autoCorrect ?? textEntryDefaults.autoCorrect,
  spellCheck: props.spellCheck ?? textEntryDefaults.spellCheck,
  writingsuggestions: textEntryDefaults.writingsuggestions,
})
