<script lang="ts">
	import { loadProject, saveGlyph, saveShape } from '$lib';
	import type { Glyph, Project, Shape, ShapeLookup } from '$lib/server/loader';
	import { onMount } from 'svelte';

	interface ShapeLayer {
		lookup: ShapeLookup;
		dirty: boolean;
		left: number;
		top: number;
		width: number;
		height: number;
		data: Uint8Array;
		visible: boolean;
	}

	let dialog: HTMLDialogElement;
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let project = $state<Project | undefined>();
	let codepoint = $state<number>(0);
	let size = $state<number>(32);
	let baseline = $state<number>(0);
	let baseLeft = $state<number>(2);
	let gridSize = $state<number>(28);
	let activeShape = $state<number>(-1);
	let shapes = $state<ShapeLayer[]>([]);
	let advance = $state<number>(0);
	let topRef = $state<number>(0);
	let readonly = $state<boolean>(false);
	let shapeMode = $state<boolean>(false);

	let referenceShape = $state<Shape | undefined>();
	let referenceShapeVisible = $state<boolean>(true);
	let referenceFontVisible = $state<boolean>(true);

	let addingShapeName = $state<string>('');

	let shapeSaveCallback: (shape: Shape | undefined) => void = () => {};
	let regularSaveCallback: () => void = () => {};
	let renderKey = $state(0);

	// Grid editor state
	let isDragging = $state<boolean>(false);
	let isShiftPressed = $state<boolean>(false);
	let startX = $state<number>(0);
	let startY = $state<number>(0);
	let currentX = $state<number>(0);
	let currentY = $state<number>(0);
	let fillMode = $state<boolean>(true);
	let previewPixels = $state<Set<string>>(new Set());
	let hoverX = $state<number>(-1);
	let hoverY = $state<number>(-1);

	const glyphName = $derived(String.fromCodePoint(codepoint) || '');

	// Canvas rendering
	const renderCanvas = () => {
		if (!canvas || !ctx) return;

		const width = size * gridSize;
		const height = size * gridSize;
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Draw white background
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, width, height);

		// Draw grid lines
		ctx.strokeStyle = '#d4d4d8';
		ctx.lineWidth = 1;
		for (let i = 0; i <= size; i++) {
			ctx.beginPath();
			ctx.moveTo(i * gridSize, 0);
			ctx.lineTo(i * gridSize, height);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(0, i * gridSize);
			ctx.lineTo(width, i * gridSize);
			ctx.stroke();
		}

		// Draw shapes
		for (const shape of shapes) {
			if (!shape.visible) continue;

			const { lookup, left, top, width: shapeWidth, height: shapeHeight, data } = shape;

			for (let y = 0; y < shapeHeight; y++) {
				for (let x = 0; x < shapeWidth; x++) {
					const targetX = baseLeft + lookup.offsetLeft + left + x;
					const targetY = lookup.offsetTop + top + y;

					if (targetX >= 0 && targetX < size && targetY >= 0 && targetY < size) {
						const sourceIndex = y * shapeWidth + x;
						if (data[sourceIndex]) {
							ctx.fillStyle = 'black';
							ctx.fillRect(targetX * gridSize, targetY * gridSize, gridSize, gridSize);
						}
					}
				}
			}
		}

		// Draw reference font
		if (referenceFontVisible) {
			ctx.fillStyle = '#55000088';
			ctx.font = `${(size / 2) * gridSize}px Microsoft YaHei UI Light`;
			ctx.fillText(glyphName, gridSize * 0.5, (baseline - 0.5) * gridSize);
		}

		// Draw reference shape
		if (referenceShape && referenceShapeVisible) {
			const { left, top, width: shapeWidth, height: shapeHeight, data } = referenceShape;
			for (let y = 0; y < shapeHeight; y++) {
				for (let x = 0; x < shapeWidth; x++) {
					const targetX = baseLeft + left + x;
					const targetY = top + y;

					if (targetX >= 0 && targetX < size && targetY >= 0 && targetY < size) {
						const sourceIndex = y * shapeWidth + x;
						if (data[sourceIndex]) {
							ctx.fillStyle = '#00005588';
							ctx.fillRect(targetX * gridSize, targetY * gridSize, gridSize, gridSize);
						}
					}
				}
			}
		}

		// Draw preview pixels when shift is pressed
		if (isShiftPressed && previewPixels.size > 0) {
			const activeShapeData = shapes[activeShape];
			const offsetX = activeShapeData ? activeShapeData.lookup.offsetLeft : 0;
			const offsetY = activeShapeData ? activeShapeData.lookup.offsetTop : 0;
			for (const pixelKey of previewPixels) {
				const [px, py] = pixelKey.split(',').map(Number);
				const canvasX = px + baseLeft + offsetX;
				const canvasY = py + offsetY;
				if (canvasX >= 0 && canvasX < size && canvasY >= 0 && canvasY < size) {
					ctx.fillStyle = fillMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
					ctx.fillRect(canvasX * gridSize, canvasY * gridSize, gridSize, gridSize);
				}
			}
		}

		// Draw hover indicator
		if (hoverX >= 0 && hoverX < size && hoverY >= 0 && hoverY < size) {
			ctx.strokeStyle = isShiftPressed ? '#3b82f6' : '#ef4444';
			ctx.lineWidth = 2;
			ctx.strokeRect(hoverX * gridSize, hoverY * gridSize, gridSize, gridSize);
		}
	};

	export function setReference(shape: Shape | undefined) {
		referenceShape = shape;
	}

	export function editShape(shape: Shape | undefined, save: (shape: Shape | undefined) => void) {
		shapeMode = true;
		shapeSaveCallback = save;
		shapes = [
			{
				dirty: false,
				lookup: { name: 'Filter', offsetLeft: 0, offsetTop: 0 },
				left: shape?.left || 0,
				top: shape?.top || 0,
				width: shape?.width || 0,
				height: shape?.height || 0,
				data: shape ? Uint8Array.from(shape.data) : new Uint8Array(0),
				visible: true
			}
		];
		size = 36;
		baseline = 24;
		advance = 16;
		readonly = false;
		activeShape = 0;
		dialog.showModal();
	}

	export async function open(
		path: string,
		code: number,
		isReadonly: boolean = false,
		saveCallback?: () => void
	) {
		project = await loadProject(path);
		regularSaveCallback = saveCallback ?? (() => {});
		readonly = isReadonly;
		codepoint = code;
		activeShape = -1;

		let glyph = project?.glyphs.find((g) => g.codepoint === code);
		if (!glyph) {
			glyph = {
				codepoint: code,
				advance: 1,
				shapes: []
			};
		}

		shapeMode = false;
		if (project) {
			size = project.height + Math.floor(project.height / 2);
			baseline = project.height;
			advance = glyph.advance;
			shapes = $state.snapshot(glyph.shapes).map((lookup) => {
				const shape = project!.shapes[lookup.name];
				if (!shape) {
					return {
						lookup,
						dirty: true,
						left: 0,
						top: 0,
						width: 0,
						height: 0,
						data: new Uint8Array(0),
						visible: true
					};
				}
				return {
					lookup,
					dirty: false,
					left: shape.left,
					top: shape.top,
					width: shape.width,
					height: shape.height,
					data: Uint8Array.from(shape.data),
					visible: true
				};
			});
			dialog.showModal();
		}
	}

	export async function closeModal() {
		dialog.close();
	}

	const resizeShape = (
		shape: Shape,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number
	): Shape => {
		const newWidth = maxX - minX + 1;
		const newHeight = maxY - minY + 1;
		const newData = new Uint8Array(newWidth * newHeight);

		for (let y = 0; y < newHeight; y++) {
			for (let x = 0; x < newWidth; x++) {
				const sourceX = x + minX - shape.left;
				const sourceY = y + minY - shape.top;
				if (sourceX < 0 || sourceX >= shape.width || sourceY < 0 || sourceY >= shape.height) {
					continue;
				}
				const sourceIndex = sourceY * shape.width + sourceX;
				const targetIndex = y * newWidth + x;
				newData[targetIndex] = shape.data[sourceIndex];
			}
		}

		return {
			left: minX,
			top: minY,
			width: newWidth,
			height: newHeight,
			data: newData
		};
	};

	// Bresenham's line algorithm to get all pixels on a line
	const getLinePixels = (x0: number, y0: number, x1: number, y1: number) => {
		const pixels: Array<{ x: number; y: number }> = [];
		const dx = Math.abs(x1 - x0);
		const dy = Math.abs(y1 - y0);
		const sx = x0 < x1 ? 1 : -1;
		const sy = y0 < y1 ? 1 : -1;
		let err = dx - dy;

		while (true) {
			pixels.push({ x: x0, y: y0 });

			if (x0 === x1 && y0 === y1) break;

			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy;
				x0 += sx;
			}
			if (e2 < dx) {
				err += dx;
				y0 += sy;
			}
		}

		return pixels;
	};

	const setPixel = (x: number, y: number, value: boolean) => {
		let shape = shapes[activeShape];
		if (!shape) return;

		shape.dirty = true;
		renderKey++;

		if (
			x < shape.left ||
			x >= shape.left + shape.width ||
			y < shape.top ||
			y >= shape.top + shape.height
		) {
			let minX = Math.min(x, shape.left);
			let minY = Math.min(y, shape.top);
			let maxX = Math.max(x, shape.left + shape.width - 1);
			let maxY = Math.max(y, shape.top + shape.height - 1);

			const newShape = resizeShape(shape, minX, minY, maxX, maxY);
			shape.left = newShape.left;
			shape.top = newShape.top;
			shape.width = newShape.width;
			shape.height = newShape.height;
			shape.data = newShape.data;
		}

		const index = (y - shape.top) * shape.width + (x - shape.left);
		shape.data[index] = value ? 1 : 0;
	};

	const togglePixel = (x: number, y: number) => {
		let shape = shapes[activeShape];
		if (!shape) return;

		if (
			x >= shape.left &&
			x < shape.left + shape.width &&
			y >= shape.top &&
			y < shape.top + shape.height
		) {
			const index = (y - shape.top) * shape.width + (x - shape.left);
			return shape.data[index] === 1;
		}
		return false;
	};

	// Get grid coordinates from canvas mouse position
	const getGridCoordinates = (event: MouseEvent) => {
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		const x = Math.floor((event.clientX - rect.left) / gridSize);
		const y = Math.floor((event.clientY - rect.top) / gridSize);
		return { x, y };
	};

	// Mouse event handlers
	const handleMouseDown = (event: MouseEvent) => {
		if (readonly) return;

		const { x, y } = getGridCoordinates(event);
		const activeShapeData = shapes[activeShape];
		const offsetX = activeShapeData ? activeShapeData.lookup.offsetLeft : 0;
		const offsetY = activeShapeData ? activeShapeData.lookup.offsetTop : 0;
		const actualX = x - baseLeft - offsetX;
		const actualY = y - offsetY;

		isDragging = true;
		startX = actualX;
		startY = actualY;
		currentX = actualX;
		currentY = actualY;

		// Determine fill mode based on the first pixel's current state
		fillMode = !togglePixel(actualX, actualY);

		if (isShiftPressed) {
			// Shift mode: show preview of line
			previewPixels = new Set(
				getLinePixels(startX, startY, currentX, currentY).map((p) => `${p.x},${p.y}`)
			);
		} else {
			// Normal mode: immediately set the first pixel
			setPixel(actualX, actualY, fillMode);
		}
	};

	const handleMouseMove = (event: MouseEvent) => {
		const { x, y } = getGridCoordinates(event);

		// Update hover position
		if (x !== hoverX || y !== hoverY) {
			hoverX = x;
			hoverY = y;
		}

		if (!isDragging || readonly) return;

		const activeShapeData = shapes[activeShape];
		const offsetX = activeShapeData ? activeShapeData.lookup.offsetLeft : 0;
		const offsetY = activeShapeData ? activeShapeData.lookup.offsetTop : 0;
		const actualX = x - baseLeft - offsetX;
		const actualY = y - offsetY;
		currentX = actualX;
		currentY = actualY;

		if (isShiftPressed) {
			// Update line preview
			previewPixels = new Set(
				getLinePixels(startX, startY, currentX, currentY).map((p) => `${p.x},${p.y}`)
			);
		} else {
			// Drag mode: fill/unfill pixels along the path
			const pixels = getLinePixels(startX, startY, currentX, currentY);
			for (const pixel of pixels) {
				setPixel(pixel.x, pixel.y, fillMode);
			}
			startX = currentX;
			startY = currentY;
		}
	};

	const optimizeShape = (shape: Shape) => {
		// find the bounding box of the shape
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (let y = 0; y < shape.height; y++) {
			for (let x = 0; x < shape.width; x++) {
				const index = y * shape.width + x;
				if (shape.data[index]) {
					minX = Math.min(minX, shape.left + x);
					minY = Math.min(minY, shape.top + y);
					maxX = Math.max(maxX, shape.left + x);
					maxY = Math.max(maxY, shape.top + y);
				}
			}
		}

		if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
			return {
				left: 0,
				top: 0,
				width: 0,
				height: 0,
				data: new Uint8Array(0)
			};
		}

		return resizeShape(shape, minX, minY, maxX, maxY);
	};

	const handleMouseUp = () => {
		if (!isDragging) return;

		if (isShiftPressed) {
			// Apply the line when releasing mouse
			const pixels = getLinePixels(startX, startY, currentX, currentY);
			for (const pixel of pixels) {
				setPixel(pixel.x, pixel.y, fillMode);
			}
		}

		// Reset state
		isDragging = false;
		previewPixels = new Set();
	};

	const handleMouseLeave = () => {
		hoverX = -1;
		hoverY = -1;

		if (isDragging && !isShiftPressed) {
			isDragging = false;
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			isShiftPressed = true;
		}
	};

	const handleKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			isShiftPressed = false;
			previewPixels = new Set();
		}
	};

	const addShape = () => {
		if (!project) return;
		const adding = addingShapeName.trim();
		if (!adding) return;

		if (shapes.some((shape) => shape.lookup.name === adding)) return;

		let shape = project.shapes[adding];
		let dirty = false;
		if (!shape) {
			dirty = true;
			shape = {
				left: 0,
				top: 0,
				width: 0,
				height: 0,
				data: new Uint8Array(0)
			};
		}

		shapes.push({
			lookup: {
				name: adding,
				offsetTop: 0,
				offsetLeft: 0
			},
			dirty,
			left: shape.left,
			top: shape.top,
			width: shape.width,
			height: shape.height,
			data: Uint8Array.from(shape.data),
			visible: true
		});

		shapes.sort((a, b) => {
			if (a.lookup.name < b.lookup.name) return -1;
			if (a.lookup.name > b.lookup.name) return 1;
			return 0;
		});

		activeShape = shapes.findIndex((shape) => shape.lookup.name === addingShapeName);
		addingShapeName = '';
	};

	const removeShape = (index: number) => {
		shapes.splice(index, 1);
		if (activeShape === index) {
			activeShape = -1;
		} else if (activeShape > index) {
			activeShape--;
		}
	};

	onMount(() => {
		let rendering = true;
		if (canvas) {
			ctx = canvas.getContext('2d')!;
			// Animation frame loop
			const animate = () => {
				if (canvas && ctx) {
					renderCanvas();
				}
				if (!rendering) return;
				requestAnimationFrame(animate);
			};
			animate();
		}

		const onModalClose = async () => {
			if (shapeMode) {
				if (!shapes[0].dirty) return;

				const shape = optimizeShape(shapes[0]);

				if (shape.width === 0 || shape.height === 0) {
					shapeSaveCallback(undefined);
					return;
				}

				shapeSaveCallback(shape);
			} else {
				if (!project) return;
				if (readonly) return;

				const currentShapes = $state.snapshot(shapes);
				const projectName = project.name;
				const codepoint = glyphName.codePointAt(0)!;
				const currentAdvance = advance;
				const saveCallback = regularSaveCallback;

				// find dirty shapes and save them
				const dirtyShapes = currentShapes.filter((shape) => shape.dirty);

				for (const shape of dirtyShapes) {
					await saveShape(projectName, shape.lookup.name, optimizeShape(shape));
				}

				const glyph: Glyph = {
					codepoint,
					advance: currentAdvance,
					shapes: currentShapes.map((shape) => shape.lookup)
				};

				await saveGlyph(projectName, codepoint, glyph);

				saveCallback();
			}
		};
		dialog.addEventListener('close', onModalClose);

		// Global mouseup handler to catch mouseup events outside the grid
		const handleGlobalMouseUp = () => {
			if (isDragging) {
				handleMouseUp();
			}
		};
		window.addEventListener('mouseup', handleGlobalMouseUp);

		return () => {
			rendering = false;
			dialog.removeEventListener('close', onModalClose);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	});
</script>

<dialog
	class="fixed inset-0 size-auto max-h-none max-w-none overflow-y-auto bg-transparent backdrop:bg-black/50"
	bind:this={dialog}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
>
	<div
		class="flex min-h-full items-end justify-center p-4 text-center focus:outline-none sm:items-center sm:p-0"
	>
		<div class="flex gap-4 rounded border border-zinc-500 bg-white p-2 shadow">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="relative" onmouseleave={handleMouseLeave}>
				<canvas
					bind:this={canvas}
					style:width="{size * gridSize}px"
					style:height="{size * gridSize}px"
					class="cursor-crosshair"
					onmousedown={handleMouseDown}
					onmousemove={handleMouseMove}
					onmouseup={handleMouseUp}
					aria-label="pixel grid editor"
				></canvas>
				<div
					style:top="{baseline * gridSize}px"
					style:width="{size * gridSize}px"
					style:height="2px"
					class="pointer-events-none absolute left-0 bg-red-500"
				></div>
				<div
					style:top="{topRef * gridSize}px"
					style:width="{size * gridSize}px"
					style:height="2px"
					class="pointer-events-none absolute left-0 bg-green-500"
				></div>
				<div
					style:left="{baseLeft * gridSize}px"
					style:width="2px"
					style:height="{size * gridSize}px"
					class="pointer-events-none absolute top-0 bg-blue-500"
				></div>

				<div
					style:left="{(baseLeft + advance) * gridSize}px"
					style:width="2px"
					style:height="{size * gridSize}px"
					class="pointer-events-none absolute top-0 bg-amber-500"
				></div>
			</div>

			<div class="flex w-64 flex-col gap-2 text-left">
				<div class="flex items-center justify-end">
					<button
						class="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
						onclick={closeModal}>X</button
					>
				</div>
				<div class="flex gap-2">
					<div class="w-18 font-bold">Glyph:</div>
					{glyphName}
				</div>
				<div class="flex gap-2">
					<input
						class="min-w-0 grow rounded border border-zinc-500 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						type="text"
						bind:value={addingShapeName}
						{readonly}
					/>
					<button
						class="rounded bg-slate-500 px-3 py-1 text-white hover:bg-slate-600 disabled:opacity-50"
						disabled={readonly || shapeMode}
						onclick={addShape}>Add</button
					>
				</div>
				<div class="flex gap-2">
					<div class="w-18 font-bold">Advance:</div>
					<input
						class="w-20 rounded border border-zinc-500 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						type="number"
						readonly={readonly || shapeMode}
						bind:value={advance}
					/>
				</div>
				{#each shapes as shape, index}
					<div
						class="flex flex-col gap-1 rounded border-2 px-2 py-1"
						class:border-red-600={activeShape === index}
						class:border-zinc-800={activeShape !== index}
					>
						<div class="flex gap-2">
							<div class="w-18 font-bold">Shape:</div>
							<span>{shape.lookup.name}</span>
						</div>
						<div class="flex gap-2">
							<div class="w-18 font-bold">Left:</div>
							<input
								class="w-20 rounded border border-zinc-500 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								type="number"
								readonly={readonly || shapeMode}
								bind:value={shape.lookup.offsetLeft}
							/>
						</div>
						<div class="flex gap-2">
							<div class="w-18 font-bold">Top:</div>
							<input
								class="w-20 rounded border border-zinc-500 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								type="number"
								readonly={readonly || shapeMode}
								bind:value={shape.lookup.offsetTop}
							/>
						</div>
						<div class="flex gap-2">
							<button
								class="rounded bg-slate-500 px-3 text-white hover:bg-slate-600 disabled:opacity-50"
								onclick={() => (activeShape = index)}
								disabled={activeShape === index}>Active</button
							>
							<button
								class="rounded px-3 text-white hover:brightness-110 disabled:opacity-50"
								class:bg-blue-500={shape.visible}
								class:bg-zinc-500={!shape.visible}
								onclick={() => (shape.visible = !shape.visible)}
								disabled={readonly || shapeMode}>Visible</button
							>
							<button
								class="rounded bg-red-500 px-3 text-white hover:bg-red-600 disabled:opacity-50"
								onclick={() => removeShape(index)}
								disabled={readonly || shapeMode}>Remove</button
							>
						</div>
					</div>
				{/each}
				{#if referenceShape}
					<div
						class="flex flex-col rounded border-2 px-2 py-1"
						class:border-blue-600={referenceShapeVisible}
						class:border-zinc-800={!referenceShapeVisible}
					>
						<div class="flex gap-2">
							<div class="w-18 font-bold">Overlay:</div>
							<span>Reference Shape</span>
						</div>
						<button
							class="rounded bg-slate-500 text-white hover:bg-slate-600"
							onclick={() => (referenceShapeVisible = !referenceShapeVisible)}>Toggle</button
						>
					</div>
				{/if}
				<div
					class="flex flex-col rounded border-2 px-2 py-1"
					class:border-blue-600={referenceFontVisible}
					class:border-zinc-800={!referenceFontVisible}
				>
					<div class="flex gap-2">
						<div class="w-18 font-bold">Overlay:</div>
						<span>Reference Font</span>
					</div>
					<button
						class="rounded bg-slate-500 text-white hover:bg-slate-600"
						onclick={() => (referenceFontVisible = !referenceFontVisible)}>Toggle</button
					>
				</div>
				<div class="flex flex-col rounded border-2 border-blue-600 px-2 py-1">
					<div class="flex gap-2">
						<div class="w-18 font-bold">TopRef:</div>
						<input
							class="w-20 rounded border border-zinc-500 px-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							type="number"
							bind:value={topRef}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</dialog>
