import { useState, useCallback } from 'react';

/**
 * Hook to manage multi-select with Shift+Click and Ctrl+Click support
 */
export function useMultiSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const handleRowClick = useCallback(
    (
      id: string,
      ctrlKey: boolean,
      shiftKey: boolean,
      allItems?: string[]
    ) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && allItems && lastClickedIndex !== null) {
          // Shift+Click: select range from last clicked to current
          const currentIndex = allItems.indexOf(id);
          const start = Math.min(lastClickedIndex, currentIndex);
          const end = Math.max(lastClickedIndex, currentIndex);

          for (let i = start; i <= end; i++) {
            next.add(allItems[i]);
          }
        } else if (ctrlKey) {
          // Ctrl+Click: toggle individual item
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        } else {
          // Regular click: select only this item
          next.clear();
          next.add(id);
        }

        return next;
      });

      // Track last clicked index
      if (allItems) {
        setLastClickedIndex(allItems.indexOf(id));
      }
    },
    [lastClickedIndex]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  }, []);

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
    handleRowClick,
    clearSelection,
    isSelected,
    getSelectedArray,
  };
}
