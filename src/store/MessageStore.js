import {defineStore} from 'pinia';
import {message} from 'ant-design-vue';
import {eventBus} from '@/eventBus.js';
import {useModelStore} from '@/store/ModelStore';
import {useProjectStore} from '@/store/ProjectStore';

const {ipcRenderer} = require('electron');

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
        async selectFileAndChat(messagelist, index, overwrite, semanticSearch = false) {
            if (!this.currentSession.currentModel) {
                message.error('请选择一个模型');
                return;
            }

            const userQuestion = messagelist[index].content;
            const prompt = `
根据问题和 projectFileDetails 信息以及上文的信息
确定是否需要获取具体文件的内容,还是继续改写
返回的 JSON 数据结构为：
{
    "analysis": "用户意图分析...",
    "result": {
        "newFileContent": {
            "need": true/false,
            "reason": ["选择文件的原因:...", ...],
            "filepath": ["文件路径", ...]
        },
        "continueEditingAbove": {
            "need": true/false,
            "reason": ...
        }
    }
}
问题如下：${userQuestion}
`;
            const clonedMessages = JSON.parse(JSON.stringify(messagelist));
            clonedMessages[index].content = prompt;
            await this.processChat(clonedMessages, index, overwrite, semanticSearch);

            const assistantResponse = this.currentSession.messages[index + 1]?.content || '';
            const matches = assistantResponse.match(/```json([\s\S]*?)```/);
            const jsonResponse = matches ? JSON.parse(matches[1].trim()) : null;
            if (!jsonResponse) return;

            // 使用 'need' 字段来判断是否需要获取新的文件内容
            if (jsonResponse.result.newFileContent.need) {
                const files = jsonResponse.result.newFileContent.filepath || [];
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

如果返回代码不是全部内容totleContent=false
返回的 JSON 数据结构为：
{
    "思考": "...",
    "反思": "...",
    "再思考": "...",
    "结果": {
        "filePath": "...",
        "totleContent": true/false,
        "code": "..."
    }
}
`;
                messagelist.splice(index + 2, 0, {role: 'user', content: newPrompt});
                await this.processChat(messagelist, index + 2, overwrite, semanticSearch);
            } else {
                await this.processChat(messagelist, index, overwrite, semanticSearch);
            }
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
                //  todo 检索
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
                const {done, value} = await this.currentSession.reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                this.currentSession.messages[assistantIndex].content += this.parseChatResponse(chunk);
                eventBus.emit('messageUpdated', assistantIndex);
            }

            this.currentSession.messages[assistantIndex].isAnalyzing = false;
            this.messageExecuteCode(assistantIndex)
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
        // 在您的 actions 中添加或替换以下方法
        async messageExecuteCode(index) {
            const assistantMessage = this.currentSession.messages[index]?.content;
            if (!assistantMessage) return;

            // 尝试从消息中提取 JSON 响应
            try {
                const matches = assistantMessage.match(/```json([\s\S]*?)```/);
                const jsonResponse = matches ? JSON.parse(matches[1].trim()) : null;
                if (!jsonResponse) {
                    message.error('未找到有效的 JSON 响应');
                    return;
                }

                // 从 JSON 响应中获取文件路径和代码内容
                const { 思考, 反思, 再思考, 结果 } = jsonResponse;
                if (!结果 || !结果.filePath || !结果.code) {
                    message.error('JSON 结果中缺少文件路径或代码内容');
                    return;
                }

                const filePath = 结果.filePath;
                const codeContent = 结果.code;

                // 替换文件内容
                try {
                    const result = await ipcRenderer.invoke('replace-file-content', filePath, codeContent);
                    if (result.success) {
                        message.success(`文件 ${filePath} 已成功更新`);
                    } else {
                        message.error(`更新文件 ${filePath} 时出错: ${result.message}`);
                    }
                } catch (error) {
                    message.error(`调用替换文件内容时出错: ${error.message}`);
                }
            } catch (error) {
                message.error('解析 JSON 时发生错误: ' + error.message);
            }
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
