import { defineStore } from 'pinia';

export const useParameterStore = defineStore('parameter_store', {
  state: () => ({
    treePane: 25,
    filePane: 50,
    contentPane: 25,
    sshPane: 25,
    debugMode: true,
  }),
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'parameter_store',
        storage: localStorage,
      },
    ],
  },
});