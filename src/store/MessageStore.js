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
                currentModel: this.models[0],
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
            if (!this.currentSession.currentModel) {
                message.error('请选择一个模型');
                return;
            }
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
            const content = this.currentSession.messages[assistantIndex + 1].content;
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
            this.isStreaming = true;
            let allMessages = [...messagelist];


            if (semanticSearch) {// 检索
                const prompt = messagelist[messagelist.length - 1].role === "user" ?
                    messagelist[messagelist.length - 1].content :
                    messagelist[messagelist.length - 2].content
                const semanticSearchResults = await this.messagePerformSemanticSearch(prompt);
                const semanticMessageContent = semanticSearchResults.map(result => `### 参考信息\n\n**查询问题:** ${result.queryText}\n**对应Code:** \`${result.resultText}\``).join('\n\n');
                if (semanticMessageContent) {
                    allMessages.splice(allMessages.length, 0, {role: 'user', content: semanticMessageContent});
                }
            }

            const modelPayload = {...this.currentSession.currentModel, stream: true, messages: allMessages};
            const response = await fetch(`${modelPayload.baseUrl.replace(/\/?$/, '/')}${'v1/chat/completions'}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${modelPayload.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(modelPayload)
            });
            this.currentSession.reader = response.body.getReader();
            const decoder = new TextDecoder();
            const assistantIndex = overwrite ? index : index + 1;

            if (overwrite) {
                this.currentSession.messages[index] = {role: 'assistant', content: '', isAnalyzing: true};
            } else {
                this.currentSession.messages.splice(assistantIndex, 0, {
                    role: 'assistant',
                    content: '',
                    isAnalyzing: true
                });
            }

            while (true) {
                const {done, value} = await this.currentSession.reader.read();
                if (done) {
                    this.currentSession.messages[assistantIndex].isAnalyzing = false;
                    break;
                }
                this.currentSession.messages[assistantIndex].content += this.messageParseChat(decoder.decode(value));
                eventBus.emit('messageUpdated', assistantIndex);
            }
            this.isStreaming = false;
        },
        messageParseChat(input) {
            return input.split('data:').reduce((acc, part) => {
                part = part.trim();
                if (part && part !== '[DONE]') {
                    try {
                        const json = JSON.parse(part);
                        if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                            acc += json.choices[0].delta.content;
                        }
                    } catch (error) {
                        console.log(input)
                        message.error('解析JSON失败:');
                        console.error('JSON解析错误:', error, '错误的数据:', part);
                    }
                }
                return acc;
            }, '');
        },
        async messageStopChat() {
            if (this.isStreaming) {
                try {
                    if (this.currentSession.reader) {
                        await this.currentSession.reader.cancel();
                    }
                    this.isStreaming = false;
                    eventBus.emit('messageUpdated', null);
                    message.success('请求已终止');
                } catch (error) {
                    message.error('终止请求失败:');
                    console.error('终止流式请求时发生错误:', error);
                }
            } else {
                message.info('当前没有正在进行的流式请求');
            }
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
            const lines = this.currentSession.messages[index].content.split('\n');
            let selectedLines = lines.slice(0, 7).join('\n');
            if (lines.length > 7) {
                selectedLines += '\n...';
            }
            prompt += `${selectedLines}`;
            await this.messageInputAndChat([{role: 'user', content: prompt}], index, false);
            const content = this.currentSession.messages[index + 1].content;
            const matches = content.match(/```json([\s\S]*?)```/);
            const jscode = matches ? JSON.parse(matches[1].trim()).jscode : "";
            // 使用eval来定义函数并将其附加到当前模块作用域
            eval(`this.messageToChartJscode = ${jscode}`);
            const tableData = this.messageMarkdownToJson(this.currentSession.messages[index].content)
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