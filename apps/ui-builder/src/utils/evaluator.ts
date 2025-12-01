import _ from 'lodash';

/**
 * 解析包含 Mustache 风格表达式的字符串
 * @param template 原始字符串，例如 "Hello {{ user.name }}"
 * @param context 数据上下文，例如 { user: { name: "Alice" } }
 * @returns 解析后的字符串或原始值
 */
export const evaluateExpression = (template: any, context: Record<string, any>): any => {
  if (typeof template !== 'string') return template;

  // 1. 检查是否是纯表达式，例如 "{{ user.age }}"
  // 这种情况可能返回非字符串类型（如数字、布尔值、对象）
  const pureMatch = template.match(/^\s*\{\{(.+?)\}\}\s*$/);
  if (pureMatch) {
    const path = pureMatch[1].trim();
    return _.get(context, path, undefined); // 如果找不到返回 undefined
  }

  // 2. 检查是否包含插值字符串，例如 "User: {{ user.name }}"
  // 这种情况始终返回字符串
  if (template.includes('{{')) {
    return template.replace(/\{\{(.+?)\}\}/g, (_, path) => {
      const value = _.get(context, path.trim(), '');
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  // 3. 普通字符串直接返回
  return template;
};
