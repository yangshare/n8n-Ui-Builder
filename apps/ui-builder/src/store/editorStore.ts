import { create } from 'zustand';
import { ComponentSchema, ComponentType } from '../types/schema';
import { cloneDeep } from 'lodash';

interface EditorState {
  root: ComponentSchema;
  selectedId: string | null;
  
  // 运行态数据上下文
  storeData: Record<string, any>;

  // Actions
  selectComponent: (id: string | null) => void;
  addComponent: (parentId: string, type: ComponentType) => void;
  updateComponent: (id: string, updates: Partial<ComponentSchema>) => void;
  deleteComponent: (id: string) => void;
  
  // Data Actions
  setStoreData: (key: string, value: any) => void;

  // Root Action
  setRoot: (root: ComponentSchema) => void;
  
  // Structure Actions
  moveComponent: (id: string, direction: 'up' | 'down') => void;
  moveComponentTo: (dragId: string, targetId: string, index: number) => void;

  // Helpers
  getComponentById: (id: string) => ComponentSchema | null;
}

// 辅助函数：递归查找并修改
const findAndModify = (
  node: ComponentSchema, 
  targetId: string, 
  callback: (node: ComponentSchema, parent: ComponentSchema | null, index: number) => void,
  parent: ComponentSchema | null = null,
  index: number = 0
): boolean => {
  if (node.id === targetId) {
    callback(node, parent, index);
    return true;
  }
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      if (findAndModify(node.children[i], targetId, callback, node, i)) return true;
    }
  }
  return false;
};

// 辅助函数：递归查找
const findNode = (node: ComponentSchema, id: string): ComponentSchema | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
};

const initialRoot: ComponentSchema = {
  id: 'root',
  type: 'page',
  label: 'Page Root',
  props: {},
  children: [],
  style: { padding: '20px', minHeight: '100%' }
};

export const useEditorStore = create<EditorState>((set, get) => ({
  root: initialRoot,
  selectedId: null,
  
  // 初始测试数据
  storeData: {
    user: { name: 'John Doe', email: 'john@example.com' },
    app: { title: 'My Awesome App', version: '1.0.0' }
  },

  selectComponent: (id) => set({ selectedId: id }),

  getComponentById: (id) => findNode(get().root, id),

  setRoot: (root) => set({ root }),

  addComponent: (parentId, type) => set((state) => {
    const newRoot = cloneDeep(state.root);
    const newComponent: ComponentSchema = {
      id: `${type}_${Date.now()}`,
      type,
      label: type,
      props: {},
      children: type === 'container' || type === 'row' || type === 'column' ? [] : undefined,
      style: type === 'row' ? { display: 'flex', gap: '10px' } : {}
    };

    // 如果是添加到 root，或者找到了 parent
    if (parentId === 'root') {
      newRoot.children = [...(newRoot.children || []), newComponent];
    } else {
      findAndModify(newRoot, parentId, (node) => {
        if (!node.children) node.children = [];
        node.children.push(newComponent);
      });
    }
    
    return { root: newRoot, selectedId: newComponent.id };
  }),

  updateComponent: (id, updates) => set((state) => {
    const newRoot = cloneDeep(state.root);
    findAndModify(newRoot, id, (node) => {
      Object.assign(node, updates);
    });
    return { root: newRoot };
  }),

  deleteComponent: (id) => set((state) => {
    if (id === 'root') return state;
    const newRoot = cloneDeep(state.root);
    findAndModify(newRoot, id, (_node, parent, index) => {
      if (parent && parent.children) {
        parent.children.splice(index, 1);
      }
    });
    return { root: newRoot, selectedId: null };
  }),

  setStoreData: (key, value) => set((state) => ({
    storeData: { ...state.storeData, [key]: value }
  })),

  moveComponent: (id, direction) => set((state) => {
    if (id === 'root') return state;
    const newRoot = cloneDeep(state.root);
    findAndModify(newRoot, id, (_node, parent, index) => {
      if (parent && parent.children) {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex >= 0 && newIndex < parent.children.length) {
          // Swap
          const temp = parent.children[index];
          parent.children[index] = parent.children[newIndex];
          parent.children[newIndex] = temp;
        }
      }
    });
    return { root: newRoot };
  }),

  moveComponentTo: (dragId, targetId, index) => set((state) => {
    if (dragId === 'root') return state;
    if (dragId === targetId) return state;

    const newRoot = cloneDeep(state.root);
    let draggedNode: ComponentSchema | null = null;

    // 1. Find and Remove
    const removeNode = (node: ComponentSchema): boolean => {
      if (node.children) {
        const idx = node.children.findIndex(c => c.id === dragId);
        if (idx !== -1) {
          draggedNode = node.children[idx];
          node.children.splice(idx, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeNode(child)) return true;
        }
      }
      return false;
    };

    // If not found in root's children (and root isn't the parent of root), start search
    // Note: removeNode needs to start from root
    if (!removeNode(newRoot)) {
      return state; // Node not found
    }

    // 2. Insert
    const insertNode = (node: ComponentSchema): boolean => {
      if (node.id === targetId) {
        if (!node.children) node.children = [];
        // Ensure index is within bounds
        const safeIndex = Math.min(Math.max(index, 0), node.children.length);
        if (draggedNode) {
           node.children.splice(safeIndex, 0, draggedNode);
        }
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (insertNode(child)) return true;
        }
      }
      return false;
    };

    if (draggedNode && !insertNode(newRoot)) {
      // If target not found (e.g. we moved parent into child), return original state
      return state;
    }

    return { root: newRoot };
  })
}));
