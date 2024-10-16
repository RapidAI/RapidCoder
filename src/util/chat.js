import { eventBus } from './eventBus.js';
import {message,Modal} from 'ant-design-vue';

export async function processChat(currentSession, messagelist, index, overwrite) {
    currentSession.isStreaming = true;
    try {
        const { currentModel } = currentSession;
        const { baseUrl = '', apiKey, model } = currentModel;

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
            const { done, value } = await currentSession.reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            currentSession.messages[assistantIndex].content += parseChatResponse(chunk);
            eventBus.emit('messageUpdated', { sessionId: currentSession.sessionId, index: assistantIndex });
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

export async function messageExecuteCode(selectedSessionId, index, sessions) {
    const currentSession = sessions.find(s => s.sessionId === selectedSessionId);
    const assistantMessage = currentSession.messages[index]?.content;
    if (!assistantMessage) return;
    const finalResult = await parseParenthesesMessage(assistantMessage);
    if (!finalResult) {
        message.success('不是代码无需运行');
        return;
    }
    await processResults(finalResult);
}

export async function parseParenthesesMessage(assistantMessage) {
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
        return code && filePath ? { code, filePath, totleContent: true } : null;
    });
}

export async function processResults(finalResult) {
    for (const { filePath, code, totleContent } of finalResult) {
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
}
