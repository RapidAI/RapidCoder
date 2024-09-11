import {defineStore} from 'pinia';
import {message} from 'ant-design-vue';

export const useModelStore = defineStore('model_store', {
    state: () => ({
        models: [], // 初始状态为一个空数组，数据将从本地存储自动加载
    }),
    actions: {
        // 添加模型
        addModel(model) {
            model.modelId = Date.now()
            this.models.push(model);
        },
        // 更新模型
        updateModel(updatedModel) {
            const index = this.models.findIndex(model => model.modelId === updatedModel.modelId);
            if (index !== -1) {
                this.models[index] = updatedModel;
            }
        },
        // 删除模型
        deleteModel(modelId) {
            this.models = this.models.filter(model => model.modelId !== modelId);
        },
        // 测试连接（使用 post 请求）
        async chatCompletions(model) {
            try {
                // 发送请求
                const response = await fetch(`${model.baseUrl.replace(/\/?$/, '/')}${'v1/chat/completions'}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${model.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(model)
                });

                // 解析响应
                const responseData = await response.json();

                // 检查并处理错误
                if (responseData.error) {
                    message.error(`请求失败: ${responseData.error.message || JSON.stringify(responseData)}`);
                    return null;
                }

                // 返回结果
                return responseData.choices[0].message;

            } catch (error) {
                message.error(`请求失败: ${error.message || error}`);
                return null;
            }
        }
    },
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'model_store',
                storage: localStorage,
            },
        ],
    },
});
