import { renameShape, saveShape, type Shape } from '$lib/server/loader.js';
import { text } from '@sveltejs/kit';
import { unpack } from 'msgpackr';

export const POST = async ({ request }) => {
	const formData = await request.formData();
	const data = formData.get('data') as File;
	const body = unpack(Buffer.from(await data.arrayBuffer())) as {
		projectPath: string;
		oldName: string;
		newName: string;
	};

	renameShape(body.projectPath, body.oldName, body.newName);
	return text('OK');
};
