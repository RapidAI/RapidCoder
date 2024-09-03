// ProjectStore.js

import { defineStore } from 'pinia';

export const useProjectStore = defineStore('project', {
    state: () => ({
        projects: [],
    }),
    actions: {
        // 模拟从本地加载项目数据
        loadProjects() {
            // 在这里可以初始化一些默认项目数据
            // 例如：this.projects = JSON.parse(localStorage.getItem('projects')) || [];
        },
        addProject(project) {
            project.projectId = Date.now(); // 生成简单的唯一ID
            this.projects.push(project);
        },
        updateProject(updatedProject) {
            const index = this.projects.findIndex(project => project.projectId === updatedProject.projectId);
            if (index !== -1) {
                this.projects[index] = updatedProject;
            }
        },
        deleteProject(projectId) {
            this.projects = this.projects.filter(project => project.projectId !== projectId);
        },
        testConnection(project) {
            // 模拟测试连接的逻辑，这里直接返回 true 表示成功
            return true; // 或者根据条件返回 false
        },
        getProjectById(projectId) {
            return this.projects.find(project => project.projectId === projectId) || {};
        },
    },
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'project_store',
                storage: localStorage, // 或者 sessionStorage
            },
        ],
    },
});
