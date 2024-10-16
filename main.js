const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs').promises;  // 使用 fs.promises 进行异步操作
const {applyPatch} = require('diff');
const chokidar = require('chokidar');

// 创建窗口
const initMainWindow = () => {
    const win = new BrowserWindow({
        width: 1600,
        height: 1200,
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
    const stats = await fs.stat(filePath);
    return {
        title: path.basename(filePath),
        key: filePath,
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
    };
};
// 监听文件夹变化
const activeWatchers = {};  // 用来存储已经监听的目录
ipcMain.handle('initDirectoryWatch', (event, dirPath) => {
    if (activeWatchers[dirPath]) {
        console.log(`目录 ${dirPath} 已经在监听中。`);
        return;
    }

    const watcher = chokidar.watch(dirPath, {persistent: true, ignoreInitial: true});
    activeWatchers[dirPath] = watcher;  // 记录当前监听的目录

    const sendFileDetails = async (filePath, action, type) => {
        try {
            if (action === 'unlink' || action === 'unlinkDir') {
                event.sender.send(dirPath, {action, fileInfo: {key: filePath, type}});
            } else {
                const fileInfo = await getFileStats(filePath);
                event.sender.send(dirPath, {action, fileInfo: {...fileInfo, type}});
            }
        } catch (err) {
            console.error(`处理文件/目录变更事件时出错: ${filePath}`, err);
        }
    };

    // 监控文件的增加、修改和删除
    watcher.on('add', filePath => sendFileDetails(filePath, 'add', 'file'));
    watcher.on('change', filePath => sendFileDetails(filePath, 'change', 'file'));
    watcher.on('unlink', filePath => sendFileDetails(filePath, 'unlink', 'file'));

    // 监控目录的增加和删除
    watcher.on('addDir', dirPath => sendFileDetails(dirPath, 'addDir', 'folder'));
    watcher.on('unlinkDir', dirPath => sendFileDetails(dirPath, 'unlinkDir', 'folder'));

    watcher.on('error', (error) => {
        console.error(`监控目录时发生错误: ${error}`);
        event.sender.send('watchError', {message: `监控目录时发生错误: ${error.message}`});
    });

    // 确保应用关闭时清理监视器
    app.on('before-quit', () => {
        watcher.close();
        delete activeWatchers[dirPath];  // 移除已经关闭的监听器
    });
});

// 选择目录处理
ipcMain.handle('getDirectoryDialog', async () => {
    return await dialog.showOpenDialog({properties: ['openDirectory']});
});

// 获取目录结构
ipcMain.handle('getDirectoryStructure', async (event, dirPath) => {
    const buildDirectoryStructure = async (directoryPath) => {
        const stats = await fs.stat(directoryPath);
        const item = {
            title: path.basename(directoryPath),
            type: stats.isDirectory() ? 'directory' : 'file',
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
    return await buildDirectoryStructure(dirPath);
});
// 获取单个文件的内容
ipcMain.handle('getFileContent', async (event, filePath) => {
    return await fs.readFile(filePath, 'utf-8');
});

// 替换文件内容
ipcMain.handle('replaceFileContent', async (event, filePath, newContent) => {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, newContent, 'utf-8');
    return {success: true, message: '文件替换成功'};
});

// 使用 diff 替换文件内容
ipcMain.handle('applyPatchToFile', async (event, filePath, diffContent) => {
    const originalContent = await fs.readFile(filePath, 'utf-8');
    const patchedContent = applyPatch(originalContent, diffContent);
    await fs.writeFile(filePath, patchedContent, 'utf-8');
    return {success: true, message: '文件补丁应用成功'};
});