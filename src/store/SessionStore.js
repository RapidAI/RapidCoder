import {defineStore} from 'pinia';
import {message} from 'ant-design-vue';
import {processChat} from '@/util/chat';

export const useSessionStore = defineStore('session_store', {
    state: () => ({
        sessions: [],
        selectedSessionId: '',
    }),
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'session_store',
                storage: localStorage,
            },
        ],
    },
    actions: {
        createSession(model, path) {
            const newSession = {
                sessionId: Date.now(),
                currentModel: model,
                currentProjectPath: path,
                currentSelectFile: [],
                expandedKeys: [],
                isStreaming: false,
                messages: [
                    {
                        role: 'system',
                        content: `你是一个高级开发工程师,喜欢用更优雅的,简洁的,效率更高的方案来完成你的工作`,
                    },
                    {
                        role: 'user',
                        content: ``,
                    },
                ],
            };
            this.sessions.push(newSession);
            return newSession;
        },
        async agent2(currentSession, index, overwrite) {
            const messagelist = currentSession.messages;
            const userQuestion = messagelist[index].content;
            const prompt = `
请基于以上内容回答用户的问题: ${userQuestion}
返回的数据格式为：

如果用户的问题比较简单:
直接返回你的回答，不需要思考

如果用户的问题比较复杂,需要经过一下步骤的思考:
### 思考:
按步骤思考并分析问题，提出相关的解决方案。
### 反思:
反思上面思考推理过程，检查是否有错误或改进空间。
### 再思考:
根据你的反思做出必要的调整，提出更完善的解决方案。

请按照以下格式返回:
### 结果:
\`\`\`lang:/Users/.../file
// 替换原内容
{{ old content }}
// 替换后内容
{{ new content }}
\`\`\`
示例格式说明: 指定语言ID:对应的文件绝对路径
如果是修改的部分内容,需要指定替换的内容块,使用// 替换原内容 和// 替换后内容 来标识
如果不是修改部分内容,请全部返回
请不要忽略内容块
`;
            const clonedMessages = JSON.parse(JSON.stringify(messagelist));
            clonedMessages[index].content = prompt;
            await processChat(currentSession, clonedMessages, index, overwrite);
        },
        async agent1(currentSession, index, overwrite) {
            await this.agent2(currentSession, index, overwrite);
        },
        async stopChat(currentSession) {
            try {
                await currentSession.reader?.cancel();
            } finally {
                message.success('请求已终止');
                currentSession.isStreaming = false;
            }
        }
    },
});
