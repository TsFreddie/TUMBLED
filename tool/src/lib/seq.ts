import seq from './seq.txt?raw';

const addUnique = <T>(arr: T[], item: T) => {
	if (!arr.includes(item)) arr.push(item);
};

const segmentor = new Intl.Segmenter('zh', { granularity: 'grapheme' });

// IDC sequence database
export const SEQS = Object.fromEntries(
	seq
		.split('\n')
		.map((line) => {
			const [char, ...seqs] = line.split('\t');
			const possibleParts: string[] = [];

			for (const part of seqs) {
				if (part.startsWith('⿰')) {
					const [left, right] = Array.from(segmentor.segment(part.slice(1))).map(
						(seg) => seg.segment
					);
					addUnique(possibleParts, left + '<');
					addUnique(possibleParts, right + '>');
				} else if (part.startsWith('⿱')) {
					const [top, bottom] = Array.from(segmentor.segment(part.slice(1))).map(
						(seg) => seg.segment
					);
					addUnique(possibleParts, top + '^');
					addUnique(possibleParts, bottom + 'v');
				}
			}
			return [char.codePointAt(0)!, possibleParts] as [number, string[]];
		})
		.filter((s) => s[1].length > 0)
);
