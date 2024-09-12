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
        const fs = require('fs');
        const path = require('path');

        // 定义需要过滤掉的已知二进制文件扩展名
        const binaryFileExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.bmp',
            '.mp3', '.wav', '.flac', '.aac',
            '.mp4', '.mkv', '.avi', '.mov', '.wmv',
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.exe', '.dll', '.bin', '.iso',
            '.pdf', '.swf', '.rtf', '.docx', '.pptx'
        ];

        const isBinaryFile = (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (binaryFileExtensions.includes(ext)) return true;

            const data = fs.readFileSync(filePath);
            const sampleSize = Math.min(data.length, 16);
            for (let i = 0; i < sampleSize; i++) {
                const charCode = data[i];
                if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
                    return true;
                }
            }
            return false;
        };

        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            const fullPath = path.join(dirPath, file);

            // 使用 path.basename 检查是否需要忽略该文件或文件夹
            const isIgnored = ignoredPatternsArray.some(pattern => path.basename(fullPath) === pattern);
            if (isIgnored) return;

            if (file.startsWith('.')) return;

            const stats = fs.statSync(fullPath);

            if (stats.size > 512000) return;

            if (stats.isDirectory()) {
                getAllFiles(fullPath, arrayOfFiles);
            } else {
                if (isBinaryFile(fullPath)) return;

                arrayOfFiles.push({
                    path: fullPath,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime,
                });
            }
        });

        return arrayOfFiles;
    };

    const files = getAllFiles(dirPath);
    return files.map(file => ({
        path: file.path,
        content: fs.readFileSync(file.path, 'utf-8')
    }));
});
// 获取单个文件
ipcMain.handle('get-one-file', (event, filePath) => {
    const stats = fs.statSync(filePath);
    return {
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        content: fs.readFileSync(filePath, 'utf-8')
    };
});