import {eventBus} from './eventBus.js';
import {message, Modal} from 'ant-design-vue';

const {ipcRenderer} = require('electron');

export async function processChat(currentSession, messagelist, index, overwrite) {
    currentSession.isStreaming = true;
    try {
        const {currentModel} = currentSession;
        const {baseUrl = '', apiKey, model} = currentModel;

        const url = baseUrl.endsWith('/') ? `${baseUrl}v1/chat/completions` : `${baseUrl}/v1/chat/completions`;

        let response;
        response = await fetch(url, {
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

        if (!response.ok) {
            const errorMessage = `大模型 API 错误，状态码: ${response.status}`;
            console.error(errorMessage);
            message.error(errorMessage);
            return;
        }

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
            currentSession.messages[assistantIndex].content += parseChatResponse(chunk);
            eventBus.emit('messageUpdated', currentSession.sessionId);
        }

        currentSession.messages[assistantIndex].isAnalyzing = false;
    } catch (error) {
        console.error('Error during chat process:', error);
    } finally {
        currentSession.isStreaming = false;
    }
}

export function parseChatResponse(input) {
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
}

export async function saveFileContent(filePath, newcontent) {
    if (!filePath) {
        message.info(`文件路径不存在`);
        return;
    }

    try {
        const oldContent = await ipcRenderer.invoke('getFileContent', filePath);
        const regex = /\/\/\s*replace_from\s*([\s\S]*?)\/\/\s*replace_to\s*([\s\S]*?)(?=\/\/\s*replace_from|$)/gi;
        const matches = [...newcontent.matchAll(regex)];

        // 如果没有匹配项，直接保存 newcontent
        if (!matches.length) {
            await ipcRenderer.invoke('saveFileContent', filePath, newcontent);
            return message.info(`文件 ${filePath} 已保存。`);
        }

        // 处理匹配项并替换内容
        let updatedContent = oldContent;
        matches.forEach(([_, oldCode, newCode]) => {
            const replaceRegex = new RegExp(
                oldCode.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s*'),
                'g'
            );
            updatedContent = updatedContent.replace(replaceRegex, (match) => {
                const indent = match.match(/^\s*/)[0];
                return `${indent}${newCode.trim()}`;
            });
        });

        await ipcRenderer.invoke('saveFileContent', filePath, updatedContent);
        message.info(`文件 ${filePath} 替换成功。`);
    } catch (error) {
        console.error('文件替换失败:', error);
        message.error(`文件 ${filePath} 替换失败。`);
    }
}


