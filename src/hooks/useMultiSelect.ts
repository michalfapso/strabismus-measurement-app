import { useState, useCallback } from 'react';

/**
 * Hook to manage multi-select with Shift+Click and Ctrl+Click support
 *
 * Anchor behavior:
 * - Plain click: selects only that item, anchor moves to that item
 * - Ctrl+click: toggles that item, anchor moves to that item
 * - Shift+click: selects range from anchor to clicked item, anchor DOES NOT move
 * - Anchor resets to null when no selection
 */
export function useMultiSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const handleRowClick = useCallback(
    (
      id: string,
      ctrlKey: boolean,
      shiftKey: boolean,
      allVisibleIds?: string[]
    ) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && allVisibleIds && anchorId !== null) {
          // Shift+Click: select range from anchor to clicked item
          // Anchor DOES NOT move on shift+click
          const anchorIndex = allVisibleIds.indexOf(anchorId);
          const currentIndex = allVisibleIds.indexOf(id);

          if (anchorIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(anchorIndex, currentIndex);
            const end = Math.max(anchorIndex, currentIndex);

            for (let i = start; i <= end; i++) {
              next.add(allVisibleIds[i]);
            }
          }
        } else if (ctrlKey) {
          // Ctrl+Click: toggle individual item, anchor moves to this item
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          setAnchorId(id);
        } else {
          // Plain click: select only this item, anchor moves to this item
          next.clear();
          next.add(id);
          setAnchorId(id);
        }

        return next;
      });
    },
    [anchorId]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorId(null);
  }, []);

  const updateSelectionAfterFilter = useCallback(
    (visibleIds: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        // Remove any selected items not in visibleIds
        for (const id of next) {
          if (!visibleIds.includes(id)) {
            next.delete(id);
          }
        }

        return next;
      });

      // Reset anchor if it's filtered out
      setAnchorId((prev) => {
        if (prev !== null && !visibleIds.includes(prev)) {
          return null;
        }
        return prev;
      });
    },
    []
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const getSelectedArray = useCallback(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    anchorId,
    handleRowClick,
    clearSelection,
    updateSelectionAfterFilter,
    isSelected,
    getSelectedArray,
  };
}
