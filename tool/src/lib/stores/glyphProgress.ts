/**
 * LocalStorage store for tracking user progress with glyphs
 * Stores data per project name to keep progress separate
 */

interface GlyphProgressData {
	lastClickedCodepoint: number | null;
	bookmarks: number[];
}

const STORAGE_PREFIX = 'glyph_progress_';

class GlyphProgressStore {
	private projectName: string | null = null;
	private data: GlyphProgressData = {
		lastClickedCodepoint: null,
		bookmarks: []
	};
	private listeners: Set<() => void> = new Set();

	/**
	 * Set the current project name and load its progress data
	 */
	setProjectName(name: string | null) {
		if (this.projectName === name) return;
		
		// Save current data before switching
		if (this.projectName) {
			this.save();
		}
		
		this.projectName = name;
		this.load();
		this.notify();
	}

	/**
	 * Get the current project name
	 */
	getProjectName(): string | null {
		return this.projectName;
	}

	/**
	 * Get storage key for current project
	 */
	private getStorageKey(): string {
		return `${STORAGE_PREFIX}${this.projectName || 'default'}`;
	}

	/**
	 * Load progress data from localStorage
	 */
	private load() {
		if (!this.projectName) {
			this.data = {
				lastClickedCodepoint: null,
				bookmarks: []
			};
			return;
		}

		try {
			const stored = localStorage.getItem(this.getStorageKey());
			if (stored) {
				this.data = JSON.parse(stored);
			} else {
				this.data = {
					lastClickedCodepoint: null,
					bookmarks: []
				};
			}
		} catch (error) {
			console.error('Failed to load glyph progress:', error);
			this.data = {
				lastClickedCodepoint: null,
				bookmarks: []
			};
		}
	}

	/**
	 * Save progress data to localStorage
	 */
	private save() {
		if (!this.projectName) return;

		try {
			localStorage.setItem(this.getStorageKey(), JSON.stringify(this.data));
		} catch (error) {
			console.error('Failed to save glyph progress:', error);
		}
	}

	/**
	 * Notify all listeners of data changes
	 */
	private notify() {
		this.listeners.forEach(listener => listener());
	}

	/**
	 * Subscribe to store changes
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Get the last clicked codepoint
	 */
	getLastClickedCodepoint(): number | null {
		return this.data.lastClickedCodepoint;
	}

	/**
	 * Set the last clicked codepoint
	 */
	setLastClickedCodepoint(codepoint: number | null) {
		this.data.lastClickedCodepoint = codepoint;
		this.save();
		this.notify();
	}

	/**
	 * Get all bookmarked codepoints
	 */
	getBookmarks(): number[] {
		return [...this.data.bookmarks];
	}

	/**
	 * Check if a codepoint is bookmarked
	 */
	isBookmarked(codepoint: number): boolean {
		return this.data.bookmarks.includes(codepoint);
	}

	/**
	 * Add a codepoint to bookmarks
	 */
	addBookmark(codepoint: number) {
		if (!this.data.bookmarks.includes(codepoint)) {
			this.data.bookmarks.push(codepoint);
			this.save();
			this.notify();
		}
	}

	/**
	 * Remove a codepoint from bookmarks
	 */
	removeBookmark(codepoint: number) {
		const index = this.data.bookmarks.indexOf(codepoint);
		if (index > -1) {
			this.data.bookmarks.splice(index, 1);
			this.save();
			this.notify();
		}
	}

	/**
	 * Toggle bookmark status for a codepoint
	 */
	toggleBookmark(codepoint: number) {
		if (this.isBookmarked(codepoint)) {
			this.removeBookmark(codepoint);
		} else {
			this.addBookmark(codepoint);
		}
	}

	/**
	 * Clear all bookmarks
	 */
	clearBookmarks() {
		this.data.bookmarks = [];
		this.save();
		this.notify();
	}

	/**
	 * Clear all progress data for current project
	 */
	clearAll() {
		this.data = {
			lastClickedCodepoint: null,
			bookmarks: []
		};
		this.save();
		this.notify();
	}

	/**
	 * Clear all progress data for a specific project
	 */
	clearProjectProgress(projectName: string) {
		try {
			localStorage.removeItem(`${STORAGE_PREFIX}${projectName}`);
		} catch (error) {
			console.error('Failed to clear project progress:', error);
		}
	}

	/**
	 * Clear all progress data for all projects
	 */
	clearAllProjects() {
		try {
			const keys = Object.keys(localStorage);
			keys.forEach(key => {
				if (key.startsWith(STORAGE_PREFIX)) {
					localStorage.removeItem(key);
				}
			});
		} catch (error) {
			console.error('Failed to clear all projects progress:', error);
		}
	}
}

// Create singleton instance
export const glyphProgressStore = new GlyphProgressStore();

// Export types
export type { GlyphProgressData };
