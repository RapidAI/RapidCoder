const { contextBridge, ipcRenderer } = require('electron');

// 使用 contextBridge 来暴露 API 到渲染进程
contextBridge.exposeInMainWorld('api', {
    // 获取所有用户
    getUsers: () => ipcRenderer.invoke('get-users'),

    // 添加一个新用户
    addUser: (user) => ipcRenderer.invoke('add-user', user),

    // 还可以添加其他的API方法
    // 比如删除用户、更新用户等
    // deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
    // updateUser: (user) => ipcRenderer.invoke('update-user', user)
});
