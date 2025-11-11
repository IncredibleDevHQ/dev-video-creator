import { marked } from 'https://cdn.jsdelivr.net/npm/marked@9.1.5/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.es.mjs';

const API_BASE = '/api';

const state = {
	story: null,
	fragments: [],
	activeFragmentId: null,
	isDirty: false,
	draggedFragmentId: null,
	revisions: {},
	selectedRevisionId: null,
	currentBefore: '',
	pendingRevision: null,
};

const fragmentListEl = document.getElementById('fragment-list');
const markdownInputEl = document.getElementById('markdown-input');
const previewEl = document.getElementById('preview');
const fragmentNameEl = document.getElementById('fragment-name');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save-fragment');
const deleteBtn = document.getElementById('delete-fragment');
const addBtn = document.getElementById('add-fragment');
const layoutSelectEl = document.getElementById('layout-select');
const modeSelectEl = document.getElementById('mode-select');
const noteInputEl = document.getElementById('note-input');
const revisionListEl = document.getElementById('revision-list');
const revisionDetailEl = document.getElementById('revision-detail');
const refreshRevisionsBtn = document.getElementById('refresh-revisions');
const intentModalEl = document.getElementById('intent-modal');
const intentTextareaEl = document.getElementById('intent-text');
const intentCancelBtn = document.getElementById('intent-cancel');
const intentSaveBtn = document.getElementById('intent-save');
const intentErrorEl = document.getElementById('intent-modal-error');

async function bootstrap() {
	try {
		const stories = await fetchJSON(`${API_BASE}/stories`);
		if (stories.length === 0) {
			statusEl.textContent = 'No stories found. Create one via API.';
			return;
		}
		state.story = stories[0];
		statusEl.textContent = `Loaded story "${state.story.title}"`;
		await loadFragments();
	} catch (error) {
		console.error(error);
		statusEl.textContent = 'Failed to load story.';
	}
}

async function loadFragments() {
	try {
		const fragments = await fetchJSON(
			`${API_BASE}/stories/${state.story.id}/fragments`
		);
		state.fragments = normalizeOrders(fragments);
		renderFragmentList();
		if (fragments.length) {
			setActiveFragment(fragments[0].id);
		} else {
			clearEditor();
		}
	} catch (err) {
		console.error(err);
		statusEl.textContent = 'Failed to load fragments.';
	}
}

function renderFragmentList() {
	fragmentListEl.innerHTML = '';
	state.fragments.forEach((fragment, index) => {
		const li = document.createElement('li');
		li.className = 'fragment';
		li.setAttribute('draggable', 'true');
		li.dataset.id = fragment.id;
		li.dataset.index = index.toString();
		if (fragment.id === state.activeFragmentId) {
			li.classList.add('is-active');
		}

		const title = document.createElement('p');
		title.className = 'fragment__title';
		title.textContent = fragment.name || '(untitled fragment)';

	const note = document.createElement('p');
	note.className = 'fragment__note';
	const noteText = fragment.view?.note || '';
	if (noteText) {
		note.append(document.createTextNode(noteText));
	}

	const revisionCount = state.revisions[fragment.id]?.length || 0;
	if (revisionCount) {
		if (note.childNodes.length) {
			note.appendChild(document.createElement('br'));
		}
		const badge = document.createElement('span');
		badge.className = 'fragment__note';
		badge.textContent = `${revisionCount} revision${revisionCount === 1 ? '' : 's'}`;
		badge.style.fontStyle = 'italic';
		badge.style.color = '#0f172a';
		badge.style.fontSize = '0.75rem';
		note.appendChild(badge);
	}

	li.appendChild(title);
	if (note.childNodes.length) li.appendChild(note);

		li.addEventListener('click', () => setActiveFragment(fragment.id));
		li.addEventListener('dragstart', handleDragStart);
		li.addEventListener('dragover', handleDragOver);
		li.addEventListener('drop', handleDrop);
		li.addEventListener('dragend', handleDragEnd);

		fragmentListEl.appendChild(li);
	});
}

function clearEditor() {
	state.activeFragmentId = null;
	fragmentNameEl.value = '';
	markdownInputEl.value = '';
	layoutSelectEl.value = 'classic';
	modeSelectEl.value = 'landscape';
	noteInputEl.value = '';
	previewEl.innerHTML = '';
	markdownInputEl.disabled = true;
	fragmentNameEl.disabled = true;
	layoutSelectEl.disabled = true;
	modeSelectEl.disabled = true;
	noteInputEl.disabled = true;
	saveBtn.disabled = true;
	deleteBtn.disabled = true;
	state.isDirty = false;
	state.currentBefore = '';
	state.selectedRevisionId = null;
	revisionListEl.innerHTML = '';
	revisionDetailEl.textContent = 'Select a revision to inspect the intent and diff.';
}

