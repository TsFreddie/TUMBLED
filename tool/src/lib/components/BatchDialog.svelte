<script lang="ts">
	import { saveGlyph } from '$lib';
	import type { Project, ShapeLookup } from '$lib/server/loader';
	import { onMount } from 'svelte';

	interface Props {
		project: Project;
		reference: Project;
		filteredIndices: number[];
		onClose: () => void;
		onComplete: () => Promise<void>;
	}

	let { project, reference, filteredIndices, onClose, onComplete }: Props = $props();

	let dialog: HTMLDialogElement;
	let offsetTop = $state<number>(0);
	let offsetLeft = $state<number>(0);
	let glyphName = $state<string>('');
	let isProcessing = $state<boolean>(false);
	let status = $state<string>('');

	onMount(() => {
		if (dialog) {
			dialog.showModal();
		}
	});

	const applyBatch = async () => {
		if (!project) return;
		if (!glyphName.trim()) {
			status = 'Please enter a shape name';
			return;
		}

		isProcessing = true;
		status = 'Processing...';

		let updatedCount = 0;
		let skippedCount = 0;

		try {
			// Iterate through all glyphs that are NOT filtered (i.e., visible)
			for (const index of filteredIndices) {
				let glyph = project.glyphs[index];

				// If glyph doesn't exist, create it based on reference
				if (!glyph) {
					const referenceGlyph = reference.glyphs[index];
					if (!referenceGlyph) {
						skippedCount++;
						continue;
					}
					glyph = {
						codepoint: referenceGlyph.codepoint,
						advance: referenceGlyph.advance,
						shapes: []
					};
					project.glyphs[index] = glyph;
				}

				// Check if shape name already exists in this glyph
				const shapeExists = glyph.shapes.some((shape) => shape.name === glyphName);

				if (shapeExists) {
					skippedCount++;
					continue;
				}

				// Add the shape to the glyph
				const newShapeLookup: ShapeLookup = {
					name: glyphName,
					offsetTop,
					offsetLeft
				};

				glyph.shapes.push(newShapeLookup);

				// Sort shapes by name for consistency
				glyph.shapes.sort((a, b) => {
					if (a.name < b.name) return -1;
					if (a.name > b.name) return 1;
					return 0;
				});

				// Save the updated glyph
				await saveGlyph(project.name, glyph.codepoint, glyph);
				updatedCount++;
			}

			status = `Completed: ${updatedCount} glyphs updated, ${skippedCount} skipped (shape already exists)`;
		} catch (error) {
			status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			isProcessing = false;
		}
	};

	const handleClose = () => {
		if (!isProcessing) {
			onClose();
		}
	};

	const handleComplete = async () => {
		if (!isProcessing && status.includes('Completed')) {
			await onComplete();
			onClose();
		}
	};
</script>

<dialog
	class="fixed inset-0 size-auto max-h-none max-w-none overflow-y-auto bg-transparent backdrop:bg-black/50"
	bind:this={dialog}
>
	<div
		class="flex min-h-full items-center justify-center p-4 text-center focus:outline-none sm:items-center sm:p-0"
	>
		<div class="rounded border border-zinc-500 bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold">Batch Add Shape to Glyphs</h2>
				<button
					class="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600 disabled:opacity-50"
					disabled={isProcessing}
					onclick={handleClose}
				>
					X
				</button>
			</div>

			<div class="mb-4">
				<p class="mb-2 text-sm text-gray-600">
					This will add the shape to {filteredIndices.length} filtered glyphs.
				</p>
			</div>

			<div class="mb-4 flex flex-col gap-3">
				<div class="flex gap-2">
					<div class="w-24 font-bold">Shape Name:</div>
					<input
						class="grow rounded border border-zinc-500 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						type="text"
						bind:value={glyphName}
						disabled={isProcessing}
						placeholder="e.g., accent"
					/>
				</div>

				<div class="flex gap-2">
					<div class="w-24 font-bold">Offset Top:</div>
					<input
						class="w-24 rounded border border-zinc-500 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						type="number"
						bind:value={offsetTop}
						disabled={isProcessing}
					/>
				</div>

				<div class="flex gap-2">
					<div class="w-24 font-bold">Offset Left:</div>
					<input
						class="w-24 rounded border border-zinc-500 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						type="number"
						bind:value={offsetLeft}
						disabled={isProcessing}
					/>
				</div>
			</div>

			<div class="mb-4">
				{#if status}
					<div class="rounded bg-gray-100 p-3 text-sm">
						{status}
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
					disabled={isProcessing}
					onclick={applyBatch}
				>
					{isProcessing ? 'Processing...' : 'Apply'}
				</button>
				<button
					class="rounded bg-slate-500 px-4 py-2 text-white hover:bg-slate-600 disabled:opacity-50"
					disabled={isProcessing || !status.includes('Completed')}
					onclick={handleComplete}
				>
					Close & Reload
				</button>
			</div>
		</div>
	</div>
</dialog>
