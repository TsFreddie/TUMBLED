import { deleteGlyph, saveGlyph, type Glyph } from '$lib/server/loader.js';
import { text } from '@sveltejs/kit';
import { unpack } from 'msgpackr';

export const POST = async ({ request }) => {
	const formData = await request.formData();
	const data = formData.get('data') as File;
	const body = unpack(Buffer.from(await data.arrayBuffer())) as {
		filePath: string;
		glyph: Glyph;
	};

	if (body.glyph.shapes.length === 0) {
		deleteGlyph(body.filePath);
		return text('OK');
	}

	saveGlyph(body.filePath, body.glyph);
	return text('OK');
};
