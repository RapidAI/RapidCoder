import { defineStore } from 'pinia';
import { post } from '@/api/index.js';
import { message } from 'ant-design-vue';
import { useUserStore } from "@/store/UserStore.js";

export const useQueryVectorMessageStore = defineStore('queryVectorMessageStore', {
    state: () => ({
        messages: [], // 消息列表
        currentModel: null, // 当前模型
    }),
    actions: {
        // 添加消息
        addMessage(role, content) {
            this.messages.push({ role, content });
        },
        // 处理一次性响应
        async processResponse(messagelist, index, overwrite) {
            try {
                if (!this.currentModel) {
                    message.error('请选择一个模型');
                    return;
                }

                const modelPayload = { ...this.currentModel, messages: messagelist };
                const response = await post(`/chat/generatebyModel`, modelPayload);

                if (response.success) {
                    const assistantIndex = overwrite ? index : index + 1;

                    if (overwrite) {
                        this.messages[index] = { role: 'assistant', content: response.data.content };
                    } else {
                        this.messages.splice(assistantIndex, 0, { role: 'assistant', content: response.data.content });
                    }
                } else {
                    message.error(response.message);
                }
            } catch (error) {
                message.error('获取消息失败:');
                console.error(error);
            }
        },
    }
});
