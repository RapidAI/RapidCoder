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

// 监控目录
const activeWatchers = {};  // 存储监听器及其关联的多个ID

ipcMain.handle('initDirectoryWatch', (event, dirPath, id) => {
    if (!activeWatchers[dirPath]) {
        const watcher = chokidar.watch(dirPath, {
            persistent: true,
            ignoreInitial: true,
            ignored: [/(^|[\/\\])\../, '**/node_modules/**']
        });
        activeWatchers[dirPath] = {watcher, ids: new Set()};

        watcher.on('add', filePath => event.sender.send(dirPath, {
            action: 'add',
            fileInfo: {title: path.basename(filePath), key: filePath, type: 'file'}
        }));
        watcher.on('change', filePath => event.sender.send(dirPath, {
            action: 'change',
            fileInfo: {title: path.basename(filePath), key: filePath, type: 'file'}
        }));
        watcher.on('unlink', filePath => event.sender.send(dirPath, {
            action: 'unlink',
            fileInfo: {title: path.basename(filePath), key: filePath, type: 'file'}
        }));
        watcher.on('addDir', dirPath => event.sender.send(dirPath, {
            action: 'addDir',
            fileInfo: {title: path.basename(filePath), key: dirPath, type: 'folder'}
        }));
        watcher.on('unlinkDir', dirPath => event.sender.send(dirPath, {
            action: 'unlinkDir',
            fileInfo: {title: path.basename(filePath), key: dirPath, type: 'folder'}
        }));
    }

    activeWatchers[dirPath].ids.add(id);
});
// 移除目录监控
ipcMain.handle('removeDirectoryWatch', (event, dirPath, id) => {
    const watcherData = activeWatchers[dirPath];
    if (watcherData) {
        watcherData.ids.delete(id);
        if (watcherData.ids.size === 0) {
            watcherData.watcher.close();
            delete activeWatchers[dirPath];
        }
    }
});

// 监控文件
const activeFileWatchers = {};  // 存储文件监听器及其关联的多个ID

// 初始化文件监控
ipcMain.handle('initFileWatch', (event, filePath, id) => {
    if (!activeFileWatchers[filePath]) {
        const watcher = chokidar.watch(filePath, {persistent: true, ignoreInitial: true});
        activeFileWatchers[filePath] = {watcher, ids: new Set()};

        watcher.on('change', (filePath) => event.sender.send(filePath, {
            action: 'change',
            fileInfo: {key: filePath, type: 'file'}
        }));
        watcher.on('unlink', (filePath) => {
            event.sender.send(filePath, {action: 'unlink', fileInfo: {key: filePath, type: 'file'}});
            // 如果文件被删除了，自动移除监控
            activeFileWatchers[filePath].ids.delete(id);
            if (activeFileWatchers[filePath].ids.size === 0) {
                watcher.close();
                delete activeFileWatchers[filePath];
            }
        });
    }

    // 将ID关联到这个文件监控
    activeFileWatchers[filePath].ids.add(id);
});

// 移除文件监控
ipcMain.handle('removeFileWatch', (event, filePath, id) => {
    const watcherData = activeFileWatchers[filePath];
    if (watcherData) {
        watcherData.ids.delete(id);
        if (watcherData.ids.size === 0) {
            watcherData.watcher.close();
            delete activeFileWatchers[filePath];
        }
    }
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
            if (path.basename(directoryPath) === 'node_modules') {
                return item;
            }
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
ipcMain.handle('saveFileContent', async (event, filePath, newContent) => {
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
// 终端
const {spawn} = require('child_process');
ipcMain.on('execute-command', (event, command, args, cwd) => {
    const child = spawn(command, args, {cwd: cwd || process.cwd(), shell: true});
    child.stdout.on('data', (data) => {
        event.reply('command-output', data.toString());
    });
    child.stderr.on('data', (data) => {
        event.reply('command-output', `Error: ${data.toString()}`);
    });
    child.on('error', (error) => {
        event.reply('command-output', `Failed to start command: ${error.message}`);
    });
    child.on('close', (code) => {
        event.reply('command-output', '');
    });
});
ipcMain.handle("resolve-path", (event, currentDirectory, target) => {
    try {
        const newPath = path.resolve(currentDirectory, target);
        return newPath;
    } catch (error) {
        throw new Error("Failed to resolve path");
    }
});
// 创建目录
ipcMain.handle('createDirectory', async (event, dirPath) => {
    await fs.mkdir(dirPath, {recursive: true});
    return {success: true, message: '目录创建成功'};
});

// 创建文件
ipcMain.handle('createFile', async (event, filePath) => {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, '', 'utf-8');
    return {success: true, message: '文件创建成功'};
});
