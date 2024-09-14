import { defineStore } from 'pinia';
import { message } from 'ant-design-vue';
import { eventBus } from '@/eventBus.js';
import { useModelStore } from '@/store/ModelStore';
import { useProjectStore } from '@/store/ProjectStore';

const { ipcRenderer } = require('electron');

export const useMessageStore = defineStore('message_store', {
    state: () => ({
        sessions: [],
        currentSession: {},
        projects: [],
        models: [],
        isStreaming: false,
    }),
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'message_store',
                storage: localStorage,
            },
        ],
    },
    actions: {
        loadModels() {
            this.models = useModelStore().models;
        },
        loadProjects() {
            this.projects = useProjectStore().projects;
        },
        createSession() {
            const newSession = {
                sessionId: Date.now(),
                currentModel: this.models[0],
                messages: [
                    {
                        role: 'system',
                        content: `\`\`\`json\n${JSON.stringify(this.projects, null, 2)}\n\`\`\``,
                        isAnalyzing: false,
                    },
                ],
            };
            this.sessions.push(newSession);
            this.currentSession = newSession;
        },
        deleteSession(index) {
            this.sessions.splice(index, 1);
        },
        updateSession() {
            const index = this.sessions.findIndex(
                (s) => s.sessionId === this.currentSession.sessionId
            );
            if (index !== -1) {
                this.sessions[index] = { ...this.currentSession };
            }
        },
        async selectFileAndChat(messagelist, index, overwrite, semanticSearch = false) {
            if (!this.currentSession.currentModel) {
                message.error('请选择一个模型');
                return;
            }

            const userQuestion = messagelist[index].content;
            const prompt = `
根据问题和 projectFileDetails 信息，确定与用户问题相关的文件，如果没有相关文件，返回空数组。
返回的 JSON 数据结构为：
{
  "analysis": "用户意图分析...",
  "reason": ["选择文件的原因:...", ...],
  "filepath": ["文件路径", ...]
}
问题如下：${userQuestion}
`;
            const clonedMessages = JSON.parse(JSON.stringify(messagelist));
            clonedMessages[index].content = prompt;
            await this.processChat(clonedMessages, index, overwrite, semanticSearch);

            const assistantResponse = this.currentSession.messages[index + 1]?.content || '';
            const matches = assistantResponse.match(/```json([\s\S]*?)```/);
            const files = matches ? JSON.parse(matches[1].trim()).filepath : [];
            if (!files.length) return;

            const combinedContent = await this.getCombinedFileContent(files);
            if (!combinedContent) return;

            const newPrompt = `
以下是相关文件的内容:
${combinedContent}
请基于这些内容回答用户的问题: ${userQuestion}

你是一个使用链式思维（Chain of Thought，CoT）方法并结合反思来回答问题的 AI 助手。
输出遵循以下格式：
1. 思考：
按步骤思考并分析问题，提出相关的解决方案。
2. 反思：
反思上面的思考推理过程，检查是否有错误或改进空间。
3. 再思考：
根据你的反思做出必要的调整，提出更完善的解决方案。
4. 结果：
提供最终的简洁答案。

要求输出代码时候先输出对应的文件路径。
`;
            messagelist.splice(index + 2, 0, { role: 'user', content: newPrompt });
            await this.processChat(messagelist, index + 2, overwrite, semanticSearch);
        },
        async getCombinedFileContent(files) {
            try {
                const contents = await Promise.all(
                    files.map(async (file) => {
                        const info = await ipcRenderer.invoke('get-one-file', file);
                        const fileType = file.split('.').pop();
                        return `${file}:\n\`\`\`${fileType}\n${info.content}\n\`\`\``;
                    })
                );
                return contents.join('');
            } catch (error) {
                console.error('获取文件内容失败:', error);
                return '';
            }
        },
        async processChat(messagelist, index, overwrite, semanticSearch = false) {
            this.isStreaming = true;
            const allMessages = [...messagelist];

            if (semanticSearch) {
                const lastUserMessage =
                    messagelist[messagelist.length - 1].role === 'user'
                        ? messagelist[messagelist.length - 1].content
                        : messagelist[messagelist.length - 2].content;
                const results = await this.messagePerformSemanticSearch(lastUserMessage);
                const content = results
                    .map(
                        (r) => `### 参考信息\n\n**查询问题:** ${r.queryText}\n**对应代码:** \`${r.resultText}\``
                    )
                    .join('\n\n');
                if (content) {
                    allMessages.push({ role: 'user', content });
                }
            }

            const modelPayload = {
                ...this.currentSession.currentModel,
                stream: true,
                messages: allMessages,
            };

            const response = await fetch(
                `${modelPayload.baseUrl.replace(/\/?$/, '/')}${'v1/chat/completions'}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${modelPayload.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(modelPayload),
                }
            );

            this.currentSession.reader = response.body.getReader();
            const decoder = new TextDecoder();
            const assistantIndex = overwrite ? index : index + 1;
            this.currentSession.messages[assistantIndex] = {
                role: 'assistant',
                content: '',
                isAnalyzing: true,
            };

            while (true) {
                const { done, value } = await this.currentSession.reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                this.currentSession.messages[assistantIndex].content += this.parseChatResponse(chunk);
                eventBus.emit('messageUpdated', assistantIndex);
            }

            this.currentSession.messages[assistantIndex].isAnalyzing = false;
            this.isStreaming = false;
        },
        parseChatResponse(input) {
            return input
                .split('data:')
                .map((part) => part.trim())
                .filter((part) => part && part !== '[DONE]')
                .reduce((acc, part) => {
                    try {
                        const json = JSON.parse(part);
                        if (json.choices?.[0]?.delta?.content) {
                            acc += json.choices[0].delta.content;
                        }
                    } catch (error) {
                        console.error('解析 JSON 失败:', error, '错误的数据:', part);
                    }
                    return acc;
                }, '');
        },
        messageExecuteCode(index) {
            // 截取代码,并将代码替换掉原来的文件
        },
        async stopChat() {
            if (this.isStreaming) {
                await this.currentSession.reader?.cancel();
                this.isStreaming = false;
                eventBus.emit('messageUpdated', null);
                message.success('请求已终止');
            } else {
                message.info('当前没有正在进行的流式请求');
            }
        },
    },
});
