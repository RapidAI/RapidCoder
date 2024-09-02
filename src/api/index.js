// api/UserStore.js
import router from '@/router';
import { Modal } from 'ant-design-vue';
import { useUserStore } from '@/store/UserStore.js';

const API_URL = `${import.meta.env.VITE_APP_BASE_API}`;

const baseConfig = {
    headers: { "Content-Type": "application/json" },
    method: "POST"
};

const handleError = (error) => Modal.error({
    title: '请求错误',
    content: error.message || '发生未知错误，请稍后重试。'
});

const fetchWithAuth = async (url, options) => {
    const store = useUserStore();
    const headers = {
        ...baseConfig.headers,
        Authorization: `Bearer ${store.token || ''}`
    };

    try {
        const response = await fetch(API_URL + url, { ...baseConfig, ...options, headers });
        if (response.status === 401) {
            store.logout();
            router.push("/login");
            return null;
        }
        return response;
    } catch (error) {
        handleError(error);
        return null;
    }
};

export const post = async (url, data) => {
    const response = await fetchWithAuth(url, { body: JSON.stringify(data) });
    if (!response) return null;
    const result = await response.json();
    if (!result.success) {
        handleError({ message: result.message });
        return null;
    }
    return result;
};

export const streamPost = async (url, data) => {
    const response = await fetchWithAuth(url, { body: JSON.stringify(data) });
    if (response && response.body) {
        return response.body;
    }
    handleError({ message: '无有效响应体' });
    return null;
};

