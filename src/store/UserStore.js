import { defineStore } from 'pinia';
export const useUserStore = defineStore('user', {
    state: () => ({
        userData: null,
        token: '',
    }),
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'user',
                storage: localStorage,
            }
        ]
    },
    actions: {
        login(userData) {
            this.userData = userData;
            this.token = userData.token;
        },
        logout() {
            this.userData = null;
            this.token = '';
        }
    }
});
