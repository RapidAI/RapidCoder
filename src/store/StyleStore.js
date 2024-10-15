import { defineStore } from 'pinia';

export const useStyleStore = defineStore('style_store', {
  state: () => ({
    treePane: 25,
    filePane: 50,
    contentPane: 25,
  }),
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
