import { afterEach, describe, expect, it } from 'vitest'
import { readDesignToken } from './readDesignToken'

describe('readDesignToken', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--ods-data-series-actual')
    document.body.replaceChildren()
  })

  it('returns the resolved, trimmed value from the root element', () => {
    document.documentElement.style.setProperty('--ods-data-series-actual', '  #629569 ')

    expect(readDesignToken('--ods-data-series-actual')).toBe('#629569')
  })

  it('reads a scoped override from the element it is given', () => {
    const scope = document.createElement('div')
    scope.style.setProperty('--ods-data-series-actual', '#85bc8b')
    document.body.append(scope)

    expect(readDesignToken('--ods-data-series-actual', scope)).toBe('#85bc8b')
  })

  it('returns an empty string for a token that is not defined', () => {
    expect(readDesignToken('--ods-not-a-token')).toBe('')
  })
})
