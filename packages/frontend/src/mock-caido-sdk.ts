/**
 * Mock Caido SDK for frontend development
 */

export interface Caido {
  navigation: {
    addPage: (path: string, options: { title?: string; body?: any }) => Promise<void>;
  };
  sidebar: {
    registerItem: (name: string, path: string, options: { icon: string }) => void;
  };
  backend: {
    onEvent: (eventName: string, callback: (data: any) => void) => void;
    [key: string]: any;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  httpHistory: {
    getRequest: (id: string) => Promise<any>;
    openRequest: (id: string) => Promise<void>;
  };
  replay: {
    replay: (requestId: string) => Promise<void>;
    replayWithModifications: (requestId: string, modifications: any) => Promise<void>;
  };
  repeater?: {
    sendToRepeater: (requestId: string) => Promise<void>;
  };
  automate?: {
    createWorkflow: (config: any) => Promise<void>;
    sendToAutomate: (requestId: string, config?: any) => Promise<void>;
  };
}

export const mockCaido: Caido = {
  navigation: {
    addPage: async (path: string, options: { title?: string; body?: any }) => {
      console.log('Mock: Adding page', path, options);
      // Simulate async navigation
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },
  sidebar: {
    registerItem: (name: string, path: string, options: { icon: string }) => {
      console.log('Mock: Registering sidebar item', name, path, options);
    }
  },
  backend: {
    onEvent: (eventName: string, callback: (data: any) => void) => {
      console.log('Mock: Registering event listener', eventName);
    }
  },
  storage: {
    get: async (key: string) => {
      console.log('Mock: Getting storage value for key', key);
      return localStorage.getItem(`caido-param-inventory-${key}`);
    },
    set: async (key: string, value: any) => {
      console.log('Mock: Setting storage value for key', key, value);
      localStorage.setItem(`caido-param-inventory-${key}`, JSON.stringify(value));
    }
  },
  httpHistory: {
    getRequest: async (id: string) => {
      console.log('Mock: Getting request', id);
      return { id, method: 'GET', url: '/api/test', status: 200 };
    },
    openRequest: async (id: string) => {
      console.log('Mock: Opening request in history', id);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },
  replay: {
    replay: async (requestId: string) => {
      console.log('Mock: Replaying request', requestId);
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    replayWithModifications: async (requestId: string, modifications: any) => {
      console.log('Mock: Replaying request with modifications', requestId, modifications);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  },
  repeater: {
    sendToRepeater: async (requestId: string) => {
      console.log('Mock: Sending request to Repeater', requestId);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  },
  automate: {
    createWorkflow: async (config: any) => {
      console.log('Mock: Creating Automate workflow', config);
      await new Promise(resolve => setTimeout(resolve, 300));
    },
    sendToAutomate: async (requestId: string, config?: any) => {
      console.log('Mock: Sending request to Automate', requestId, config);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
};