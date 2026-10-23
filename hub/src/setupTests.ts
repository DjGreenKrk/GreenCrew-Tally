// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';
import 'jest-extended';

// The component tests assert the English texts: render them in English.
// (The app itself defaults to Polish; i18n.spec.tsx covers that.)
beforeEach(() => {
  window.localStorage.setItem('gc-tally.language', 'en')
})

// react-router 7 needs these, jsdom does not provide them.
Object.assign(globalThis, { TextEncoder, TextDecoder })
