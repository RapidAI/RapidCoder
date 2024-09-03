import {defineStore} from 'pinia';
import {post, streamPost} from '@/api/index.js';
import {message, Modal} from 'ant-design-vue';
import {eventBus} from '@/eventBus.js';
import {ChartTypes} from './ChartTypes.js';

export const useMessageStore = defineStore('messageStore', {
    state: () => ({
        sessions: [],
        session: null,
        databaseInfo: [],
        databaseInfoCheked: [],
        models: [],
        messages: [],
        currentModel: null,
        isStreaming: false,
    }),
    actions: {
        async modelsLoad() {
            const res = await post('/model/getAll');
            if (res?.success) {
                this.models = res.data;
            } else {
                console.error('加载模型失败:', res);
            }
        },
        async databasesLoad() {
            const res = await post('/databases/getAll');
            if (res?.success) {
                this.databaseInfo = await Promise.all(res.data.map(async (db) => {
                    const tables = await this.tablesLoad(db.databaseInfoId);
                    return {
                        ...db,
                        tables: tables
                    };
                }));
            } else {
                console.error('加载数据库失败:', res);
            }
        },
        async tablesLoad(databaseId) {
            const res = await post('/tables/getAllByDatabaseId', {databaseInfoId: databaseId});
            if (res?.success) {
                return res.data;
            } else {
                console.error('加载表信息失败:', res);
                return [];
            }
        },
        async columnsLoad(tableId) {
            const res = await post('/columns/getAllByTableId', {tableInfoId: tableId});
            if (res?.success) {
                return res.data;
            } else {
                console.error('加载列信息失败:', res);
                return [];
            }
        },
        async sessionsLoad(userId) {
            const response = await post('/sessions/getByUserId', {userId});
            if (response?.success && response.data) {
                this.sessions = response.data;
                this.messagesInit(this.sessions[0]);
                return true;
            } else {
                return false;
            }
        },
        async sessionCreate(userId) {
            const newSession = {
                title: `全部数据库分析`,
                modelId: this.models[0].modelId,
                userId,
                databaseInfoId: this.databaseInfo[0].databaseInfoId,
                databaseInfoCheked: JSON.stringify(this.databaseInfo.map(db => db.databaseName)),
                messages: JSON.stringify([{
                    role: 'system',
                    content: this.databaseCreateSQLTableStatements(this.databaseInfo)
                }]),
            };
            const response = await post('/sessions/add', newSession);
            if (response?.success) {
                this.sessions.unshift(response.data);
                this.messagesInit(response.data);
            }
        },
        messagesInit(newSession) {
            if (newSession) {
                this.session = newSession;
                this.messages = JSON.parse(newSession.messages).map(msg => ({...msg, isAnalyzing: false}));
                this.databaseInfoCheked = JSON.parse(newSession.databaseInfoCheked);
                const model = this.models.find((model) => model.modelId === newSession.modelId);
                this.currentModel = model || null;
            }
        },
        async sessionDelete(index) {
            const sessionToDelete = this.sessions[index];
            const response = await post('/sessions/delete', {sessionId: sessionToDelete.sessionId});
            if (response?.success) {
                this.sessions.splice(index, 1);
                this.messagesInit(this.sessions.length > 0 ? this.sessions[0] : null);
            } else {
                message.error('删除失败');
            }
        },
        async sessionRename(session, newName) {
            const updatedSession = {...session, title: newName};
            const response = await post('/sessions/update', updatedSession);
            if (response?.success) {
                const index = this.sessions.findIndex((s) => s.sessionId === session.sessionId);
                if (index !== -1) {
                    this.sessions[index].title = newName;
                }
            } else {
                message.error('重命名失败');
            }
        },
        async sessionUpdate() {
            this.session.messages = JSON.stringify(this.messages);
            this.session.databaseInfoCheked = JSON.stringify(this.databaseInfoCheked);
            await post('/sessions/update', this.session);
        },
        async messagePerformSemanticSearch(queryText) {
            const response = await post('/queryVectors/searchByVectorAndDatabaseInfoId', {
                queryText
            });
            if (response?.success) {
                return response.data;
            } else {
                message.error('语义检索失败');
                return [];
            }
        },
        async messageSearchDatabaseAndmessageInputAndChat(messagelist, index, overwrite, semanticSearch = false) {
            // 还原搜索数据库
            this.databaseInfoCheked = this.databaseInfo.flatMap(db =>
                db.tables.map(table => db.databaseName + '.' + table.tableName)
            );
            await this.databaseInfofilter(this.databaseInfoCheked)
            // 搜索数据库
            let messagelistCopy = JSON.parse(JSON.stringify(messagelist));
            const assistantIndex = overwrite ? index - 1 : index;
            let prompt = `根据问题和上面的信息仔细思考,确定哪几个数据库和表可以查询出用户的问题,如果不需要就返回空数组\n`;
            prompt += `返回json数据结构\n`;
            prompt += `{\n`;
            prompt += `   analysis: "用户的意图分析...,跨库跨表的分析..."\n`;
            prompt += `   reason: ["选择 数据库 的原因:...选择 表 的原因:...",...]\n`;
            prompt += `   databaseInfo: [数据库名字.表名字,...]\n`;
            prompt += `}\n`;
            prompt += `问题如下：${messagelist[assistantIndex].content}`;
            messagelistCopy[assistantIndex].content = prompt;
            await this.messageInputAndChat(messagelistCopy, assistantIndex, false, false);
            const content = this.messages[assistantIndex + 1].content;
            const matches = content.match(/```json([\s\S]*?)```/);
            this.databaseInfoCheked = matches ? JSON.parse(matches[1].trim()).databaseInfo : [];
            // 获取表信息并更新列信息
            for (const dbTable of this.databaseInfoCheked) {
                const [dbName, tableName] = dbTable.split('.');
                const db = this.databaseInfo.find(d => d.databaseName === dbName);
                if (db) {
                    this.session.databaseInfoId = db.databaseInfoId
                    const table = db.tables.find(t => t.tableName === tableName);
                    if (table) {
                        table.columns = await this.columnsLoad(table.tableInfoId);
                    }
                }
            }
            // 开始对话
            await this.databaseInfofilter(this.databaseInfoCheked)
            await this.messageInputAndChat(messagelist, index + 1, overwrite, semanticSearch);
        },
        // 过滤数据库信息并修改system定义
        async databaseInfofilter(checkedKeysValue) {
            const database = this.databaseInfo.map(db => ({
                ...db,
                tables: (db.tables || []).map(table => ({
                    ...table,
                    columns: (table.columns || []).filter(column =>
                        checkedKeysValue.includes(`${db.databaseName}.${table.tableName}`)
                    ),
                })).filter(table =>
                    checkedKeysValue.includes(`${db.databaseName}.${table.tableName}`) ||
                    table.columns.length > 0
                ),
            })).filter(db =>
                checkedKeysValue.includes(db.databaseName) ||
                db.tables.length > 0
            );
            // 更新system定义
            this.messages[0] = {
                role: 'system',
                content: this.databaseCreateSQLTableStatements(database),
            };
        },
        async messageInputAndChat(messagelist, index, overwrite, semanticSearch = false) {
            if (!this.currentModel) {
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
                const semanticMessageContent = semanticSearchResults.map(result => `### 参考信息\n\n**查询问题:** ${result.queryText}\n**对应SQL:** \`${result.resultText}\``).join('\n\n');
                if (semanticMessageContent) {
                    allMessages.splice(allMessages.length, 0, {role: 'user', content: semanticMessageContent});
                }
            }

            if(prompt!=="根据以上数据总结分析"){
                // 针对allMessages每一个role==assistant的content是执行结果忽略部分数据
                allMessages = allMessages.map(message => {
                    if (message.role === 'assistant' && message.content.startsWith('执行结果:')) {
                        const lines = message.content.split('\n');
                        let selectedLines = lines.slice(0, 7).join('\n');
                        if (lines.length > 7) {
                            selectedLines += '\n...';
                        }
                        return {...message, content: selectedLines};
                    }
                    return message;
                });
            }

            const modelPayload = {...this.currentModel, messages: allMessages};
            console.log(allMessages)
            const responseStream = await streamPost(`/chat/generateStreambyModel?sessionId=${this.session.sessionId}`, modelPayload);
            const reader = responseStream.getReader();
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
                    await this.messageSplitAndExecuteSQL(this.messages[assistantIndex],
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
                    await post(`/chat/stopStream?sessionId=${this.session.sessionId}`);
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
        async messageSplitAndExecuteSQL(sqlMessage, queryMessage, index = null) {
            const extractSQLContent = content => {
                return [...content.matchAll(/([\s\S]*?)```sql([\s\S]*?)```/g)]
                    .map(match => ({description: match[1].trim(), sql: match[2].trim()}));
            };

            // 提取并处理 SQL 内容
            const sqlContent = sqlMessage.content;
            const sqlBlocks = extractSQLContent(sqlContent);

            if (sqlBlocks.length > 1) {
                const newMessages = sqlBlocks.flatMap(({description, sql}) => ([
                    {role: 'assistant', content: `${description}\n\`\`\`sql\n${sql}\n\`\`\``},
                    {role: 'assistant', content: ''}
                ]));
                this.messages.splice(index, 1, ...newMessages);

                for (let i = 0; i < newMessages.length; i += 2) {
                    await this.messageExecuteSQL(newMessages[i], queryMessage, index + i);
                }
            } else {
                this.messages[index] = {role: 'assistant', content: sqlContent};
                await this.messageExecuteSQL(this.messages[index], queryMessage, index);
            }
        },
        async messageExecuteSQL(sqlMessage, queryMessage, index = null) {
            if (!this.messageContainsSQL(sqlMessage.content)) {
                await this.sessionUpdate();
                return;
            }
            const sql = this.messageExtractSQL(sqlMessage.content);
            if (!this.messageIsSelectQuery(sql)) {
                // 弹出确认框，确认是否继续执行非SELECT查询
                const confirmed = await new Promise((resolve) => {
                    Modal.confirm({
                        title: '确认执行',
                        content: `您确认要执行这个sql吗？:\n${sql}`,
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
                databaseInfoId: this.session.databaseInfoId,
                sessionId: this.session.sessionId,
                userId: this.session.userId,
                sqlText: sql,
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
                console.error(`执行sql出错:\n${response.data.responseText}`)
                queryMessage.retryCount = (queryMessage.retryCount || 0) + 1;
                this.messages.splice(index + 1, 1, {
                    role: 'assistant',
                    content: `执行sql出错:\n${response.data.responseText}`
                });
                eventBus.emit('messageUpdated', index + 1);
                if (queryMessage.retryCount < 3) {
                    await this.messageInputAndChat(this.messages, index, true);
                }
            }
            await this.sessionUpdate();
        },
        messageContainsSQL(content) {
            return /```sql([\s\S]*?)```/.test(content);
        },
        messageExtractSQL(content) {
            const matches = content.match(/```sql([\s\S]*?)```/);
            return matches ? matches[1].trim() : '';
        },
        messageIsSelectQuery(sql) {
            const disallowedKeywords = ["insert", "update", "delete", "merge", "alter", "drop", "create"];
            return !disallowedKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(sql.trim().toLowerCase()));
        },
        databaseCreateSQLTableStatements(databases) {
            let sqlStatements = `#### 任务: sql数据分析\n`;
            sqlStatements += `#### 要求: 要求sql展示中文标头, 不要假设字段,不需要解释\n`;
            // 打乱 databases 数组顺序
            databases = databases.sort(() => Math.random() - 0.5);
            databases.forEach((database) => {
                sqlStatements += `#### 数据库名字: ${database.databaseName}\n`;
                sqlStatements += `#### 数据库说明: ${database.databaseDescription}\n`;
                sqlStatements += `#### 数据库类型: ${database.databaseType}\n`;
                sqlStatements += `#### 连接信息: ${database.host} 端口:${database.port} 连接用户:${database.username} \n\n\`\`\`sql\n`;

                database.tables.forEach((table) => {
                    let createStatement = `CREATE TABLE ${table.tableName} (\n`;
                    if (table.columns && table.columns.length > 0) {
                        table.columns.forEach((column, index) => {
                            createStatement += `  ${column.columnName} ${column.dataType}`;
                            if (column.columnComment || column.columnDescription) {
                                createStatement += ` comment '${(column.columnComment || '') + ' ' + (column.columnDescription || '')}'`;
                            }
                            createStatement += (index < table.columns.length - 1) ? ',\n' : '\n';
                        });
                    } else {
                        createStatement += `...\n`;
                    }
                    createStatement += ')';
                    if (table.tableComment || table.tableDescription) {
                        createStatement += ` comment='${(table.tableComment || '') + ' ' + (table.tableDescription || '')}'`;
                    }
                    createStatement += ';\n\n';
                    sqlStatements += createStatement;
                });

                sqlStatements += '```\n';
            });
            return sqlStatements;
        },
        databaseCreateSQLTableStatements4Analyze(databases) {
            let sqlStatements = `#### 任务: 数据库分析\n`;
            // 打乱 databases 数组顺序
            databases = databases.sort(() => Math.random() - 0.5);
            databases.forEach((database) => {
                sqlStatements += `#### 数据库名字: ${database.databaseName}\n`;
                sqlStatements += `#### 数据库说明: ${database.databaseDescription}\n`;
                sqlStatements += `#### 数据库类型: ${database.databaseType}\n`;
                sqlStatements += `#### 连接信息: ${database.host} 端口:${database.port} 连接用户:${database.username} \n\n\`\`\`sql\n`;
                database.tables.forEach((table) => {
                    let createStatement = `CREATE TABLE ${table.tableName} (\n`;
                    if (table.columns && table.columns.length > 0) {
                        table.columns.forEach((column, index) => {
                            createStatement += `  ${column.columnName} ${column.dataType}`;
                            if (column.columnComment) {
                                createStatement += ` comment '${(column.columnComment)}'`;
                            }
                            createStatement += (index < table.columns.length - 1) ? ',\n' : '\n';
                        });
                    } else {
                        createStatement += `...\n`;
                    }
                    createStatement += ')';
                    if (table.tableComment) {
                        createStatement += ` comment='${(table.tableComment)}'`;
                    }
                    createStatement += ';\n\n';
                    sqlStatements += createStatement;
                });

                sqlStatements += '```\n';
            });
            return sqlStatements;
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
            chartData = "```chart\n"+JSON.stringify(chartData)+"\n```"
            this.messages.splice(index + 2, 0, {role: 'assistant', content:chartData });
            await this.sessionUpdate();
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