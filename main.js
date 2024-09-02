// electron 的配置
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// 初始化数据库
let db;

// 创建窗口函数
function createWindow () {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 指定预加载脚本
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173'); // Vite开发服务器的地址
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'dist/index.html')); // 加载生产环境下的HTML文件
    }

    // 打开数据库并创建表
    db = new Database(path.join(app.getPath('userData'), 'database.db'));
    db.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)').run();
}

// 当应用准备好时创建窗口
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 关闭所有窗口时退出应用（除非在macOS上）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 在应用退出前关闭数据库连接
app.on('before-quit', () => {
    if (db) {
        db.close();
    }
});

// 处理从渲染进程来的请求
ipcMain.handle('get-users', async (event) => {
    try {
        const stmt = db.prepare('SELECT * FROM users');
        return stmt.all(); // 返回所有用户
    } catch (error) {
        console.error('Failed to get users:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('add-user', async (event, user) => {
    try {
        const stmt = db.prepare('INSERT INTO users (name, age) VALUES (?, ?)');
        stmt.run(user.name, user.age);
        return { success: true };
    } catch (error) {
        console.error('Failed to add user:', error);
        return { success: false, error: error.message };
    }
});
