import {defineStore} from 'pinia';
import {message} from 'ant-design-vue';

export const useStyleStore = defineStore('style_store', {
  state: () => ({
    sidebarWidth: 150, // 初始状态为150
  }),
  actions: {
    setSidebarWidth(width) {
      this.sidebarWidth = width;
    },
  },
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'style_store',
        storage: localStorage,
      },
    ],
  },
});
