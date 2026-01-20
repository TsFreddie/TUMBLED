import { pack, unpack } from 'msgpackr';
import type { Glyph, Project, Shape } from './server/loader';
import type { Action } from 'svelte/action';
import { browser } from '$app/environment';

const projects = new Map<string, Project>();

const BASE_PATH = '../fonts';

export const loadProject = async (font: string) => {
	if (projects.has(font)) return projects.get(font);

	const path = `${BASE_PATH}/${font}`;
	const response = await fetch(`/api/project?path=${path}`);
	if (!response.ok) {
		throw new Error(`Failed to load project: ${response.statusText}`);
	}

	const buffer = new Uint8Array(await response.arrayBuffer());
	const project = unpack(buffer);

	project.name = font;
	projects.set(font, project);
	return project as Project;
};

export const unloadProject = (font: string) => {
	projects.delete(font);
};

export const saveShape = async (font: string, name: string, shape: Shape) => {
	const project = projects.get(font);
	if (!project) throw new Error(`Project ${font} not loaded`);

	const filePath = `${BASE_PATH}/${font}/shapes/${name}.txt`;
	const formData = new FormData();
	formData.append('data', new Blob([pack({ filePath, shape }) as Uint8Array<ArrayBuffer>]));

	const response = await fetch('/api/shape', {
		method: 'POST',
		body: formData
	});
	if (!response.ok) {
		throw new Error(`Failed to save shape: ${response.statusText}`);
	}

	project.shapes[name] = shape;
};

export const saveGlyph = async (font: string, codepoint: number, glyph: Glyph) => {
	const project = projects.get(font);
	if (!project) throw new Error(`Project ${font} not loaded`);

	const filePath = `${BASE_PATH}/${font}/glyphs/${codepoint}.txt`;
	const formData = new FormData();
	formData.append('data', new Blob([pack({ filePath, glyph }) as Uint8Array<ArrayBuffer>]));

	const response = await fetch('/api/glyph', {
		method: 'POST',
		body: formData
	});
	if (!response.ok) {
		throw new Error(`Failed to save glyph: ${response.statusText}`);
	}

	const existingGlyph = project.glyphs.findIndex((g) => g.codepoint === codepoint);
	if (existingGlyph != -1) {
		if (glyph.shapes.length === 0) {
			// delete empty glyph
			project.glyphs.splice(existingGlyph, 1);
			return;
		}

		Object.assign(project.glyphs[existingGlyph], glyph);
		return;
	}

	if (glyph.shapes.length > 0) {
		project.glyphs.push(glyph);
		project.glyphs.sort((a, b) => a.codepoint - b.codepoint);
	}
};

export const renameShape = async (font: string, oldName: string, newName: string) => {
	const project = projects.get(font);
	if (!project) throw new Error(`Project ${font} not loaded`);

	const formData = new FormData();
	formData.append(
		'data',
		new Blob([
			pack({ projectPath: `${BASE_PATH}/${font}`, oldName, newName }) as Uint8Array<ArrayBuffer>
		])
	);

	const response = await fetch('/api/shape/rename', {
		method: 'POST',
		body: formData
	});
	if (!response.ok) {
		throw new Error(`Failed to rename shape: ${response.statusText}`);
	}

	// Update client-side project state
	if (project.shapes[oldName]) {
		project.shapes[newName] = project.shapes[oldName];
		delete project.shapes[oldName];

		// Update all glyphs that reference this shape
		for (const glyph of project.glyphs) {
			for (const shape of glyph.shapes) {
				if (shape.name === oldName) {
					shape.name = newName;
				}
			}
		}
	}
};

const renderShapes = (
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
	shapes: (Shape | undefined)[],
	bold: boolean
) => {
	if (width == 0 || height == 0) {
		canvas.width = 1;
		canvas.height = 1;
		return;
	}

	if (bold) {
		width = width + 1;
	}

	canvas.height = height;
	canvas.width = width;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const imageData = ctx.createImageData(canvas.width, canvas.height);

	// render pixels
	for (const shape of shapes) {
		if (!shape) continue;
		for (let y = 0; y < shape.height; y++) {
			for (let x = 0; x < shape.width + (bold ? 1 : 0); x++) {
				const imageX = x + shape.left;
				const imageY = y + shape.top;
				if (imageX < 0 || imageX >= imageData.width || imageY < 0 || imageY >= imageData.height)
					continue;

				const imageIndex = (imageY * imageData.width + imageX) * 4;
				const index = y * shape.width + x;
				let pixel = x >= shape.width ? 0 : shape.data[index];
				if (!pixel && bold && x > 0) {
					const leftIndex = y * shape.width + (x - 1);
					pixel = shape.data[leftIndex];
				}

				if (!imageData.data[imageIndex + 3] && pixel) {
					imageData.data[imageIndex + 3] = 255;
				}
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);
	canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
};

const renderMapping: Map<
	HTMLCanvasElement,
	{ width: number; height: number; shapes: (Shape | undefined)[]; bold: boolean }
> = new Map();
const rendered: Set<HTMLCanvasElement> = new Set();
const visible: Set<HTMLCanvasElement> = new Set();
const renderObserver = browser
	? new IntersectionObserver((node) => {
			for (const entry of node) {
				const canvas = entry.target as HTMLCanvasElement;
				if (entry.isIntersecting) {
					const params = renderMapping.get(canvas);
					visible.add(canvas);
					if (params && !rendered.has(canvas)) {
						rendered.add(canvas);
						renderShapes(canvas, params.width, params.height, params.shapes, params.bold);
					}
				} else {
					visible.delete(canvas);
				}
			}
		})
	: undefined;

export const render: Action<
	HTMLCanvasElement,
	{ width: number; height: number; shapes: (Shape | undefined)[]; bold: boolean }
> = (
	node: HTMLCanvasElement,
	params: { width: number; height: number; shapes: (Shape | undefined)[]; bold: boolean }
) => {
	renderMapping.set(node, params);
	renderObserver?.observe(node);
	return {
		update(params) {
			renderMapping.set(node, params);
			if (visible.has(node)) {
				renderShapes(node, params.width, params.height, params.shapes, params.bold);
				rendered.add(node);
			} else {
				rendered.delete(node);
			}
		},
		destroy() {
			renderObserver?.unobserve(node);
			renderMapping.delete(node);
			rendered.delete(node);
			visible.delete(node);
		}
	};
};

export const checkFilter = (shape: Shape, project: Project, glyph: Glyph) => {
	const glyphShapes = glyph.shapes.map((shape) => {
		const shapeData = project.shapes[shape.name];
		if (!shapeData) return undefined;
		return {
			left: shape.offsetLeft + shapeData.left,
			top: shape.offsetTop + shapeData.top,
			width: shapeData.width,
			height: shapeData.height,
			data: shapeData.data
		};
	});

	const checkPixel = (x: number, y: number) => {
		for (const glyphShape of glyphShapes) {
			if (!glyphShape) continue;
			if (x < glyphShape.left || x >= glyphShape.left + glyphShape.width) continue;
			if (y < glyphShape.top || y >= glyphShape.top + glyphShape.height) continue;
			const pixel =
				glyphShape.data[(y - glyphShape.top) * glyphShape.width + (x - glyphShape.left)];
			if (pixel) return true;
		}
		return false;
	};

	for (let y = 0; y < shape.height; y++) {
		for (let x = 0; x < shape.width; x++) {
			const pixel = shape.data[y * shape.width + x];
			if (pixel === 0) continue;
			if (!checkPixel(x + shape.left, y + shape.top)) return false;
		}
	}

	return true;
};
