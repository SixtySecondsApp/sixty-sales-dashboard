import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedTableProps<T> {
  data: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  headers: React.ReactNode;
  className?: string;
  threshold?: number; // When to enable virtualization (default: 50 items)
}

function VirtualizedTableComponent<T>({ 
  data, 
  height, 
  itemHeight, 
  renderItem, 
  headers, 
  className = '',
  threshold = 50
}: VirtualizedTableProps<T>) {
  const [shouldVirtualize, setShouldVirtualize] = useState(false);

  // Determine if we should virtualize based on data size
  useEffect(() => {
    setShouldVirtualize(data.length > threshold);
  }, [data.length, threshold]);

  // Memoized item renderer for virtualized list
  const VirtualizedItem = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} className="border-b border-gray-800/50">
      {renderItem(data[index], index)}
    </div>
  ), [data, renderItem]);

  // Memoized regular list for small datasets
  const regularItems = useMemo(() => 
    data.map((item, index) => (
      <div key={index} className="border-b border-gray-800/50">
        {renderItem(item, index)}
      </div>
    ))
  , [data, renderItem]);

  if (!shouldVirtualize) {
    // Render normally for small datasets
    return (
      <div className={`bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden ${className}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            {headers}
            <tbody>
              {regularItems}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Virtualized rendering for large datasets
  return (
    <div className={`bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {headers}
        </table>
        <List
          height={height}
          itemCount={data.length}
          itemSize={itemHeight}
          width="100%"
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800"
        >
          {VirtualizedItem}
        </List>
      </div>
    </div>
  );
}

// Export memoized component for performance optimization
export const VirtualizedTable = React.memo(VirtualizedTableComponent) as <T>(
  props: VirtualizedTableProps<T>
) => React.ReactElement;

export default VirtualizedTable;