// glyph loader
import fs from 'fs';
import path from 'path';

export interface Shape {
	top: number;
	left: number;
	width: number;
	height: number;
	data: Uint8Array;
}

export interface ShapeLookup {
	name: string;
	offsetTop: number;
	offsetLeft: number;
}

export interface Glyph {
	codepoint: number;
	variant?: string;
	advance: number;
	shapes: ShapeLookup[];
}

export interface Project {
	name: string;
	height: number;
	shapes: Record<string, Shape>;
	glyphs: Glyph[];
}

export const loadShape = (filePath: string): Shape => {
	const data = fs.readFileSync(filePath);
	const lines = data.toString().split('\n');
	const [top, left] = lines[0].split(' ').map(Number);
	const shapeData = lines.slice(1);
	const width = Math.max(0, ...shapeData.map((line) => line.length));
	const height = shapeData.length;
	const buffer = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			buffer[y * width + x] = shapeData[y][x] === '#' ? 1 : 0;
		}
	}
	const shape: Shape = {
		top,
		left,
		width,
		height,
		data: buffer
	};
	return shape;
};

export const saveShape = (filePath: string, shape: Shape) => {
	const lines = [`${shape.top} ${shape.left}`];
	for (let y = 0; y < shape.height; y++) {
		let line = '';
		for (let x = 0; x < shape.width; x++) {
			line += shape.data[y * shape.width + x] === 1 ? '#' : ' ';
		}
		lines.push(line.trimEnd());
	}
	fs.writeFileSync(filePath, lines.join('\n'));
};

export const loadGlyph = (filePath: string): Glyph => {
	const data = fs.readFileSync(filePath, 'utf-8').split('\n');
	const fileName = path.basename(filePath, '.txt');
	const [code, variant] = fileName.split('-');
	const codepoint = parseInt(code);

	if (isNaN(codepoint)) {
		throw new Error(`Invalid glyph file name: ${fileName}`);
	}

	const advance = parseInt(data[0]);
	const lines = data.slice(1);

	const shapes = lines.map((line) => {
		const [offsetTop, offsetLeft, name] = line.split(' ');
		return {
			name,
			offsetTop: parseInt(offsetTop),
			offsetLeft: parseInt(offsetLeft)
		};
	});

	return { codepoint, variant, advance, shapes };
};

export const deleteGlyph = (filePath: string) => {
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

export const saveGlyph = (filePath: string, glyph: Glyph) => {
	const lines = [`${glyph.advance}`];
	for (const shape of glyph.shapes) {
		lines.push(`${shape.offsetTop} ${shape.offsetLeft} ${shape.name}`);
	}
	fs.writeFileSync(filePath, lines.join('\n'));
};

export const loadProject = (filePath: string): Project => {
	const fontFile = JSON.parse(fs.readFileSync(`${filePath}/font.json`, 'utf-8'));
	const { name, height } = fontFile;

	const shapeFiles = fs.readdirSync(`${filePath}/shapes`);
	const shapes = Object.fromEntries(
		shapeFiles.map((file) => {
			const shape = loadShape(`${filePath}/shapes/${file}`);
			const name = path.basename(file, '.txt');
			return [name, shape];
		})
	);

	const glyphFiles = fs.readdirSync(`${filePath}/glyphs`);
	const glyphs = glyphFiles.sort().map((file) => {
		const glyph = loadGlyph(`${filePath}/glyphs/${file}`);
		return glyph;
	});

	const project: Project = {
		name,
		height,
		glyphs,
		shapes
	};

	return project;
};
