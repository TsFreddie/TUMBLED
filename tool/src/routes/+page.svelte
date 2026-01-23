<script lang="ts">
	import {
		BoldMode,
		checkFilter,
		loadProject,
		loadReference,
		render,
		unloadProject,
		unloadReference
	} from '$lib';
	import Editor from '$lib/components/Editor.svelte';
	import BatchDialog from '$lib/components/BatchDialog.svelte';
	import type { Glyph, Project, Shape } from '$lib/server/loader';
	import { onMount } from 'svelte';
	import { glyphProgressStore } from '$lib/stores/glyphProgress';
	import { SEQS } from '$lib/seq';

	let editor: Editor;

	let reference = $state<Project>();
	let referenceFontName = $state<string>('unifont');
	let project = $state<Project>();
	let projectGlyphs = $state<Record<number, Glyph>>({});
	let fontName = $state<string>('');
	const glyphSize = (height: number) => height + Math.floor(height / 2);
	let filter = $state<Shape>();
	let bold = $state<BoldMode>(0);

	let goto = $state<string>('');
	let seqFilter = $state<string>('');

	// Progress tracking state
	let lastClickedCodepoint = $state<number | null>(null);
	let bookmarks = $state<number[]>([]);

	const updateProjectGlyphs = () => {
		projectGlyphs = {};
		if (!project) return;
		for (const glyph of project.glyphs) {
			projectGlyphs[glyph.codepoint] = glyph;
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		// Ignore keyboard shortcuts if focus is on an input element
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
			return;
		}

		const key = e.key.toLowerCase();

		if (key === 'b') {
			toggleBold();
		} else if (key === 'q') {
			quickResolve();
		} else if (key === 'g' && e.ctrlKey) {
			document.getElementById('goto-field')?.focus();
			e.preventDefault();
		} else if (key === 'i') {
			if (e.ctrlKey) {
				document.getElementById('seq-filter-field')?.focus();
				e.preventDefault();
			} else {
				findNextSeq();
			}
		}
	};

	const findNextSeq = () => {
		if (!reference) return;
		if (!seqFilter) return;

		const currentIndex = reference.glyphs.findIndex(
			(glyph) => glyph.codepoint === lastClickedCodepoint
		);
		const length = reference.glyphs.length;

		for (let i = 0; i < length; i++) {
			const index = (currentIndex + i + 1) % length;
			const codepoint = reference.glyphs[index].codepoint;
			const seq = SEQS[codepoint];
			if (!seq) continue;
			for (const part of seq) {
				if (part.includes(seqFilter)) {
					lastClickedCodepoint = codepoint;
					scrollToCodepoint(codepoint);
					return;
				}
			}
		}
	};

	let filterStats = $state({
		hit: 0,
		set: [] as boolean[]
	});

	let showBatchDialog = $state<boolean>(false);
	let filteredIndices = $derived(() => {
		const indices: number[] = [];
		if (!reference) return indices;
		for (let i = 0; i < reference.glyphs.length; i++) {
			if (filterStats.set[i]) {
				indices.push(i);
			}
		}
		return indices;
	});

	const clearFilter = () => {
		filter = undefined;
		filterStats = {
			hit: 0,
			set: []
		};
	};

	const updateFilter = () => {
		if (!reference) return;

		filterStats = {
			hit: 0,
			set: new Array(reference.glyphs.length)
		};

		if (!filter) return;

		for (let i = 0; i < reference.glyphs.length; i++) {
			const glyph = reference.glyphs[i];
			if (checkFilter(filter, reference, glyph)) {
				filterStats.hit++;
				filterStats.set[i] = true;
			}
		}
	};

	const editFilter = () => {
		editor.editShape(filter, (shape) => {
			if (!shape) {
				clearFilter();
			} else {
				filter = {
					left: shape.left,
					top: shape.top,
					width: shape.width,
					height: shape.height,
					data: Uint8Array.from(shape.data)
				};
				updateFilter();
			}
		});
	};

	const toggleBold = () => {
		bold = (bold + 1) % 4;
	};

	onMount(async () => {
		reference = await loadProject(referenceFontName);
		// Set initial project name in progress store
		glyphProgressStore.setProjectName('REFERENCE');
	});

	const openReference = (codepoint: number) => {
		if (!reference) return;
		editor.setReference(reference.shapes[codepoint]);
		editor.open(undefined, codepoint);
	};

	const editProjectGlyph = (codepoint: number) => {
		if (!project) return;
		if (reference) {
			editor.setReference(reference.shapes[codepoint]);
		}
		editor.open(project.name, codepoint, false, async () => {
			project = await loadProject(project!.name);
			updateProjectGlyphs();
		});
	};

	const scrollToCodepoint = (codepoint: number) => {
		const element = document.querySelector(`[aria-label="${String.fromCodePoint(codepoint)}"]`);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	};

	// quickly find the next character that might be
	// already finished using the IDS database
	const quickResolve = () => {
		if (!reference) return;
		if (!project) return;

		const lastClickedIndex = reference.glyphs.findIndex(
			(glyph) => glyph.codepoint === lastClickedCodepoint
		);

		const shapeKeys = new Set(
			Object.keys(project.shapes).map((s) => {
				while (s.endsWith('+') || s.endsWith('-')) {
					s = s.slice(0, -1);
				}
				return s;
			})
		);

		for (let i = 0; i < reference.glyphs.length; i++) {
			const current = (lastClickedIndex + i + 1) % reference.glyphs.length;

			// skip existing glyphs
			const codepoint = reference.glyphs[current].codepoint;
			if (projectGlyphs[codepoint]) continue;

			const seq = SEQS[codepoint];
			if (!seq) continue;

			let possible = true;
			for (const part of seq) {
				if (!shapeKeys.has(part)) {
					possible = false;
					break;
				}
			}

			if (possible) {
				lastClickedCodepoint = reference.glyphs[current].codepoint;
				glyphProgressStore.setLastClickedCodepoint(lastClickedCodepoint);
				scrollToCodepoint(lastClickedCodepoint);
				return;
			}
		}
	};

	// Initialize progress store subscription
	onMount(() => {
		// Subscribe to progress store changes
		const unsubscribe = glyphProgressStore.subscribe(() => {
			lastClickedCodepoint = glyphProgressStore.getLastClickedCodepoint();
			bookmarks = glyphProgressStore.getBookmarks();
		});

		// Initial load
		lastClickedCodepoint = glyphProgressStore.getLastClickedCodepoint();
		bookmarks = glyphProgressStore.getBookmarks();

		return unsubscribe;
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if reference}
	{#key reference}
		<div class="flex gap-2 p-2">
			<input
				type="text"
				class="w-64 text-2xl font-bold"
				bind:value={fontName}
				placeholder="unifont"
				onkeydown={async (ev) => {
					if (ev.code === 'Enter') {
						const target = ev.currentTarget;
						if (project) {
							unloadProject(project.name);
						}
						try {
							if (fontName) {
								project = await loadProject(fontName);
								updateProjectGlyphs();
								// Update progress store with new project name
								glyphProgressStore.setProjectName(fontName);
							} else {
								project = undefined;
								updateProjectGlyphs();
								// Reset to reference project
								glyphProgressStore.setProjectName('REFERENCE');
							}
						} catch (e) {
							console.error(e);
							project = undefined;
							updateProjectGlyphs();
						}

						target.blur();
					}
				}}
				onblur={async () => {
					if (project) {
						fontName = project.name;
					} else {
						fontName = '';
					}
				}}
			/>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2">
					<span class="font-bold">Ref:</span>
					<input
						type="text"
						class="w-32 rounded border border-zinc-500 px-2"
						bind:value={referenceFontName}
						onkeydown={async (ev) => {
							if (ev.code === 'Enter') {
								console.log('HI');
								const target = ev.currentTarget;
								if (reference) {
									unloadReference(reference.name);
								}
								if (referenceFontName) {
									try {
										reference = await loadReference(referenceFontName);
									} catch (e) {
										console.error(e);

										reference = await loadReference('unifont');
									}
								} else {
									reference = await loadReference('unifont');
								}

								target.blur();
							}
						}}
						onblur={async () => {
							if (reference) {
								referenceFontName = reference.name;
							}
						}}
					/>
					<span class="font-bold">Goto:</span>
					<input
						type="text"
						class="w-32 rounded border border-zinc-500 px-2"
						id="goto-field"
						bind:value={goto}
						onkeydown={async (ev) => {
							if (ev.code === 'Enter') {
								const target = ev.currentTarget;

								const codepoint = Number(goto);
								if (!isNaN(codepoint)) {
									lastClickedCodepoint = codepoint;
									scrollToCodepoint(codepoint);
								} else {
									const codepoint = goto.codePointAt(0)!;
									lastClickedCodepoint = codepoint;
									scrollToCodepoint(codepoint);
								}

								target.blur();
							}
						}}
					/>
					<span class="font-bold">Seq:</span>
					<input
						type="text"
						class="w-32 rounded border border-zinc-500 px-2"
						id="seq-filter-field"
						bind:value={seqFilter}
						onkeydown={async (ev) => {
							if (ev.code === 'Enter') {
								const target = ev.currentTarget;
								target.blur();
								lastClickedCodepoint = -1;
								findNextSeq();
							}
						}}
					/>
				</div>
				<button
					class="rounded {bold
						? 'bg-purple-700'
						: 'bg-purple-500'} px-3 py-1 text-white hover:bg-purple-600"
					onclick={toggleBold}>Bold: {bold}</button
				>
				{#if filter}
					<div class="h-8 w-8">
						<canvas
							class="h-full"
							use:render={{
								bold,
								width: filter.left + filter.width,
								height: filter.top + filter.height,
								shapes: [filter]
							}}
						></canvas>
					</div>
					<button
						class="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
						onclick={clearFilter}>Clear</button
					>
					<div>Hits: {filterStats.hit} / {reference.glyphs.length}</div>
				{/if}
				<button
					class="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
					onclick={editFilter}>Edit Filter</button
				>
				{#if filter && project}
					<button
						class="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
						onclick={() => (showBatchDialog = true)}>Batch Add Shape</button
					>
				{/if}

				<button
					class="rounded bg-purple-500 px-3 py-1 text-white hover:bg-purple-600"
					onclick={quickResolve}>Quick Resolve</button
				>

				{#if project}
					<div>
						{project.glyphs.length} / {reference.glyphs.length} ({Math.floor(
							(project.glyphs.length / reference.glyphs.length) * 100
						)}%)
					</div>
				{/if}
			</div>
		</div>
		<div class="flex flex-wrap overflow-x-hidden">
			{#each reference.glyphs as glyph, index}
				{@const projectGlyph = projectGlyphs[glyph.codepoint]}
				{@const renderProject = projectGlyph ? project : reference}
				{@const renderGlyph = projectGlyph || glyph}
				{@const size = glyphSize(renderProject!.height)}
				{@const filterHit = filterStats.set[index]}
				{@const isLastClicked = lastClickedCodepoint === glyph.codepoint}
				{@const isBookmarked = bookmarks.includes(glyph.codepoint)}
				<button
					class="relative flex h-16 w-16 cursor-pointer items-center justify-center border ring-inset hover:bg-blue-100"
					class:bg-zinc-300={!projectGlyph}
					class:ring-2={isLastClicked || isBookmarked || filterHit}
					class:ring-blue-500={filterHit}
					class:ring-amber-500={isLastClicked}
					class:ring-green-400={isBookmarked}
					aria-label={String.fromCodePoint(glyph.codepoint)}
					onclick={(ev) => {
						if (ev.ctrlKey) {
							editor.setReference(reference!.shapes[glyph.shapes[0].name]);
						} else {
							// Track last clicked glyph
							glyphProgressStore.setLastClickedCodepoint(glyph.codepoint);

							if (project) {
								editProjectGlyph(glyph.codepoint);
							} else {
								openReference(glyph.codepoint);
							}
						}
					}}
					oncontextmenu={(ev) => {
						ev.preventDefault();
						// Toggle bookmark on right-click
						glyphProgressStore.toggleBookmark(glyph.codepoint);
					}}
				>
					<div class="absolute text-xs text-transparent">
						{String.fromCodePoint(renderGlyph.codepoint)}
					</div>
					{#if isBookmarked}
						<div class="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-500"></div>
					{/if}
					<canvas
						class="h-full"
						use:render={{
							bold,
							width: renderGlyph.advance,
							height: size,
							shapes: renderGlyph.shapes.map((shape) => {
								const shapeData = renderProject!.shapes[shape.name];
								if (!shapeData) {
									return undefined;
								}
								return {
									...shapeData,
									top: shapeData.top + shape.offsetTop,
									left: shapeData.left + shape.offsetLeft
								};
							})
						}}
					></canvas>
				</button>
			{/each}
		</div>
	{/key}
{/if}

<Editor bind:this={editor}></Editor>

{#if showBatchDialog && project && reference}
	<BatchDialog
		{project}
		{reference}
		filteredIndices={filteredIndices()}
		onClose={() => (showBatchDialog = false)}
		onComplete={async () => {
			project = await loadProject(project!.name);
			updateProjectGlyphs();
		}}
	/>
{/if}
