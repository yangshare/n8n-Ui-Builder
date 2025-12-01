import { Action } from '../types/schema';
import { useEditorStore } from '../store/editorStore';
import { evaluateExpression } from './evaluator';
import _ from 'lodash';

export const runActions = async (actions: Action[] | undefined, localContext: Record<string, any> = {}) => {
  if (!actions || actions.length === 0) return;

  const store = useEditorStore.getState();
  const globalData = store.storeData;
  
  // Merge global state with local context (e.g. event data)
  // Local context takes precedence or sits in a special namespace?
  // Let's flatten them for now, but maybe keep event data under 'event'
  const context = {
    ...globalData,
    ...localContext
  };

  for (const action of actions) {
    console.log('Running action:', action);
    
    try {
      switch (action.type) {
        case 'consoleLog': {
          const message = evaluateExpression(action.config.message, context);
          console.log('[Action Log]:', message);
          break;
        }

        case 'alert': {
          const message = evaluateExpression(action.config.message, context);
          alert(message);
          break;
        }

        case 'setState': {
          const key = action.config.key; // Key usually static, but could be dynamic if we want
          const valueTemplate = action.config.value;
          const value = evaluateExpression(valueTemplate, context);
          
          store.setStoreData(key, value);
          break;
        }

        case 'n8n-webhook': {
          const url = action.config.url;
          const method = action.config.method || 'POST';
          const bodyTemplate = action.config.body; // Optional JSON string or object

          let body = {};
          if (bodyTemplate) {
             if (typeof bodyTemplate === 'string') {
                try {
                    // Try to parse if it looks like JSON, otherwise treat as string
                    const parsed = JSON.parse(bodyTemplate);
                    // Recursively evaluate values if needed, but for now let's keep it simple
                    // Or evaluate the string first then parse
                    body = parsed; 
                } catch (e) {
                    // If not JSON, maybe it's just a value
                    body = { value: evaluateExpression(bodyTemplate, context) };
                }
             } else {
                 body = bodyTemplate;
             }
          }

          // Auto-inject global state if configured? 
          // For now let's send the current storeData as context if method is POST
          const finalBody = {
            ...body,
            context: globalData
          };

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: method !== 'GET' ? JSON.stringify(finalBody) : undefined,
          });

          const json = await response.json();
          console.log('[n8n Response]:', json);
          
          // Optional: Map response back to state
          if (action.config.responseMapping && Object.keys(action.config.responseMapping).length > 0) {
             // action.config.responseMapping = { "user.name": "data.name" }
             Object.entries(action.config.responseMapping).forEach(([stateKey, responsePath]) => {
                 const value = _.get(json, responsePath as string);
                 if (value !== undefined) {
                    store.setStoreData(stateKey, value);
                 }
             });
          } else {
             // Default behavior: If no mapping, try to merge specific keys or just log
             // For backward compatibility or ease of use, maybe we don't merge everything automatically anymore
             // to avoid state pollution. But if user didn't configure mapping, maybe they expect something?
             // Let's just put the whole result in 'lastResult' for debugging
             store.setStoreData('lastResult', json);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error running action ${action.type}:`, error);
    }
  }
};
