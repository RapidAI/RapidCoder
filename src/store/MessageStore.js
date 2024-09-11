import {defineStore} from 'pinia';
import {post, streamPost} from '@/api/index.js';
import {message, Modal} from 'ant-design-vue';
import {eventBus} from '@/eventBus.js';
import {ChartTypes} from './ChartTypes.js';
import {useModelStore} from '@/store/ModelStore';
import {useProjectStore} from '@/store/ProjectStore';

export const useMessageStore = defineStore('message_store', {
    state: () => ({
        sesstions: [],
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
        modelsLoad() {
            const modelStore = useModelStore(); // 获取 ModelStore 实例
            this.models = modelStore.models; // 直接从 ModelStore 中读取 models 数据
        },
        async projectsLoad() {
            const projectStore = useProjectStore(); // 获取 ModelStore 实例
            this.projects = projectStore.projects; // 直接从 ModelStore 中读取 models 数据
        },
        async sesstionCreate() {
            this.currentSession = {
                sesstionId: Date.now(),
                currentModel:this.models[0],
                messages: [{
                    role: 'system',
                    content: `\`\`\`json\n${JSON.stringify(this.projects, null, 2)}\n\`\`\``,
                    isAnalyzing: false
                }],
            }
            this.sesstions.push(this.currentSession);
        },
        async sesstionDelete(index) {
            this.sesstions.splice(index, 1);
        },
        async sesstionUpdate() {
            const index = this.sesstions.findIndex(session => session.sesstionId === this.currentSession.sesstionId);
            if (index !== -1) {
                this.sesstions[index] = this.currentSession;
            }
        },
        async messageSearchDatabaseAndmessageInputAndChat(messagelist, index, overwrite, semanticSearch = false) {
            let messagelistCopy = JSON.parse(JSON.stringify(messagelist));
            const assistantIndex = overwrite ? index - 1 : index;
            let prompt = `根据问题和projectFileDetails信息仔细思考,确定哪几个文件对应用户的问题,如果没有就返回空数组\n`;
            prompt += `返回的json数据结构\n`;
            prompt += `{\n`;
            prompt += `   analysis: "用户的意图分析..."\n`;
            prompt += `   reason: ["选择 文件.. 的原因:...选择 文件.. 的原因:...",...]\n`;
            prompt += `   filepath: [文件路径,...]\n`;
            prompt += `}\n`;
            prompt += `问题如下：${messagelist[assistantIndex].content}`;
            messagelistCopy[assistantIndex].content = prompt;
            await this.messageInputAndChat(messagelistCopy, assistantIndex, false, false);
            const content = this.messages[assistantIndex + 1].content;
            const matches = content.match(/```json([\s\S]*?)```/);
            const files = matches ? JSON.parse(matches[1].trim()).filepath : [];
            // 获取文件目录获取文件信息
            for (const file of files) {

            }
            console.log(files)
            // 开始对话
            await this.messageInputAndChat(messagelist, index + 1, overwrite, semanticSearch);
        },
        async messageInputAndChat(messagelist, index, overwrite, semanticSearch = false) {
            if (!this.currentSession.currentModel) {
                message.error('请选择一个模型');
                return;
            }

            this.isStreaming = true;

            let allMessages = [...messagelist];
            const prompt = messagelist[messagelist.length - 1].role === "user" ?
                messagelist[messagelist.length - 1].content :
                messagelist[messagelist.length - 2].content
            if (semanticSearch) {
                const semanticSearchResults = await this.messagePerformSemanticSearch(prompt);
                const semanticMessageContent = semanticSearchResults.map(result => `### 参考信息\n\n**查询问题:** ${result.queryText}\n**对应Code:** \`${result.resultText}\``).join('\n\n');
                if (semanticMessageContent) {
                    allMessages.splice(allMessages.length, 0, {role: 'user', content: semanticMessageContent});
                }
            }

            const modelPayload = {...this.currentModel, messages: allMessages};
            console.log(allMessages)
            const response = await fetch(`${model.baseUrl.replace(/\/?$/, '/')}${'v1/chat/completions'}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${model.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(model)
            });

            const responseStream = await streamPost(`/chat/generateStreambyModel?sesstionId=${this.sesstion.sesstionId}`, modelPayload);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const assistantIndex = overwrite ? index : index + 1;

            if (overwrite) {
                this.messages[index] = {role: 'assistant', content: '', isAnalyzing: true};
            } else {
                this.messages.splice(assistantIndex, 0, {role: 'assistant', content: '', isAnalyzing: true});
            }

            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    this.messages[assistantIndex].isAnalyzing = false;
                    await this.messageSplitAndExecuteCode(this.messages[assistantIndex],
                        this.messages[assistantIndex - 1].role === "user" ?
                            this.messages[assistantIndex - 1] :
                            this.messages[assistantIndex - 2],
                        assistantIndex);
                    break;
                }
                this.messages[assistantIndex].content += this.messageParseChat(decoder.decode(value));
                eventBus.emit('messageUpdated', assistantIndex);
            }

            this.isStreaming = false;
        },
        messageParseChat(input) {
            return input.split('data:').reduce((acc, part) => {
                part = part.trim();
                if (part) {
                    try {
                        const json = JSON.parse(part);
                        if (json.content) acc += json.content;
                    } catch (error) {
                        message.error('解析JSON失败:');
                        console.error(error);
                    }
                }
                return acc;
            }, '');
        },
        async messageStopChat() {
            if (this.isStreaming) {
                try {
                    await post(`/chat/stopStream?sesstionId=${this.sesstion.sesstionId}`);
                    message.success('请求已终止');
                } catch (error) {
                    message.error('终止请求失败:');
                    console.error(error);
                }
            } else {
                this.isStreaming = false;
                message.info('当前没有正在进行的流式请求');
            }
        },
        async messageSplitAndExecuteCode(codeMessage, queryMessage, index = null) {
            const extractCodeContent = content => {
                return [...content.matchAll(/([\s\S]*?)```code([\s\S]*?)```/g)]
                    .map(match => ({description: match[1].trim(), code: match[2].trim()}));
            };

            // 提取并处理 Code 内容
            const codeContent = codeMessage.content;
            const codeBlocks = extractCodeContent(codeContent);

            if (codeBlocks.length > 1) {
                const newMessages = codeBlocks.flatMap(({description, code}) => ([
                    {role: 'assistant', content: `${description}\n\`\`\`code\n${code}\n\`\`\``},
                    {role: 'assistant', content: ''}
                ]));
                this.messages.splice(index, 1, ...newMessages);

                for (let i = 0; i < newMessages.length; i += 2) {
                    await this.messageExecuteCode(newMessages[i], queryMessage, index + i);
                }
            } else {
                this.messages[index] = {role: 'assistant', content: codeContent};
                await this.messageExecuteCode(this.messages[index], queryMessage, index);
            }
        },
        async messageExecuteCode(codeMessage, queryMessage, index = null) {
            if (!this.messageContainsCode(codeMessage.content)) {
                await this.sesstionUpdate();
                return;
            }
            const code = this.messageExtractCode(codeMessage.content);
            if (!this.messageIsSelectQuery(code)) {
                // 弹出确认框，确认是否继续执行非SELECT查询
                const confirmed = await new Promise((resolve) => {
                    Modal.confirm({
                        title: '确认执行',
                        content: `您确认要执行这个code吗？:\n${code}`,
                        onOk: () => resolve(true),
                        onCancel: () => resolve(false),
                    });
                });

                if (!confirmed) {
                    message.info('执行已取消');
                    return;
                }
            }

            const querydata = {
                databaseInfoId: this.sesstion.databaseInfoId,
                sesstionId: this.sesstion.sesstionId,
                userId: this.sesstion.userId,
                codeText: code,
                queryText: queryMessage.content
            };
            const response = await post('/queries/execute', querydata);
            if (response?.data?.success) {
                this.messages.splice(index + 1, 1, {
                    role: 'assistant',
                    content: `执行结果:\n${response.data.responseText}`
                });
                eventBus.emit('messageUpdated', index + 1);
            } else {
                console.error(`执行code出错:\n${response.data.responseText}`)
                queryMessage.retryCount = (queryMessage.retryCount || 0) + 1;
                this.messages.splice(index + 1, 1, {
                    role: 'assistant',
                    content: `执行code出错:\n${response.data.responseText}`
                });
                eventBus.emit('messageUpdated', index + 1);
                if (queryMessage.retryCount < 3) {
                    await this.messageInputAndChat(this.messages, index, true);
                }
            }
            await this.sesstionUpdate();
        },
        messageContainsCode(content) {
            return /```code([\s\S]*?)```/.test(content);
        },
        messageExtractCode(content) {
            const matches = content.match(/```code([\s\S]*?)```/);
            return matches ? matches[1].trim() : '';
        },
        messageIsSelectQuery(code) {
            const disallowedKeywords = ["insert", "update", "delete", "merge", "alter", "drop", "create"];
            return !disallowedKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(code.trim().toLowerCase()));
        },
        async messageToChart(index, chartType) {
            let prompt = `要求通过js代码将执行结果转换成一个${chartType}图表数据结构,方便进行数据分析,选择合理的数据展示字段\n`;
            prompt += `图表数据格式示例: ${ChartTypes[chartType]} \n`;
            prompt += `只返回json数据结构\n`;
            prompt += `{\n`;
            prompt += `   analysis: "用户的意图分析:..."\n`;
            prompt += `   jscode: "function messageToChart(tableData) {...return...}"\n`;
            prompt += `}\n`;
            // 减轻数据量
            const lines = this.messages[index].content.split('\n');
            let selectedLines = lines.slice(0, 7).join('\n');
            if (lines.length > 7) {
                selectedLines += '\n...';
            }
            prompt += `${selectedLines}`;
            await this.messageInputAndChat([{role: 'user', content: prompt}], index, false);
            const content = this.messages[index + 1].content;
            const matches = content.match(/```json([\s\S]*?)```/);
            const jscode = matches ? JSON.parse(matches[1].trim()).jscode : "";
            // 使用eval来定义函数并将其附加到当前模块作用域
            eval(`this.messageToChartJscode = ${jscode}`);
            const tableData = this.messageMarkdownToJson(this.messages[index].content)
            let chartData = this.messageToChartJscode(tableData);
            chartData = "```chart\n" + JSON.stringify(chartData) + "\n```"
            this.messages.splice(index + 2, 0, {role: 'assistant', content: chartData});
            await this.sesstionUpdate();
        },
        messageMarkdownToJson(markdown) {
            const markdownTable = markdown.split('\n').filter(line => line.includes('|')).join('\n');
            const lines = markdownTable.split('\n').filter(line => line.trim());
            const headers = lines[0].split('|').map(header => header.trim()).filter(Boolean);
            const rows = lines.slice(2).map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));
            return rows.map(row => {
                const result = {};
                headers.forEach((header, index) => {
                    result[header] = isNaN(row[index]) ? row[index] : parseFloat(row[index]);
                });
                return result;
            });
        }
    }
});