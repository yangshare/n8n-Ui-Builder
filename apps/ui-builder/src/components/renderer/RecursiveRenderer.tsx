import React from 'react';
import { ComponentSchema } from '../../types/schema';
import { useEditorStore } from '../../store/editorStore';
import { evaluateExpression } from '../../utils/evaluator';
import { runActions } from '../../utils/actionRunner';
import { useSortable, SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RendererProps {
  schema: ComponentSchema;
  isEditor?: boolean; // true: 编辑模式, false: 预览模式
}

export const RecursiveRenderer: React.FC<RendererProps> = ({ schema, isEditor = true }) => {
  const { selectedId, selectComponent, storeData } = useEditorStore();

  // DnD Hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: schema.id,
    data: {
      type: schema.type,
      schema: schema
    },
    disabled: !isEditor || schema.id === 'root' // Root cannot be dragged
  });

  // 1. 动态属性计算
  // 在预览模式下，我们对所有属性进行表达式求值
  // 在编辑模式下，我们通常显示原始值，但在某些预览场景下也可以计算
  const computedProps = React.useMemo(() => {
    if (isEditor) return schema.props; // 编辑模式直接使用原始 props
    
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema.props)) {
      result[key] = evaluateExpression(value, storeData);
    }
    return result;
  }, [schema.props, storeData, isEditor]);

  const computedLabel = React.useMemo(() => {
    if (isEditor) return schema.label;
    return evaluateExpression(schema.label, storeData);
  }, [schema.label, storeData, isEditor]);


  // 阻止事件冒泡，确保点击组件时选中它，而不是它的父级
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditor) {
      selectComponent(schema.id);
    } else {
      // 运行配置的 onClick 动作
      if (schema.events?.onClick) {
        runActions(schema.events.onClick, { event: e });
      }
    }
  };

  const isSelected = selectedId === schema.id;

  // Highlight for Drop Target (Container)
  const highlightClass = isOver && isEditor && ['page', 'container', 'row', 'column'].includes(schema.type) 
      ? 'ring-2 ring-green-400 ring-inset bg-green-50' 
      : '';

  // DnD Styles
  const dndStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // 基础样式
  const baseStyle: React.CSSProperties = {
    ...schema.style,
    ...dndStyle,
    position: 'relative',
    outline: isEditor && isSelected ? '2px solid #3b82f6' : (isEditor ? '1px dashed transparent' : undefined),
    outlineOffset: '-2px',
    transition: 'all 0.2s',
  };

  // 编辑器模式下的悬停效果
  const editorClass = isEditor 
    ? "hover:outline-blue-300 hover:outline-dashed cursor-pointer" 
    : "";

  // 渲染内容
  const renderContent = () => {
    switch (schema.type) {
      case 'page':
      case 'container':
      case 'row':
      case 'column':
        return (
          <div 
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            style={{ 
              ...baseStyle, 
              minHeight: schema.children?.length === 0 ? '50px' : undefined,
              backgroundColor: schema.children?.length === 0 && isEditor ? '#f9fafb' : undefined
            }} 
            className={`p-2 ${editorClass} ${highlightClass} ${schema.type === 'row' ? 'flex flex-row' : 'flex flex-col'}`}
            onClick={handleClick}
          >
            {/* 空状态提示 */}
            {schema.children?.length === 0 && isEditor && (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs select-none">
                {schema.type.toUpperCase()} (Drop items here)
              </div>
            )}
            
            {isEditor && schema.children ? (
              <SortableContext 
                items={schema.children.map(c => c.id)} 
                strategy={schema.type === 'row' || schema.style?.flexDirection === 'row' ? horizontalListSortingStrategy : verticalListSortingStrategy}
              >
                {schema.children.map(child => (
                  <RecursiveRenderer key={child.id} schema={child} isEditor={isEditor} />
                ))}
              </SortableContext>
            ) : (
               schema.children?.map(child => (
                <RecursiveRenderer key={child.id} schema={child} isEditor={isEditor} />
              ))
            )}
          </div>
        );

      case 'input': {
        // Local state for input handling
        const [localValue, setLocalValue] = React.useState(computedProps.value || '');
        
        // Sync local state when prop changes (e.g. store update)
        React.useEffect(() => {
           setLocalValue(computedProps.value || '');
        }, [computedProps.value]);

        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass}`} onClick={handleClick}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{computedLabel}</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder={computedProps.placeholder}
              value={localValue} 
              onChange={(e) => {
                 setLocalValue(e.target.value);
                 if (!isEditor && schema.events?.onChange) {
                    runActions(schema.events.onChange, { value: e.target.value });
                 }
              }}
              disabled={isEditor} 
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on input interaction
            />
          </div>
        );
      }

      case 'button':
        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass}`} onClick={handleClick}>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md w-full">
              {computedLabel}
            </button>
          </div>
        );

      case 'text':
        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass}`} onClick={handleClick}>
            <p>{computedProps.content || 'Text Block'}</p>
          </div>
        );

      case 'image':
        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass}`} onClick={handleClick}>
            <img 
              src={computedProps.src || 'https://via.placeholder.com/150'} 
              alt={computedProps.alt || 'Image'} 
              className="max-w-full h-auto rounded-md object-cover"
            />
          </div>
        );

      case 'table': {
        const data = Array.isArray(computedProps.data) ? computedProps.data : [];
        const columns = Array.isArray(computedProps.columns) ? computedProps.columns : [];
        
        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass} overflow-x-auto`} onClick={handleClick}>
             <div className="min-w-full inline-block align-middle">
               <div className="border rounded-lg overflow-hidden">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       {columns.length > 0 ? columns.map((col: any, idx: number) => (
                         <th key={idx} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                           {col.title || col.key}
                         </th>
                       )) : (
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Columns Configured</th>
                       )}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200 bg-white">
                     {data.length > 0 ? data.map((row: any, rowIdx: number) => (
                       <tr key={rowIdx}>
                         {columns.map((col: any, colIdx: number) => (
                           <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                             {/* Simple value access, could be enhanced to support templates in cells */}
                             {row[col.key]}
                           </td>
                         ))}
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={columns.length || 1} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                           No Data
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        );
      }

      case 'select': {
        const options = Array.isArray(computedProps.options) ? computedProps.options : [];
        
        // Local state for select handling
        const [localValue, setLocalValue] = React.useState(computedProps.value || '');

        React.useEffect(() => {
           setLocalValue(computedProps.value || '');
        }, [computedProps.value]);

        return (
          <div ref={setNodeRef} {...attributes} {...listeners} style={baseStyle} className={`p-2 ${editorClass}`} onClick={handleClick}>
             <label className="block text-sm font-medium text-gray-700 mb-1">{computedLabel}</label>
             <select
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                value={localValue}
                onChange={(e) => {
                   setLocalValue(e.target.value);
                   if (!isEditor && schema.events?.onChange) {
                      runActions(schema.events.onChange, { value: e.target.value });
                   }
                }}
                disabled={isEditor}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
             >
               <option value="" disabled>Select an option</option>
               {options.map((opt: any, idx: number) => (
                 <option key={idx} value={opt.value}>
                   {opt.label}
                 </option>
               ))}
             </select>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {renderContent()}
      {/* 编辑模式下的删除按钮（仅选中时显示） */}
      {isEditor && isSelected && schema.id !== 'root' && (
        <div className="absolute top-0 right-0 transform translate-x-full -translate-y-0 z-50">
           {/* 这里可以放一些快捷操作栏 */}
        </div>
      )}
    </>
  );
};
