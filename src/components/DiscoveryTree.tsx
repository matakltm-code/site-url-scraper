import { motion } from 'motion/react';
import { ChevronRight, ChevronDown, CheckSquare, Square, Folder, File, Globe, Search, X } from 'lucide-react';
import { useState, MouseEvent, useMemo } from 'react';
import { TreeNode } from '../types';

interface DiscoveryTreeProps {
  tree: TreeNode;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, childrenIds: string[]) => void;
}

function getDescendantIds(node: TreeNode): string[] {
  let ids: string[] = [node.id];
  if (node.children) {
    node.children.forEach(child => {
      ids = ids.concat(getDescendantIds(child));
    });
  }
  return ids;
}

function filterTreeNode(node: TreeNode, query: string): TreeNode | null {
  if (!query) return node;
  const q = query.toLowerCase();
  const matchesSelf = node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q);

  let filteredChildren: TreeNode[] = [];
  if (node.children) {
    filteredChildren = node.children
      .map(child => filterTreeNode(child, query))
      .filter((child): child is TreeNode => child !== null);
  }

  if (matchesSelf || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren.length > 0 ? filteredChildren : node.children
    };
  }

  return null;
}

function TreeNodeItem({ 
  node, 
  depth = 0, 
  selectedIds, 
  onToggleSelect,
  filterQuery = ''
}: { 
  node: TreeNode; 
  depth?: number;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, childrenIds: string[]) => void;
  filterQuery?: string;
  key?: string | number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  const descendantIds = getDescendantIds(node);
  const allSelected = descendantIds.every(id => selectedIds.has(id));
  const someSelected = descendantIds.some(id => selectedIds.has(id));
  const isIndeterminate = someSelected && !allSelected;

  const handleToggle = () => setIsExpanded(!isExpanded);
  
  const handleSelect = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(node.id, descendantIds);
  };

  const shouldExpand = filterQuery.trim().length > 0 || isExpanded;

  return (
    <div className="w-full">
      <div 
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100/50 rounded-md cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        onClick={handleToggle}
      >
        <button 
          onClick={handleSelect}
          className="text-gray-400 hover:text-emerald-500 transition-colors flex-shrink-0"
        >
          {allSelected ? (
            <CheckSquare size={16} className="text-emerald-500" />
          ) : isIndeterminate ? (
            <div className="relative w-4 h-4 rounded border border-emerald-500 bg-emerald-50 flex items-center justify-center">
              <div className="w-2 h-0.5 bg-emerald-500 rounded-sm" />
            </div>
          ) : (
            <Square size={16} />
          )}
        </button>

        <div className="flex items-center gap-1.5 text-gray-700 min-w-0">
          {hasChildren ? (
            shouldExpand ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          
          {node.type === 'domain' && <Globe size={14} className="text-blue-500 flex-shrink-0" />}
          {node.type === 'folder' && <Folder size={14} className="text-amber-500 flex-shrink-0" />}
          {node.type === 'page' && <File size={14} className="text-gray-400 flex-shrink-0" />}
          
          <span className="text-sm font-medium truncate">{node.label}</span>
        </div>
      </div>

      {shouldExpand && hasChildren && (
        <div className="flex flex-col">
          {node.children!.map((child) => (
            <TreeNodeItem 
              key={child.id} 
              node={child} 
              depth={depth + 1} 
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              filterQuery={filterQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiscoveryTree({ tree, selectedIds, onToggleSelect }: DiscoveryTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTree = useMemo(() => {
    return filterTreeNode(tree, searchQuery) || tree;
  }, [tree, searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col"
    >
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Discovered Resources</h3>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">
            {selectedIds.size} selected
          </span>
        </div>
      </div>
      
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <TreeNodeItem 
          node={filteredTree} 
          selectedIds={selectedIds} 
          onToggleSelect={onToggleSelect} 
          filterQuery={searchQuery}
        />
      </div>
    </motion.div>
  );
}
