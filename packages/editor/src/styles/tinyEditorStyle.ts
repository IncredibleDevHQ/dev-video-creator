import { css } from '@emotion/css'

const tinyEditorStyle = css`
	background: none;
	background-color: transparent;

	p {
		color: white;
		font-family: 'Inter';
		word-wrap: break-word;
	}

	p.is-empty::before {
		color: rgba(209, 213, 219);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
`

export default tinyEditorStyle
