export type ComponentType = 
  | 'page'       // 根节点
  | 'container'  // 布局容器
  | 'row'        // Flex Row
  | 'column'     // Flex Column
  | 'input'      // 基础组件
  | 'button'
  | 'text'
  | 'image'      // 图片
  | 'table'      // 数据展示
  | 'select';    // 表单选择

export type ActionType = 'n8n-webhook' | 'setState' | 'consoleLog' | 'alert';

export interface Action {
  id: string;
  type: ActionType;
  config: Record<string, any>;
}

export interface ComponentSchema {
  id: string;
  type: ComponentType;
  label?: string; // 编辑器显示的名称
  // 属性包：所有业务属性都放这里
  props: Record<string, any>;
  // 样式包：CSS 样式
  style?: Record<string, any>;
  // 事件包：key 是事件名 (e.g. 'onClick'), value 是动作列表
  events?: Record<string, Action[]>;
  // 子节点：关键！支持无限嵌套
  children?: ComponentSchema[];
}

export interface PageSchema {
  version: string;
  root: ComponentSchema;
}
