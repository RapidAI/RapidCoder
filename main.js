const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),  // 这里指定了preload.js的路径
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 添加目录选择的事件处理
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    return result;
});

ipcMain.handle('get-all-files', (event, dirPath, ignoredPatterns = '') => {
    // 确保dirPath是字符串
    if (typeof dirPath !== 'string') {
        throw new Error('dirPath must be a string');
    }

    // 确保ignoredPatterns是字符串
    if (typeof ignoredPatterns !== 'string') {
        throw new Error('ignoredPatterns must be a string');
    }

    // 将ignoredPatterns字符串分割为数组
    const ignoredPatternsArray = ignoredPatterns.split(',').map(pattern => pattern.trim());

    const getAllFiles = (dirPath, arrayOfFiles = []) => {
        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            const fullPath = path.join(dirPath, file);

            // 检查是否需要忽略该文件或文件夹
            const isIgnored = ignoredPatternsArray.some(pattern => fullPath.includes(pattern));
            if (isIgnored) return;

            // 检查文件或文件夹是否以.开头
            if (file.startsWith('.')) return;

            if (fs.statSync(fullPath).isDirectory()) {
                getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        });

        return arrayOfFiles;
    };

    const files = getAllFiles(dirPath);
    return files.map(filePath => ({
        path: filePath,
        content: fs.readFileSync(filePath, 'utf-8')
    }));
});