function setActiveFragment(id) {
	const fragment = state.fragments.find(f => f.id === id);
	if (!fragment) return;

	state.activeFragmentId = id;
	fragmentNameEl.value = fragment.name || '';
	markdownInputEl.value = fragment.markdown || '';
	layoutSelectEl.value = fragment.view?.layout || 'classic';
	modeSelectEl.value = fragment.view?.mode || 'landscape';
	noteInputEl.value = fragment.view?.note || '';
	renderPreview(fragment.markdown || '');

	markdownInputEl.disabled = false;
	fragmentNameEl.disabled = false;
	layoutSelectEl.disabled = false;
	modeSelectEl.disabled = false;
	noteInputEl.disabled = false;
	saveBtn.disabled = false;
	deleteBtn.disabled = false;

	state.currentBefore = fragment.markdown || '';
	state.isDirty = false;
	state.selectedRevisionId = null;
	revisionDetailEl.classList.add('muted');
	revisionDetailEl.textContent = 'Select a revision to inspect the intent and diff.';
	renderFragmentList();
	loadRevisionsForFragment(id);
}

function renderPreview(markdown) {
	if (!markdown) {
		previewEl.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
		return;
	}
	const rendered = marked.parse(markdown, {
		breaks: true,
		gfm: true,
	});
	previewEl.innerHTML = DOMPurify.sanitize(rendered);
}

function renderRevisions(fragmentId) {
	const revisions = (state.revisions[fragmentId] || []).slice().sort((a, b) =>
		new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
	revisionListEl.innerHTML = '';

	if (!revisions.length) {
		revisionDetailEl.classList.add('muted');
		revisionDetailEl.textContent = 'No revisions yet. Capture your first edit to see intent insights.';
		return;
	}

	if (!state.selectedRevisionId || !revisions.find(r => r.id === state.selectedRevisionId)) {
		state.selectedRevisionId = revisions[0].id;
	}

	revisions.forEach(revision => {
		const li = document.createElement('li');
		li.className = 'history__item';
		if (revision.id === state.selectedRevisionId) {
			li.classList.add('is-active');
		}
		const title = document.createElement('h4');
		title.textContent = formatTimestamp(revision.createdAt);
		const summary = document.createElement('p');
		summary.textContent = revision.intent?.summary || 'No intent captured.';
		li.append(title, summary);
		li.addEventListener('click', () => {
			state.selectedRevisionId = revision.id;
			showRevisionDetail(revision);
			renderRevisions(fragmentId);
		});
		revisionListEl.appendChild(li);
	});

	const active = revisions.find(r => r.id === state.selectedRevisionId);
	if (active) {
		showRevisionDetail(active);
	}
}

function showRevisionDetail(revision) {
	revisionDetailEl.classList.remove('muted');
	const summary = revision.intent?.summary || 'No intent captured.';
	const source = revision.intent?.source || 'manual';
	const editedByUser = revision.intent?.userEdited ? ' (edited by you)' : '';
	const tags = revision.intent?.tags || [];

	const tagBadges = tags.length > 0
		? tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')
		: '';

	revisionDetailEl.innerHTML = `
		<strong>${formatTimestamp(revision.createdAt)}</strong><br />
		${tagBadges ? `<div style="margin: 0.5rem 0;">${tagBadges}</div>` : ''}
		<span><em>${escapeHTML(summary)}</em> – <span class="muted">${escapeHTML(source)}${editedByUser}</span></span>
		<pre>${escapeHTML(revision.diff)}</pre>
	`;
}

async function loadRevisionsForFragment(fragmentId) {
	if (!state.story || !fragmentId) return;
	try {
		const revisions = await fetchJSON(
			`${API_BASE}/stories/${state.story.id}/fragments/${fragmentId}/revisions`
		);
		state.revisions[fragmentId] = revisions;
		if (fragmentId === state.activeFragmentId) {
			renderRevisions(fragmentId);
		}
	} catch (err) {
		console.error(err);
		statusEl.textContent = 'Unable to load revisions.';
	}
}

function formatTimestamp(iso) {
	try {
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(iso));
	} catch (e) {
		return iso;
	}
}

