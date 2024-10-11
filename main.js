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
            name: path.basename(filePath),
            path: filePath,
            type: stats.isDirectory() ? 'folder' : 'file',
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    } catch (err) {
        console.error(`Error fetching file stats for ${filePath}:`, err);
        throw new Error(`Error fetching file stats: ${err.message}`);
    }
};

// 选择目录处理
ipcMain.handle('getDirectoryDialog', async () => {
    try {
        return await dialog.showOpenDialog({ properties: ['openDirectory'] });
    } catch (err) {
        console.error('Error opening directory dialog:', err);
        throw new Error('Failed to open directory dialog.');
    }
});

// 监听文件夹变化
ipcMain.handle('initDirectoryWatch', (event, dirPath) => {
    const watcher = chokidar.watch(dirPath, { persistent: true, ignoreInitial: true });

    const sendFileDetails = async (filePath, action) => {
        try {
            const fileInfo = await getFileStats(filePath);
            event.sender.send('fileEvent', { action, fileInfo });
        } catch (err) {
            console.error('Error processing file change event:', err);
        }
    };

    watcher.on('add', filePath => sendFileDetails(filePath, 'added'));
    watcher.on('change', filePath => sendFileDetails(filePath, 'modified'));
    watcher.on('unlink', filePath => sendFileDetails(filePath, 'deleted'));

    // 确保应用关闭时清理监视器
    app.on('before-quit', () => watcher.close());
});

// 获取目录结构
ipcMain.handle('getDirectoryStructure', async (event, dirPath) => {
    const buildDirectoryStructure = async (directoryPath) => {
        const stats = await fs.stat(directoryPath);
        const item = {
            name: path.basename(directoryPath),
            type: stats.isDirectory() ? 'folder' : 'file',
            path: directoryPath,
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
        console.error("Error reading directory:", err);
        return { error: "Failed to read directory" };
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
        console.error("Error fetching files:", err);
        return { error: "Failed to fetch files" };
    }
});

// 获取单个文件的内容
ipcMain.handle('getFileContent', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        return {
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            content
        };
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
        return { error: `Failed to read file: ${err.message}` };
    }
});

// 替换文件内容
ipcMain.handle('replaceFileContent', async (event, filePath, newContent) => {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, newContent, 'utf-8');
        return { success: true, message: 'File successfully replaced' };
    } catch (err) {
        console.error(`Error replacing file ${filePath}:`, err);
        return { success: false, message: `Failed to replace file: ${err.message}` };
    }
});

// 使用 diff 替换文件内容
ipcMain.handle('applyPatchToFile', async (event, filePath, diffContent) => {
    try {
        const originalContent = await fs.readFile(filePath, 'utf-8');
        const patchedContent = applyPatch(originalContent, diffContent);
        await fs.writeFile(filePath, patchedContent, 'utf-8');
        return { success: true, message: 'File successfully updated with patch' };
    } catch (err) {
        console.error(`Error applying patch to file ${filePath}:`, err);
        return { success: false, message: `Failed to apply patch: ${err.message}` };
    }
});