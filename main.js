const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;  // 使用 fs.promises 进行异步操作
const { applyPatch } = require('diff');
const chokidar = require('chokidar');

// 创建窗口
const initMainWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'public/logo.png')
    });

    const startURL = process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : path.join(__dirname, 'dist/index.html');
    win.loadURL(startURL);
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
};

// 应用启动逻辑
app.whenReady().then(initMainWindow);

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initMainWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// 通用函数：获取文件信息
const getFileStats = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            title: path.basename(filePath),
            key: filePath,
            type: stats.isDirectory() ? 'folder' : 'file',
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    } catch (err) {
        console.error(`获取 ${filePath} 的文件信息时出错:`, err);
        throw new Error(`获取文件信息时出错: ${err.message}`);
    }
};
// 监听文件夹变化
const activeWatchers = {};  // 用来存储已经监听的目录
ipcMain.handle('initDirectoryWatch', (event, dirPath) => {
    if (activeWatchers[dirPath]) {
        console.log(`目录 ${dirPath} 已经在监听中。`);
        return;
    }

    const watcher = chokidar.watch(dirPath, { persistent: true, ignoreInitial: true });
    activeWatchers[dirPath] = watcher;  // 记录当前监听的目录

    const sendFileDetails = async (filePath, action) => {
        try {
            if (action !== 'unlink') {
                const fileInfo = await getFileStats(filePath);
                event.sender.send(dirPath, { action, fileInfo });
            } else {
                event.sender.send(dirPath, { action, fileInfo: { key: filePath } });
            }
        } catch (err) {
            console.error(`处理文件变更事件时出错: ${filePath}`, err);
        }
    };

    watcher.on('add', filePath => sendFileDetails(filePath, 'add'));
    watcher.on('change', filePath => sendFileDetails(filePath, 'change'));
    watcher.on('unlink', filePath => sendFileDetails(filePath, 'unlink'));

    watcher.on('error', (error) => {
        console.error(`监控目录时发生错误: ${error}`);
        event.sender.send('watchError', { message: `监控目录时发生错误: ${error.message}` });
    });

    // 确保应用关闭时清理监视器
    app.on('before-quit', () => {
        watcher.close();
        delete activeWatchers[dirPath];  // 移除已经关闭的监听器
    });
});

// 选择目录处理
ipcMain.handle('getDirectoryDialog', async () => {
    try {
        return await dialog.showOpenDialog({ properties: ['openDirectory'] });
    } catch (err) {
        console.error('打开目录选择对话框时出错:', err);
        throw new Error('打开目录选择对话框失败。');
    }
});

// 获取目录结构
ipcMain.handle('getDirectoryStructure', async (event, dirPath) => {
    const buildDirectoryStructure = async (directoryPath) => {
        const stats = await fs.stat(directoryPath);
        const item = {
            title: path.basename(directoryPath),
            type: stats.isDirectory() ? 'folder' : 'file',
            key: directoryPath,
            created: stats.birthtime,
            modified: stats.mtime,
            children: []
        };

        if (stats.isDirectory()) {
            const files = await fs.readdir(directoryPath);
            item.children = await Promise.all(files.map(child => buildDirectoryStructure(path.join(directoryPath, child))));
        }

        return item;
    };

    try {
        return await buildDirectoryStructure(dirPath);
    } catch (err) {
        console.error("读取目录时出错:", err);
        return { error: "读取目录失败" };
    }
});

// 获取所有文本文件
ipcMain.handle('getAllTextFiles', async (event, dirPath, ignoredPatterns = '') => {
    const ignoredPatternsArray = ignoredPatterns.split(',').map(pattern => pattern.trim());
    const binaryFileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp3', '.mp4', '.zip', '.exe', '.pdf', '.docx'];

    const isBinaryFile = async (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (binaryFileExtensions.includes(ext)) return true;

        const data = await fs.readFile(filePath);
        return [...data.slice(0, 16)].some(charCode => charCode === 0 || (charCode < 32 && ![9, 10, 13].includes(charCode)));
    };

    const collectAllFiles = async (dirPath, arrayOfFiles = []) => {
        const files = await fs.readdir(dirPath);

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (ignoredPatternsArray.includes(path.basename(fullPath)) || file.startsWith('.')) continue;

            const stats = await fs.stat(fullPath);
            if (stats.size > 512000) continue;  // 继续过滤大文件

            if (stats.isDirectory()) {
                await collectAllFiles(fullPath, arrayOfFiles);
            } else if (!await isBinaryFile(fullPath)) {
                arrayOfFiles.push({ path: fullPath, size: stats.size, createdAt: stats.birthtime, modifiedAt: stats.mtime });
            }
        }

        return arrayOfFiles;
    };

    try {
        const files = await collectAllFiles(dirPath);
        return await Promise.all(files.map(async file => ({
            path: file.path,
            content: await fs.readFile(file.path, 'utf-8')
        })));
    } catch (err) {
        console.error("获取文件时出错:", err);
        return { error: "获取文件失败" };
    }
});

// 获取单个文件的内容
ipcMain.handle('getFileContent', async (event, filePath) => {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (err) {
        console.error(`读取文件 ${filePath} 时出错:`, err);
        return { error: `读取文件失败: ${err.message}` };
    }
});

// 替换文件内容
ipcMain.handle('replaceFileContent', async (event, filePath, newContent) => {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, newContent, 'utf-8');
        return { success: true, message: '文件替换成功' };
    } catch (err) {
        console.error(`替换文件 ${filePath} 时出错:`, err);
        return { success: false, message: `文件替换失败: ${err.message}` };
    }
});

// 使用 diff 替换文件内容
ipcMain.handle('applyPatchToFile', async (event, filePath, diffContent) => {
    try {
        const originalContent = await fs.readFile(filePath, 'utf-8');
        const patchedContent = applyPatch(originalContent, diffContent);
        await fs.writeFile(filePath, patchedContent, 'utf-8');
        return { success: true, message: '文件补丁应用成功' };
    } catch (err) {
        console.error(`应用补丁到文件 ${filePath} 时出错:`, err);
        return { success: false, message: `应用补丁失败: ${err.message}` };
    }
});