function escapeHTML(str = '') {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

async function fetchIntentPreview(before, after) {
	return fetchJSON(
		`${API_BASE}/stories/${state.story.id}/fragments/${state.activeFragmentId}/revisions/preview`,
		{
			method: 'POST',
			body: JSON.stringify({ before, after }),
		}
	).then(res => res?.suggestedIntent);
}

async function commitPendingRevision(summary) {
	if (!state.pendingRevision) return;
	const { before, after, suggestedSummary, source } = state.pendingRevision;
	const userEdited = summary.trim() !== (suggestedSummary || '').trim();
	const intentPayload = {
		summary: summary.trim() || 'Edit captured without description.',
		source: userEdited ? 'user' : source || 'manual',
		userEdited,
	};

	try {
		const revision = await fetchJSON(
			`${API_BASE}/stories/${state.story.id}/fragments/${state.activeFragmentId}/revisions`,
			{
				method: 'POST',
				body: JSON.stringify({
					before,
					after,
					intent: intentPayload,
				}),
			}
		);
		const index = state.fragments.findIndex(f => f.id === state.activeFragmentId);
		if (index >= 0) {
			state.fragments[index] = {
				...state.fragments[index],
				name: fragmentNameEl.value || state.fragments[index].name,
				markdown: after,
				view: {
					...(state.fragments[index].view || {}),
					layout: layoutSelectEl.value,
					mode: modeSelectEl.value,
					note: noteInputEl.value,
				},
			};
		}
		state.currentBefore = after;
		state.isDirty = false;
		state.pendingRevision = null;
		statusEl.textContent = 'Revision saved with intent.';
		closeIntentModal();
		await loadRevisionsForFragment(state.activeFragmentId);
		renderFragmentList();
	} catch (err) {
		intentErrorEl.textContent = err.message || 'Failed to save revision.';
		console.error(err);
	}
}

function closeIntentModal() {
	intentModalEl.classList.add('hidden');
	intentTextareaEl.value = '';
	intentErrorEl.textContent = '';
	state.pendingRevision = null;
}

fragmentNameEl.addEventListener('input', () => {
	state.isDirty = true;
});

markdownInputEl.addEventListener('input', event => {
	state.isDirty = true;
	renderPreview(event.target.value);
});

layoutSelectEl.addEventListener('change', () => {
	state.isDirty = true;
});

modeSelectEl.addEventListener('change', () => {
	state.isDirty = true;
});

noteInputEl.addEventListener('input', () => {
	state.isDirty = true;
});

intentCancelBtn.addEventListener('click', () => {
	closeIntentModal();
	statusEl.textContent = 'Revision cancelled.';
});

intentSaveBtn.addEventListener('click', async () => {
	const summary = intentTextareaEl.value;
	if (!summary.trim()) {
		intentErrorEl.textContent = 'Please describe the intent behind your edit.';
		return;
	}
	intentErrorEl.textContent = '';
	await commitPendingRevision(summary);
});

refreshRevisionsBtn.addEventListener('click', () => {
	if (!state.activeFragmentId) return;
	loadRevisionsForFragment(state.activeFragmentId);
});

saveBtn.addEventListener('click', async () => {
	if (!state.activeFragmentId) return;
	const fragment = getActiveFragment();
	if (!fragment && !state.story) return;

	const before = state.currentBefore ?? fragment?.markdown ?? '';
	const after = markdownInputEl.value;

	const desiredName = fragmentNameEl.value || 'Untitled fragment';
	const desiredLayout = layoutSelectEl.value;
	const desiredMode = modeSelectEl.value;
	const desiredNote = noteInputEl.value;

	const metadataChanged =
		(fragment?.name || '') !== desiredName ||
		(fragment?.view?.layout || 'classic') !== desiredLayout ||
		(fragment?.view?.mode || 'landscape') !== desiredMode ||
		(fragment?.view?.note || '') !== desiredNote;
	const contentChanged = before !== after;

	if (!metadataChanged && !contentChanged) {
		statusEl.textContent = 'No changes to save.';
		state.isDirty = false;
		return;
	}

	if (metadataChanged) {
		const payload = {
			name: desiredName,
			markdown: before,
			view: {
				...(fragment?.view || {}),
				layout: desiredLayout,
				mode: desiredMode,
				note: desiredNote,
			},
			order: fragment?.order ?? state.fragments.length,
		};
		try {
			const updated = await fetchJSON(
				`${API_BASE}/stories/${state.story.id}/fragments/${state.activeFragmentId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(payload),
				}
			);
			const index = state.fragments.findIndex(f => f.id === updated.id);
			if (index >= 0) {
				state.fragments[index] = { ...state.fragments[index], ...updated };
			}
			renderFragmentList();
		} catch (err) {
			console.error(err);
			statusEl.textContent = 'Failed to update fragment metadata.';
			return;
		}
	}

	if (!contentChanged) {
		statusEl.textContent = 'Metadata updated.';
		state.isDirty = false;
		return;
	}

	let suggestedIntent = null;
	try {
		suggestedIntent = await fetchIntentPreview(before, after);
	} catch (err) {
		console.warn('Intent preview unavailable:', err.message || err);
		statusEl.textContent = 'Intent preview unavailable. Provide your own description.';
	}

	state.pendingRevision = {
		before,
		after,
		suggestedSummary: suggestedIntent?.summary || '',
		source: suggestedIntent?.source || 'manual',
	};
	intentTextareaEl.value = suggestedIntent?.summary || '';
	intentErrorEl.textContent = '';
	intentModalEl.classList.remove('hidden');
	// Delay focus to ensure CSS transition completes
	setTimeout(() => intentTextareaEl.focus(), 100);
});

deleteBtn.addEventListener('click', async () => {
	if (!state.activeFragmentId) return;
	const confirmed = confirm('Delete this fragment?');
	if (!confirmed) return;

	try {
		await fetchJSON(
			`${API_BASE}/stories/${state.story.id}/fragments/${state.activeFragmentId}`,
			{ method: 'DELETE' }
		);
		delete state.revisions[state.activeFragmentId];
		state.fragments = normalizeOrders(
			state.fragments.filter(f => f.id !== state.activeFragmentId)
		);
		statusEl.textContent = 'Fragment deleted.';
		if (state.fragments.length) {
			setActiveFragment(state.fragments[0].id);
			persistFragmentOrder();
		} else {
			clearEditor();
		}
	} catch (err) {
		console.error(err);
		statusEl.textContent = 'Failed to delete fragment.';
	}
});

addBtn.addEventListener('click', async () => {
	const name = prompt('New fragment name?', 'New section');
	if (!name) return;

	const payload = {
		name,
		markdown: 'Start writing your story…',
		view: {
			layout: layoutSelectEl.value || 'classic',
			mode: modeSelectEl.value || 'landscape',
			note: noteInputEl.value || '',
		},
		order: state.fragments.length,
	};

	try {
		const created = await fetchJSON(
			`${API_BASE}/stories/${state.story.id}/fragments`,
			{
				method: 'POST',
				body: JSON.stringify(payload),
			}
		);
		state.fragments.push(created);
		setActiveFragment(created.id);
		renderFragmentList();
		statusEl.textContent = `Created "${created.name}".`;
	} catch (err) {
		console.error(err);
		statusEl.textContent = 'Failed to create fragment.';
	}
});

function getActiveFragment() {
	return state.fragments.find(f => f.id === state.activeFragmentId);
}

async function fetchJSON(url, options = {}) {
	const response = await fetch(url, {
		headers: {
			'Content-Type': 'application/json',
		},
		...options,
	});

	if (!response.ok) {
		const text = await response.text();
		const error = new Error(text || response.statusText);
		error.status = response.status;
		throw error;
	}

	if (response.status === 204) return null;
	return response.json();
}

function handleDragStart(event) {
	const id = event.currentTarget.dataset.id;
	state.draggedFragmentId = id;
	event.currentTarget.classList.add('is-dragging');
	event.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(event) {
	event.preventDefault();
	event.dataTransfer.dropEffect = 'move';
}

function handleDrop(event) {
	event.preventDefault();
	const targetId = event.currentTarget.dataset.id;
	const draggedId = state.draggedFragmentId;
	if (!draggedId || draggedId === targetId) return;

	const draggedIndex = state.fragments.findIndex(f => f.id === draggedId);
	const targetIndex = state.fragments.findIndex(f => f.id === targetId);
	if (draggedIndex < 0 || targetIndex < 0) return;

	const [removed] = state.fragments.splice(draggedIndex, 1);
	state.fragments.splice(targetIndex, 0, removed);

	state.fragments = normalizeOrders(state.fragments);
	renderFragmentList();
	persistFragmentOrder();
}

function handleDragEnd(event) {
	event.currentTarget.classList.remove('is-dragging');
	state.draggedFragmentId = null;
}

async function persistFragmentOrder() {
	try {
		await Promise.all(
			state.fragments.map(fragment =>
				fetchJSON(
					`${API_BASE}/stories/${state.story.id}/fragments/${fragment.id}`,
					{
						method: 'PATCH',
						body: JSON.stringify({
							name: fragment.name,
							markdown: fragment.markdown,
							view: fragment.view,
							order: fragment.order,
						}),
					}
				)
			)
		);
		statusEl.textContent = 'Fragment order updated.';
	} catch (err) {
		console.error(err);
		statusEl.textContent = 'Failed to update order.';
	}
}

function normalizeOrders(fragments) {
	return fragments.map((fragment, index) => ({
		...fragment,
		order: index,
	}));
}

bootstrap();
