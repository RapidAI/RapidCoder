import {eventBus} from './eventBus.js';
import {message, Modal} from 'ant-design-vue';

const {ipcRenderer} = require('electron');

export async function processChat(currentSession, messagelist, index, overwrite) {
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

export async function saveFileContent(filePath, content) {
    if (!filePath) {
        message.info(`文件路径不存在`);
        return;
    }
    try {
        await ipcRenderer.invoke('saveFileContent', filePath, content);
        message.info(`文件 ${filePath} 替换成功。`);
    } catch (error) {
        console.error('文件替换失败:', error);
        message.error(`文件 ${filePath} 替换失败。`);
    }
}

export async function replaceFileContent(filePath, newContent) {

    const oldContent = await ipcRenderer.invoke('getFileContent', filePath);
// 使用替换逻辑进行内容替换
    const updatedContent = replaceWithReplacements(oldContent, newContent);

// 替换的函数
    function replaceWithReplacements(oldContent, newContent) {
        const regex = /\/\/\s*replace_from\s*([\s\S]*?)\/\/\s*replace_to\s*([\s\S]*?)(?=\/\/\s*replace_from|$)/gi;
        let matches;
        let result = oldContent;

        while ((matches = regex.exec(newContent)) !== null) {
            const oldCode = matches[1].trim();
            const newCode = matches[2].trim();

            // 转义旧代码中的特殊字符并进行正则替换
            const escapedOldCode = oldCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // 转义特殊字符
            const replaceRegex = new RegExp(escapedOldCode, 'g');
            result = result.replace(replaceRegex, newCode);
        }

        return result;
    }
}

