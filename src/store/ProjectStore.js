// ProjectStore.js

import { defineStore } from 'pinia';

export const useProjectStore = defineStore('project_store', {
    state: () => ({
        projects: [],
    }),
    actions: {
        addProject(project) {
            project.projectId = Date.now(); // 生成简单的唯一ID
            this.projects.push(project);
        },
        updateProject(updatedProject) {
            console.log(updatedProject)
            const index = this.projects.findIndex(project => project.projectId === updatedProject.projectId);
            if (index !== -1) {
                this.projects[index] = updatedProject;
            }
        },
        deleteProject(projectId) {
            this.projects = this.projects.filter(project => project.projectId !== projectId);
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
