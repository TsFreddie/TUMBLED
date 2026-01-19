import { loadProject } from '$lib/server/loader.js';
import { error } from '@sveltejs/kit';
import { pack } from 'msgpackr';

export const GET = async ({ url }) => {
	const path = url.searchParams.get('path');
	if (!path) {
		return error(400, 'Bad Request');
	}

	const project = loadProject(path);

	return new Response(pack(project) as Buffer<ArrayBuffer>, {
		headers: {
			'Content-Type': 'application/octet-stream'
		}
	});
};
