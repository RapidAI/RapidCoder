<template>
  <div>
    <a-directory-tree
        :treeData="treeData"
        :checkable="false"
        :defaultExpandAll="true"
        :selectable="true"
        :multiple="true"
        :showLine="false"
        :selectedKeys="currentSession.currentSelectNode"
        @select="onSelect"
    >
      <template #title="{ data }">
        <a-dropdown :trigger="['contextmenu']">
          <span>{{ data.title }}</span>
          <template #overlay>
            <a-menu @click="({ key: menuKey }) => onContextMenuClick(data, menuKey)">
              <a-menu-item key="update">{{ data.type === 'file' ? '更新' : '更新目录' }}</a-menu-item>
              <a-menu-item key="delete">删除</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <custom-loading v-if="isAnalyzing(data.key)"/>
      </template>
    </a-directory-tree>
  </div>
</template>

<script>
import { reactive, computed } from 'vue';
import { useSessionStore } from '@/store/SessionStore.js';
import { useModelStore } from '@/store/ModelStore.js';
import { useProjectStore } from '@/store/ProjectStore.js';
import { message } from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';

const { ipcRenderer } = require('electron');

export default {
  props: { selectedSessionId: { required: true } },
  components: { CustomLoading },
  setup(props) {
    const analyzingStates = reactive(new Map());
    const sessionStore = useSessionStore();
    const modelStore = useModelStore();
    const projectStore = useProjectStore();

    const currentSession = computed(() =>
        sessionStore.sessions.find(session => session.sessionId === props.selectedSessionId) || null
    );

    const buildTree = (projectFileDetails) => {
      const root = [];
      Object.keys(projectFileDetails).forEach((path) => {
        const parts = path.split('/');
        let level = root, nodePath = '';
        parts.forEach((part, idx) => {
          if (!part) return; // 跳过空字符串
          nodePath = `${nodePath}/${part}`;
          let node = level.find(item => item.key === nodePath);
          if (!node) {
            node = {
              title: part,
              key: nodePath,
              type: idx === parts.length - 1 ? 'file' : 'folder',
              path: path,
              fileDetails: idx === parts.length - 1 ? projectFileDetails[path] : '',
              children: []
            };
            level.push(node);
          }
          level = node.children;
        });
      });
      return root;
    };

    const optimizeTree = (nodes) => nodes.map(node => {
      while (node.type === 'folder' && node.children.length === 1 && node.children[0].type === 'folder') {
        const child = node.children[0];
        node.title += `/${child.title}`;
        node.key = child.key;
        node.children = child.children;
      }
      node.children = optimizeTree(node.children);
      return node;
    });

    const treeData = computed(() =>
        projectStore.projects
            .filter(project => currentSession.value.currentProjectsId.includes(project.projectId))
            .map(project => ({
              title: project.projectDescription,
              key: project.projectId,
              children: optimizeTree(buildTree(project.projectFileDetails))
            }))
    );

    const isAnalyzing = (key) => analyzingStates.get(key);

    const analyzeNode = async (nodeData) => {
      analyzingStates.set(nodeData.key, true);
      const model = currentSession.value?.currentModel;
      try {
        const content = nodeData.type === 'file'
            ? await ipcRenderer.invoke('get-one-file', nodeData.path)
            : await ipcRenderer.invoke('get-all-files', nodeData.path, 'node_modules,assets,dist,package-lock.json');

        const prompt = `
### ${nodeData.path}
\`\`\`
${content}
\`\`\`
要求详细说明文件的功能和与其他文件的关联关系，输出标准的json格式。`;

        const res = await modelStore.chatCompletions({
          ...model,
          messages: [
            {role: 'system', content: '你是一个程序员，请根据给定的文件内容生成详细的文件关联说明，输出标准的json格式。'},
            {role: 'user', content: prompt}
          ]
        });

        const analysisResult = extractJsonFromResponse(res.content);
        if (!analysisResult) throw new Error('解析AI响应失败');
        message.success(`${nodeData.type === 'file' ? '文件' : '目录'}解析成功`);
      } catch (error) {
        console.error(error);
        message.error(`${nodeData.type === 'file' ? '文件' : '目录'}解析失败`);
      } finally {
        analyzingStates.set(nodeData.key, false);
      }
    };

    const extractJsonFromResponse = (response) => {
      try {
        const match = response.match(/```json\n([\s\S]*?)\n```/);
        return match ? JSON.parse(match[1]) : null;
      } catch {
        console.error('解析JSON失败');
        return null;
      }
    };

    const deleteItem = (nodeData) => {
      if (nodeData.type === 'folder') {
        return nodeData.children.forEach(deleteItem);
      }
      updateProjectFileDetails(nodeData, null, true);
    };

    const updateProjectFileDetails = (nodeData, newDetails = null, isDelete = false) => {
      const project = projectStore.projects.find(project =>
          currentSession.value.currentProjectsId.includes(project.projectId) &&
          nodeData.path in project.projectFileDetails
      );
      if (!project) {
        return message.error('无法找到相关项目');
      }

      const fileDetails = {...project.projectFileDetails};
      if (isDelete) delete fileDetails[nodeData.path];
      else fileDetails[nodeData.path] = newDetails;

      project.projectFileDetails = fileDetails;
      message.success(`${nodeData.title} 已${isDelete ? '删除' : '更新'}`);
    };

    const onContextMenuClick = (nodeData, menuKey) => {
      if (menuKey === 'update') {
        analyzeNode(nodeData);
      } else if (menuKey === 'delete') {
        deleteItem(nodeData);
      }
    };

    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      const fileNodes = selectedNodes.filter(node => node.type === 'file');
      currentSession.value.currentSelectNode = fileNodes.map(node => node.key);
      const fileNodeDetails = fileNodes.map(({title, key, type, children, ...rest}) => rest);
      currentSession.value.messages[0].content = `\`\`\`json\n${JSON.stringify(fileNodeDetails, null, 2)}\n\`\`\``;
    };

    return {
      treeData,
      analyzeNode,
      deleteItem,
      currentSession,
      analyzingStates,
      isAnalyzing,
      onSelect,
      onContextMenuClick
    };
  }
};
</script>

<style scoped>
:deep(.ant-tree-node-content-wrapper) {
  display: flex;
}

:deep(.ant-tree-directory) {
  position: absolute;
  height: 100%;
  width: 100%;
  background-color: #f5f5f5;
}


</style>
