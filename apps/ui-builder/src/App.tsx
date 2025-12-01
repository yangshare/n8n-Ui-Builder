import React, { useState } from 'react';
import { RecursiveRenderer } from './components/renderer/RecursiveRenderer';
import { useEditorStore } from './store/editorStore';
import { Settings, Plus, Trash2, Layers, Box, Type, MousePointerClick, Layout, MonitorPlay, Database, Zap, Play, X, Download, Upload, Table, List, ArrowUp, ArrowDown, Palette, Image as ImageIcon } from 'lucide-react';
import { ComponentType, Action, ActionType, ComponentSchema } from './types/schema';
import { DndContext, DragEndEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const generateId = () => Math.random().toString(36).substring(2, 9);

const findParent = (root: ComponentSchema, id: string): ComponentSchema | null => {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === id) return root;
      const found = findParent(child, id);
      if (found) return found;
    }
  }
  return null;
};

function App() {
  const { root, selectedId, addComponent, updateComponent, deleteComponent, moveComponent, moveComponentTo, getComponentById, storeData, setStoreData, setRoot } = useEditorStore();
  const [isPreview, setIsPreview] = useState(false);
  const [showState, setShowState] = useState(false); // 状态调试面板开关
  const [activePropTab, setActivePropTab] = useState<'props' | 'events' | 'styles'>('props');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedComponent = selectedId ? getComponentById(selectedId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    const activeParent = findParent(root, activeId);
    const overParent = findParent(root, overId);

    // 1. Sibling Reorder (Priority)
    if (activeParent && overParent && activeParent.id === overParent.id) {
        const oldIndex = activeParent.children?.findIndex(c => c.id === activeId);
        const newIndex = overParent.children?.findIndex(c => c.id === overId);
        
        if (oldIndex !== undefined && newIndex !== undefined) {
            moveComponentTo(activeId, activeParent.id, newIndex); 
        }
        return;
    }

    // 2. Drop into Root
    if (overId === 'root') {
         moveComponentTo(activeId, 'root', root.children?.length || 0);
         return;
    }

    // 3. Cross-level Drop
    const overComponent = getComponentById(overId);
    
    // If dropping ONTO a container (that is NOT a sibling, handled above)
    if (overComponent && ['page', 'container', 'row', 'column'].includes(overComponent.type)) {
         // Append to end of container
         moveComponentTo(activeId, overId, overComponent.children?.length || 0);
    } else {
        // Dropping onto a leaf node -> insert adjacent
        if (overParent) {
            const index = overParent.children?.findIndex((c: any) => c.id === overId);
            if (index !== undefined && index !== -1) {
                moveComponentTo(activeId, overParent.id, index);
            }
        }
    }
  };

  // 添加组件逻辑
  const handleAddComponent = (type: ComponentType) => {
    let targetId = 'root';
    if (selectedComponent) {
      if (['page', 'container', 'row', 'column'].includes(selectedComponent.type)) {
        targetId = selectedComponent.id;
      } else {
        alert('Please select a container (Root, Row, Column) to add components inside.');
        return;
      }
    }
    addComponent(targetId, type);
  };

  const handleAddAction = (eventName: string, type: ActionType) => {
    if (!selectedComponent) return;
    const currentActions = selectedComponent.events?.[eventName] || [];
    const newAction: Action = {
      id: generateId(),
      type,
      config: type === 'n8n-webhook' ? { url: 'https://your-n8n-instance.com/webhook/...', method: 'POST' } : 
              type === 'setState' ? { key: 'key', value: 'value' } :
              type === 'consoleLog' ? { message: 'Hello World' } : 
              { message: 'Alert Message' }
    };
    
    updateComponent(selectedComponent.id, {
      events: {
        ...selectedComponent.events,
        [eventName]: [...currentActions, newAction]
      }
    });
  };

  const updateActionConfig = (eventName: string, actionId: string, newConfig: any) => {
    if (!selectedComponent) return;
    const currentActions = selectedComponent.events?.[eventName] || [];
    const newActions = currentActions.map(a => a.id === actionId ? { ...a, config: { ...a.config, ...newConfig } } : a);
    
    updateComponent(selectedComponent.id, {
      events: {
        ...selectedComponent.events,
        [eventName]: newActions
      }
    });
  };

  const removeAction = (eventName: string, actionId: string) => {
    if (!selectedComponent) return;
    const currentActions = selectedComponent.events?.[eventName] || [];
    const newActions = currentActions.filter(a => a.id !== actionId);
    
    updateComponent(selectedComponent.id, {
      events: {
        ...selectedComponent.events,
        [eventName]: newActions
      }
    });
  };

  const handleSave = () => {
    const data = JSON.stringify({ version: '1.0', root }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ui-schema.json';
    a.click();
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.root) {
          setRoot(json.root);
        } else {
          alert('Invalid schema file');
        }
      } catch (err) {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-sans text-sm">
      
      {/* Left Sidebar - Component Library */}
      <div className={`w-64 bg-white border-r border-gray-200 flex flex-col transition-all ${isPreview ? '-ml-64' : ''}`}>
        <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-2">
          <Box className="text-blue-600" size={20} />
          <span className="font-bold text-gray-800">Components</span>
        </div>
        
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          
          {/* Layout Section */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Layout</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleAddComponent('container')} className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg transition-all group">
                <Layout size={20} className="text-gray-600 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">Container</span>
              </button>
              <button onClick={() => handleAddComponent('row')} className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg transition-all group">
                <Layers size={20} className="text-gray-600 group-hover:text-blue-600 mb-2" />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">Row</span>
              </button>
            </div>
          </div>

          {/* Basic Section */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Basic</p>
            <div className="space-y-2">
              <button onClick={() => handleAddComponent('input')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <Type size={16} className="text-gray-500" />
                <span className="text-gray-700">Text Input</span>
              </button>
              <button onClick={() => handleAddComponent('button')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <MousePointerClick size={16} className="text-gray-500" />
                <span className="text-gray-700">Button</span>
              </button>
              <button onClick={() => handleAddComponent('text')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <Type size={16} className="text-gray-500" />
                <span className="text-gray-700">Text Block</span>
              </button>
              <button onClick={() => handleAddComponent('image')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <ImageIcon size={16} className="text-gray-500" />
                <span className="text-gray-700">Image</span>
              </button>
              <button onClick={() => handleAddComponent('table')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <Table size={16} className="text-gray-500" />
                <span className="text-gray-700">Data Table</span>
              </button>
              <button onClick={() => handleAddComponent('select')} className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left">
                <List size={16} className="text-gray-500" />
                <span className="text-gray-700">Select Input</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-gray-800 text-lg">Page 1</h1>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
               <button onClick={handleSave} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Save Schema">
                  <Download size={18} />
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Load Schema">
                  <Upload size={18} />
               </button>
               <input type="file" ref={fileInputRef} onChange={handleLoad} className="hidden" accept=".json" />
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
               <span>Selected: {selectedComponent ? `${selectedComponent.label} (${selectedComponent.id})` : 'None'}</span>
               {selectedComponent && selectedComponent.id !== 'root' && (
                 <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => moveComponent(selectedComponent.id, 'up')} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Move Up">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => moveComponent(selectedComponent.id, 'down')} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="Move Down">
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => deleteComponent(selectedComponent.id)} className="p-1 hover:bg-red-100 rounded text-red-500 ml-1" title="Delete">
                      <Trash2 size={14} />
                    </button>
                 </div>
               )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowState(!showState)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${showState ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Data State Debugger"
            >
              <Database size={16} className="text-gray-600" />
            </button>

            <button 
              onClick={() => setIsPreview(!isPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${isPreview ? 'bg-blue-100 text-blue-700' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
            >
              <MonitorPlay size={16} />
              {isPreview ? 'Exit Preview' : 'Preview'}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden flex relative">
          <div className="flex-1 overflow-y-auto p-8 bg-gray-100" onClick={() => !isPreview && useEditorStore.getState().selectComponent(null)}>
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <div className="max-w-4xl mx-auto bg-white min-h-[800px] shadow-lg rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <RecursiveRenderer schema={root} isEditor={!isPreview} />
              </div>
            </DndContext>
          </div>

          {/* Data State Panel (Floating) */}
          {showState && (
            <div className="w-80 bg-gray-900 text-white border-l border-gray-700 flex flex-col shadow-2xl absolute right-0 top-0 bottom-0 z-50 opacity-95">
              <div className="h-14 border-b border-gray-700 flex items-center px-4 justify-between bg-gray-800">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-green-400" />
                  <span className="font-bold">Global State (Runtime)</span>
                </div>
                <button onClick={() => setShowState(false)} className="text-gray-400 hover:text-white">×</button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto font-mono text-xs">
                <p className="text-gray-400 mb-2">// You can reference these values using {'{{ key }}'}</p>
                <textarea 
                  className="w-full h-[500px] bg-gray-950 text-green-400 p-3 rounded border border-gray-700 focus:outline-none focus:border-green-500 resize-none"
                  value={JSON.stringify(storeData, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      // 批量更新 storeData (这里简化处理，实际上应该替换整个对象)
                      // 为了演示，我们需要在 store 中增加一个 replaceStoreData 方法，或者循环 set
                      // 暂时我们只允许修改现有 key 的第一层，或者你需要更完善的 JSON 编辑器
                      // 这里简单起见，我们假设用户输入的是合法的，并尝试合并
                      Object.keys(parsed).forEach(key => setStoreData(key, parsed[key]));
                    } catch (err) {
                      // Ignore JSON parse errors while typing
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      {!isPreview && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <div className="h-14 border-b border-gray-200 flex items-center justify-between px-2 bg-gray-50">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setActivePropTab('props')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activePropTab === 'props' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                <Settings size={14} /> Properties
              </button>
              <button 
                onClick={() => setActivePropTab('styles')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activePropTab === 'styles' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                <Palette size={14} /> Styles
              </button>
              <button 
                onClick={() => setActivePropTab('events')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activePropTab === 'events' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                <Zap size={14} /> Events
              </button>
            </div>
          </div>
          
          {selectedComponent ? (
            activePropTab === 'props' ? (
              <div className="p-5 space-y-6">
                
                {/* Common Props */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">ID</label>
                    <input type="text" value={selectedComponent.id} disabled className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded text-gray-500 text-xs font-mono" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Label</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={selectedComponent.label || ''} 
                        onChange={(e) => updateComponent(selectedComponent.id, { label: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-8" 
                      />
                      <span className="absolute right-2 top-2 text-gray-400 text-xs font-mono pointer-events-none">{'{{ }}'}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Supports expressions e.g. {'{{ user.name }}'}</p>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Specific Props */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-gray-900">Component Settings</p>
                  
                  {selectedComponent.type === 'input' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                      <input 
                        type="text" 
                        value={selectedComponent.props.placeholder || ''}
                        onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, placeholder: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                    </div>
                  )}

                  {selectedComponent.type === 'text' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Content</label>
                      <textarea 
                        value={selectedComponent.props.content || ''}
                        onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, content: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded h-24 font-mono text-xs"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Try: Hello {'{{ user.name }}'}</p>
                    </div>
                  )}

                  {selectedComponent.type === 'image' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Image URL</label>
                      <input 
                        type="text" 
                        value={selectedComponent.props.src || ''}
                        onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, src: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
                        placeholder="https://..."
                      />
                      <label className="block text-xs text-gray-500 mb-1">Alt Text</label>
                      <input 
                        type="text" 
                        value={selectedComponent.props.alt || ''}
                        onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, alt: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                    </div>
                  )}

                  {selectedComponent.type === 'table' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Data Source</label>
                        <input 
                          type="text" 
                          value={selectedComponent.props.data || ''}
                          onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, data: e.target.value } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs"
                          placeholder="{{ users }}"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Expression evaluating to array</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Columns (JSON)</label>
                        <textarea 
                          value={typeof selectedComponent.props.columns === 'string' ? selectedComponent.props.columns : JSON.stringify(selectedComponent.props.columns, null, 2)}
                          onChange={(e) => {
                            try {
                               const val = JSON.parse(e.target.value);
                               updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, columns: val } });
                            } catch(err) {
                               // Allow typing invalid json, store as string temporarily or handle better
                               // For now, we might need a better approach, but let's just update if valid, or maybe just store as object if possible
                               // Let's assume user pastes valid JSON.
                               // Actually, to allow editing, we should probably store the string in a local state or just let it fail silently?
                               // Let's just try to parse, if fail, don't update props? No, then user can't type.
                               // Better: Input is not controlled by props directly in a way that blocks typing.
                               // But here it is controlled.
                               // Let's just use a helper to handle JSON input?
                               // Simplified: Just update props with the value (even if string), Renderer handles it?
                               // Renderer expects array.
                               // Let's just use the try-catch. If valid, update. If not, maybe we can't update the visual table but we can update the text?
                               // Problem: If we only update on valid JSON, user can't type "{"...
                               
                               // Hack for MVP: Treat it as a string property in schema, and parse in Renderer? 
                               // No, Renderer expects array.
                               // Let's use a controlled local state? No, too complex for this file.
                               // Let's just allow it to be string in props, and Renderer handles string parsing too?
                               updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, columns: e.target.value } });
                            }
                          }}
                          onBlur={(e) => {
                             try {
                               const val = JSON.parse(e.target.value);
                               updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, columns: val } });
                             } catch (e) { /* ignore */ }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded h-32 font-mono text-xs"
                          placeholder='[{"key": "name", "title": "Name"}]'
                        />
                      </div>
                    </div>
                  )}

                  {selectedComponent.type === 'select' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Options (JSON)</label>
                         <textarea 
                          value={typeof selectedComponent.props.options === 'string' ? selectedComponent.props.options : JSON.stringify(selectedComponent.props.options, null, 2)}
                          onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, options: e.target.value } })}
                          onBlur={(e) => {
                             try {
                               const val = JSON.parse(e.target.value);
                               updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, options: val } });
                             } catch (e) { /* ignore */ }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded h-32 font-mono text-xs"
                          placeholder='[{"label": "Option A", "value": "a"}]'
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Value</label>
                        <input 
                          type="text" 
                          value={selectedComponent.props.value || ''}
                          onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, value: e.target.value } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                          placeholder="{{ user.role }}"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedComponent.type === 'row' || selectedComponent.type === 'column' || selectedComponent.type === 'container') && (
                     <div className="p-3 bg-blue-50 rounded border border-blue-100 text-blue-800 text-xs">
                        This is a layout container. Add items inside by selecting it first.
                     </div>
                  )}
                </div>

                <hr className="border-gray-100" />

                {/* Actions */}
                <button 
                  onClick={() => deleteComponent(selectedComponent.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors text-sm font-medium border border-red-200"
                >
                  <Trash2 size={16} />
                  Delete Component
                </button>

              </div>
            ) : activePropTab === 'styles' ? (
              <div className="p-5 space-y-6">
                <p className="text-xs font-bold text-gray-900">Visual Styles</p>
                
                {/* Layout */}
                <div className="space-y-3">
                   <p className="text-xs font-semibold text-gray-500 uppercase">Layout</p>
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="block text-xs text-gray-500 mb-1">Width</label>
                         <input type="text" value={selectedComponent.style?.width || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, width: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded" placeholder="auto" />
                      </div>
                      <div>
                         <label className="block text-xs text-gray-500 mb-1">Height</label>
                         <input type="text" value={selectedComponent.style?.height || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, height: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded" placeholder="auto" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="block text-xs text-gray-500 mb-1">Padding</label>
                         <input type="text" value={selectedComponent.style?.padding || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, padding: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded" placeholder="0px" />
                      </div>
                      <div>
                         <label className="block text-xs text-gray-500 mb-1">Margin</label>
                         <input type="text" value={selectedComponent.style?.margin || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, margin: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded" placeholder="0px" />
                      </div>
                   </div>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                   <p className="text-xs font-semibold text-gray-500 uppercase">Colors</p>
                   <div>
                      <label className="block text-xs text-gray-500 mb-1">Background</label>
                      <div className="flex gap-2">
                         <input type="color" value={selectedComponent.style?.backgroundColor || '#ffffff'} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, backgroundColor: e.target.value } })} className="w-8 h-8 border rounded cursor-pointer" />
                         <input type="text" value={selectedComponent.style?.backgroundColor || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, backgroundColor: e.target.value } })} className="flex-1 px-2 py-1 text-xs border rounded" placeholder="#ffffff" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-xs text-gray-500 mb-1">Text Color</label>
                      <div className="flex gap-2">
                         <input type="color" value={selectedComponent.style?.color || '#000000'} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, color: e.target.value } })} className="w-8 h-8 border rounded cursor-pointer" />
                         <input type="text" value={selectedComponent.style?.color || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, color: e.target.value } })} className="flex-1 px-2 py-1 text-xs border rounded" placeholder="inherit" />
                      </div>
                   </div>
                </div>

                {/* Flexbox (Only for containers) */}
                {['row', 'column', 'container', 'page'].includes(selectedComponent.type) && (
                    <div className="space-y-3">
                       <p className="text-xs font-semibold text-gray-500 uppercase">Flexbox</p>
                       <div>
                          <label className="block text-xs text-gray-500 mb-1">Direction</label>
                          <select value={selectedComponent.style?.flexDirection || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, flexDirection: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded">
                             <option value="">Default</option>
                             <option value="row">Row</option>
                             <option value="column">Column</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-xs text-gray-500 mb-1">Justify Content</label>
                          <select value={selectedComponent.style?.justifyContent || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, justifyContent: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded">
                             <option value="">Start</option>
                             <option value="center">Center</option>
                             <option value="space-between">Space Between</option>
                             <option value="flex-end">End</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-xs text-gray-500 mb-1">Align Items</label>
                          <select value={selectedComponent.style?.alignItems || ''} onChange={(e) => updateComponent(selectedComponent.id, { style: { ...selectedComponent.style, alignItems: e.target.value } })} className="w-full px-2 py-1 text-xs border rounded">
                             <option value="">Stretch</option>
                             <option value="center">Center</option>
                             <option value="flex-start">Start</option>
                             <option value="flex-end">End</option>
                          </select>
                       </div>
                    </div>
                )}
              </div>
            ) : (
              <div className="p-5 space-y-8">
                 {/* Events Tab Content */}
                 {['onClick', 'onChange'].map(eventName => {
                    if (eventName === 'onChange' && selectedComponent.type !== 'input') return null;
                    
                    return (
                      <div key={eventName} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <span className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <MousePointerClick size={12} /> {eventName}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => handleAddAction(eventName, 'setState')} className="p-1 hover:bg-blue-50 text-blue-600 rounded" title="Set State"><Database size={14}/></button>
                            <button onClick={() => handleAddAction(eventName, 'n8n-webhook')} className="p-1 hover:bg-green-50 text-green-600 rounded" title="n8n Webhook"><Zap size={14}/></button>
                            <button onClick={() => handleAddAction(eventName, 'alert')} className="p-1 hover:bg-orange-50 text-orange-600 rounded" title="Alert"><Type size={14}/></button>
                            <button onClick={() => handleAddAction(eventName, 'consoleLog')} className="p-1 hover:bg-gray-100 text-gray-600 rounded" title="Log"><MonitorPlay size={14}/></button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(selectedComponent.events?.[eventName] || []).length === 0 && (
                            <p className="text-xs text-gray-400 italic text-center py-2">No actions configured.</p>
                          )}
                          
                          {(selectedComponent.events?.[eventName] || []).map((action) => (
                            <div key={action.id} className="bg-gray-50 border border-gray-200 rounded-md p-3 relative group">
                              <button 
                                onClick={() => removeAction(eventName, action.id)}
                                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                              
                              <div className="mb-2 flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  action.type === 'n8n-webhook' ? 'bg-green-100 text-green-700' :
                                  action.type === 'setState' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-200 text-gray-700'
                                }`}>{action.type}</span>
                              </div>

                              <div className="space-y-2">
                                {action.type === 'setState' && (
                                  <>
                                    <input 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                      placeholder="Key (e.g. user.name)"
                                      value={action.config.key || ''}
                                      onChange={(e) => updateActionConfig(eventName, action.id, { key: e.target.value })}
                                    />
                                    <input 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                      placeholder="Value (e.g. {{ event.value }})"
                                      value={action.config.value || ''}
                                      onChange={(e) => updateActionConfig(eventName, action.id, { value: e.target.value })}
                                    />
                                  </>
                                )}

                                {action.type === 'n8n-webhook' && (
                                  <>
                                    <input 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                      placeholder="Webhook URL"
                                      value={action.config.url || ''}
                                      onChange={(e) => updateActionConfig(eventName, action.id, { url: e.target.value })}
                                    />
                                    <textarea 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white h-16 font-mono"
                                      placeholder='{"foo": "{{ bar }}"}'
                                      value={typeof action.config.body === 'string' ? action.config.body : JSON.stringify(action.config.body)}
                                      onChange={(e) => updateActionConfig(eventName, action.id, { body: e.target.value })}
                                    />
                                    <input 
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                      placeholder='Response Mapping (JSON)'
                                      value={typeof action.config.responseMapping === 'string' ? action.config.responseMapping : JSON.stringify(action.config.responseMapping)}
                                      onChange={(e) => updateActionConfig(eventName, action.id, { responseMapping: e.target.value })}
                                      onBlur={(e) => {
                                         try {
                                            const val = JSON.parse(e.target.value);
                                            updateActionConfig(eventName, action.id, { responseMapping: val });
                                         } catch (e) { /* ignore */ }
                                      }}
                                    />
                                    <p className="text-[9px] text-gray-400">e.g. {"{\"users\": \"data.users\"}"}</p>
                                  </>
                                )}

                                {(action.type === 'alert' || action.type === 'consoleLog') && (
                                  <input 
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                    placeholder="Message"
                                    value={action.config.message || ''}
                                    onChange={(e) => updateActionConfig(eventName, action.id, { message: e.target.value })}
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                 })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
              <MousePointerClick size={48} className="mb-4 opacity-20" />
              <p>Select a component on the canvas to edit its properties.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
