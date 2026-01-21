import seq from './seq.txt?raw';

const addUnique = <T>(arr: T[], item: T) => {
	if (!arr.includes(item)) arr.push(item);
};

function isAlphaNum(char: string) {
	if (char.length !== 1) {
		return false;
	}
	const codePoint = char.codePointAt(0);

	if (!codePoint) {
		return false;
	}

	// Check for numeric (0-9)
	if (codePoint >= 48 && codePoint <= 57) {
		return true;
	}
	// Check for upper alpha (A-Z)
	if (codePoint >= 65 && codePoint <= 90) {
		return true;
	}
	// Check for lower alpha (a-z)
	if (codePoint >= 97 && codePoint <= 122) {
		return true;
	}
	return false;
}

const segmentor = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const process = (part: string) => {
	const chars = Array.from(segmentor.segment(part.slice(1))).map((seg) => seg.segment);

	const result = [];
	let current = '';

	for (const char of chars) {
		if (isAlphaNum(char)) {
			current += char;
		} else {
			if (current) {
				result.push(current);
				current = '';
			}
			current += char;
		}
	}

	if (current) {
		result.push(current);
	}

	return result;
};

// IDC sequence database
export const SEQS = Object.fromEntries(
	seq
		.split('\n')
		.map((line) => {
			const [char, ...seqs] = line.split('\t');
			const possibleParts: string[] = [];

			for (const part of seqs) {
				if (part.startsWith('⿰')) {
					const [left, right] = process(part);
					addUnique(possibleParts, left + '<');
					addUnique(possibleParts, right + '>');
				} else if (part.startsWith('⿱')) {
					const [top, bottom] = process(part);
					addUnique(possibleParts, top + '^');
					addUnique(possibleParts, bottom + 'v');
				} else if (
					part.startsWith('⿸') ||
					part.startsWith('⿹') ||
					part.startsWith('⿺') ||
					part.startsWith('⿴')
				) {
					const [outside, inside] = process(part);
					addUnique(possibleParts, outside + 'o');
					addUnique(possibleParts, inside + 'i');
				}
			}
			return [char.codePointAt(0)!, possibleParts] as [number, string[]];
		})
		.filter((s) => s[1].length > 0)
);
