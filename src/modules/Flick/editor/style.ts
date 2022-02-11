import { css } from '@emotion/css'

const editorStyle = css`
  background: none;
  background-color: transparent;

  img {
    margin-top: 1em;
    margin-bottom: 1em;
  }

  code {
    color: #16a349;
    font-weight: 600;
    font-size: 0.875em;
    background-color: #f3f4f6;
    padding: 0.25em 0.5em;
    border-radius: 3px;
  }

  pre {
    margin: 0px;
  }

  code::before {
    content: '';
  }

  code::after {
    content: '';
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: rgba(31, 41, 55);
    font-family: Gilroy, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol', 'Noto Color Emoji';
  }

  p {
    color: rgba(75, 85, 99);
    font-family: 'Inter';
    word-wrap: break-word;
  }

  p.is-empty::before,
  h1.is-empty::before,
  h2.is-empty::before,
  h3.is-empty::before,
  h4.is-empty::before,
  h5.is-empty::before,
  h6.is-empty::before {
    color: rgba(209, 213, 219);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  .hljs-comment,
  .hljs-quote {
    color: #616161;
  }

  .hljs-variable,
  .hljs-template-variable,
  .hljs-attribute,
  .hljs-tag,
  .hljs-name,
  .hljs-regexp,
  .hljs-link,
  .hljs-name,
  .hljs-selector-id,
  .hljs-selector-class {
    color: #f98181;
  }

  .hljs-number,
  .hljs-meta,
  .hljs-built_in,
  .hljs-builtin-name,
  .hljs-literal,
  .hljs-type,
  .hljs-params {
    color: #fbbc88;
  }

  .hljs-string,
  .hljs-symbol,
  .hljs-bullet {
    color: #b9f18d;
  }

  .hljs-title,
  .hljs-section {
    color: #faf594;
  }

  .hljs-keyword,
  .hljs-selector-tag {
    color: #70cff8;
  }

  .hljs-emphasis {
    font-style: italic;
  }

  .hljs-strong {
    font-weight: 700;
  }

  .collaboration-cursor__caret {
    border-left: 1px solid #0d0d0d;
    border-right: 1px solid #0d0d0d;
    margin-left: -1px;
    margin-right: -1px;
    pointer-events: none;
    position: relative;
    word-break: normal;
  }

  /* Render the username above the caret */
  .collaboration-cursor__label {
    border-radius: 3px 3px 3px 0;
    color: #0d0d0d;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    left: -1px;
    line-height: normal;
    padding: 0.1rem 0.3rem;
    position: absolute;
    top: -1.4em;
    user-select: none;
    white-space: nowrap;
  }
`
export default editorStyle
