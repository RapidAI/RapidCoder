import {defineStore} from 'pinia';
import {message} from 'ant-design-vue';
import {eventBus} from '@/eventBus.js';
import {Modal} from 'ant-design-vue';

const {ipcRenderer} = require('electron');

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
                messages: [
                    {
                        role: 'system',
                        content: ``,
                    },
                ],
            };
            this.sessions.push(newSession);
            return newSession
        },
        // 用于选择文件
        async agent2(currentSession, index, overwrite) {
            const messagelist = currentSession.messages
            const userQuestion = messagelist[index].content;
            const prompt = `
返回的 JSON 数据结构为：
{
    "thinking": "...",
    "reflection": "...",
    "rethinking": "...",
    "finalResult": {
        "filePath": ["文件路径...", "..."]
    }
}

JSON结构说明:
你是一个使用链式思维（Chain of Thought，CoT）方法并结合反思来回答问题的 AI 助手。
thinking：按步骤思考并分析问题，提出相关的解决方案。
reflection：反思上面的思考推理过程，检查是否有错误或改进空间。
rethinking：根据你的反思做出必要的调整，提出更完善的解决方案。
finalResult：提供最终的简洁答案

用户的问题：${userQuestion} ,与哪些文件相关?
`;
            const clonedMessages = JSON.parse(JSON.stringify(messagelist));
            clonedMessages[index].content = prompt;
            await this.processChat(currentSession, clonedMessages, index, overwrite);


            const assistantMessage = currentSession.messages[index + 1]?.content || '';
            const finalResult = await this.parseJsonMessage(assistantMessage);
            if (!finalResult) {
                return;
            }

            const files = finalResult.filePath || [];
            if (!files.length) return;
            currentSession.currentSelectFile = files
        },
        // 用于包裹用户问题
        async agent3(currentSession, index, overwrite) {
            const messagelist = currentSession.messages
            const userQuestion = messagelist[index].content;
            const newPrompt = `
请基于以上内容回答用户的问题: ${userQuestion}
返回的数据格式为：
(thinking)"..."(/thinking)
(reflection)"..."(/reflection)
(rethinking)"..."(/rethinking)
(finalResult)
(filePath)"..."(/filePath)
(code)
\`\`\`
...
\`\`\`
(/code)
(/finalResult)
(finalResult)
(filePath)"..."(/filePath)
(code)
\`\`\`
...
\`\`\`
(/code)
(/finalResult)

数据格式说明:
你是一个使用链式思维（Chain of Thought，CoT）方法并结合反思来回答问题的 AI 助手。
(thinking)"..."(/thinking)：按步骤思考并分析问题，提出相关的解决方案。
(reflection)"..."(/reflection)：反思上面的思考推理过程，检查是否有错误或改进空间。
(rethinking)"..."(/rethinking)：根据你的反思做出必要的调整，提出更完善的解决方案。
(finalResult)(/finalResult)：提供最终的简洁答案,如果是多个文件的代码就返回多个
(code)(/code)：代码内容,markdown格式
(filePath)(/filePath)：代码对应的文件路径
`;
            messagelist.splice(index + 2, 0, {role: 'user', content: newPrompt});
            await this.processChat(currentSession, currentSession.messages, index + 2, overwrite);
            this.messageExecuteCode(currentSession.sessionId, index + 3)
        },
        async agent1(currentSession, index, overwrite) {
            // 未选,先选中文件
            if (currentSession.currentSelectFile.length === 0) {
                await this.agent2(currentSession, index, overwrite)
            }
            // 已选中文件
            if (currentSession.currentSelectFile.length > 0) {
                await this.agent3(currentSession, index, overwrite)
            }
        },
        async processChat(currentSession, messagelist, index, overwrite) {
            currentSession.isStreaming = true;
            try {
                const {currentModel} = currentSession;
                const {baseUrl = '', apiKey, model} = currentModel;

                const url = baseUrl.endsWith('/') ? `${baseUrl}v1/chat/completions` : `${baseUrl}/v1/chat/completions`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model,
                        stream: true,
                        messages: messagelist,
                    }),
                });

                currentSession.reader = response.body.getReader();
                const decoder = new TextDecoder();
                const assistantIndex = overwrite ? index : index + 1;
                currentSession.messages[assistantIndex] = {
                    role: 'assistant',
                    content: '',
                    isAnalyzing: true,
                };

                while (true) {
                    const {done, value} = await currentSession.reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    currentSession.messages[assistantIndex].content += this.parseChatResponse(chunk);
                    eventBus.emit('messageUpdated', {sessionId: currentSession.sessionId, index: assistantIndex},);
                }

                currentSession.messages[assistantIndex].isAnalyzing = false;
            } catch (error) {
                console.error('Error during chat process:', error);
            } finally {
                currentSession.isStreaming = false;
            }
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
        async messageExecuteCode(selectedSessionId, index) {
            const currentSession = this.sessions.find(s => s.sessionId === selectedSessionId);
            const assistantMessage = currentSession.messages[index]?.content;
            if (!assistantMessage) return;
            const finalResult = await this.parseParenthesesMessage(assistantMessage);
            if (!finalResult) {
                message.success('不是代码无需运行');
                return;
            }
            await this.processResults(finalResult);
        },
        async parseJsonMessage(assistantMessage) {
            try {
                const matches = assistantMessage.match(/```json([\s\S]*?)```/);
                const jsonString = matches ? matches[1].trim() : assistantMessage.trim();
                const jsonResponse = JSON.parse(jsonString);
                return jsonResponse.finalResult;
            } catch (error) {
                console.log('解析 JSON 时发生错误:', assistantMessage);
                return null;
            }
        },
        async parseParenthesesMessage(assistantMessage) {
            const removeQuotes = str => str.replace(/^['"]|['"]$/g, '');
            const removeCodeBlock = str => str.replace(/^```.*?\n|```$/g, '');
            const finalResultMatches = [...assistantMessage.matchAll(/\(finalResult\)([\s\S]*?)\(\/finalResult\)/g)];
            if (!finalResultMatches.length) return null;
            return finalResultMatches.map(match => {
                const finalResultContent = match[1].trim();
                let code = finalResultContent.match(/\(code\)([\s\S]*?)\(\/code\)/)?.[1].trim();
                code = removeQuotes(code);
                code = removeCodeBlock(code);
                let filePath = finalResultContent.match(/\(filePath\)([\s\S]*?)\(\/filePath\)/)?.[1].trim();
                filePath = removeQuotes(filePath);
                return code && filePath ? {code, filePath, "totleContent": true} : null;
            });
        },
        async processResults(finalResult) {
            for (const {filePath, code, totleContent} of finalResult) {
                if (!filePath || !code || typeof totleContent !== 'boolean') {
                    console.log('JSON finalResult中缺少文件路径、代码内容或 totleContent');
                    continue;
                }

                const result = await ipcRenderer.invoke(totleContent ? 'replaceFileContentt' : 'applyPatchToFile', filePath, code);

                if (result.success) {
                    message.success(`文件 ${filePath} 已成功更新`);
                } else {
                    const cleanCode = code.split('\n').map(line => (line.startsWith('-') || line.startsWith('+')) ? line.slice(1) : line).join('\n');
                    Modal.info({
                        title: `更新文件 ${filePath} 时出错:${result.message}`,
                        content: cleanCode,
                        width: 800,
                        okText: '复制',
                        cancelText: '关闭',
                        maskClosable: true,
                        onOk() {
                            navigator.clipboard.writeText(cleanCode).then(() => {
                                message.success('代码已复制到剪贴板');
                            });
                        }
                    });
                }

            }
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
