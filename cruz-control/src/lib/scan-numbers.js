// Display positions within the complete project history, never a filtered list.
// UUIDs break saved-date ties deterministically; they remain the real identifiers.
// Later appended records preserve existing positions. Deletions/backdated inserts
// can change positions because these labels are derived, not stored identifiers.
export const scanNumbers = history => {
    const ordered = [...history].sort((a, b) => {
        const date = (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);
        return date || a.id.localeCompare(b.id);
    });
    return new Map(ordered.map((scan, index) => [scan.id, index + 1]));
};
