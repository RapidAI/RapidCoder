<template>
  <div>
    <a-directory-tree
        :treeData="treeData"
        :defaultExpandAll="false"
        :checkable="false"
        :selectable="true"
        :multiple="true"
        :showLine="false"
        :selectedKeys="currentSession.currentSelectNode"
        @select="onSelect"
    >
      <template #title="{ data }">
        <span>{{ data.title }}</span>
        <div class="tree-node-buttons">
          <a-button size="small"
                    v-if="data.type === 'file' && !isAnalyzing(data.key)"
                    @click.stop="analyzeNode(data)">
            更新
          </a-button>
          <a-button size="small"
                    v-if="data.type === 'folder' && !isAnalyzing(data.key)"
                    @click.stop="analyzeNode(data)">
            更新目录
          </a-button>
          <a-button size="small"
                    v-if="!isAnalyzing(data.key)"
                    @click.stop="deleteItem(data)">
            删除
          </a-button>
        </div>
        <custom-loading v-if="isAnalyzing(data.key)"/>
      </template>
    </a-directory-tree>
  </div>
</template>


<script>
import {reactive, computed, ref} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import {useModelStore} from '@/store/ModelStore.js';
import {useProjectStore} from '@/store/ProjectStore.js';
import {message} from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  components: {CustomLoading},
  setup(props) {
    const analyzingStates = reactive(new Map());
    const sessionStore = useSessionStore();
    const modelStore = useModelStore();
    const projectStore = useProjectStore();

    const currentSession = computed(() =>
        sessionStore.sessions.find(session => session.sessionId === props.selectedSessionId) || null
    );

    const treeData = computed(() => {
      const buildTreeFromPaths = (projectFileDetails) => {
        const root = [];
        const filePaths = Object.keys(projectFileDetails);
        filePaths.forEach(filePath => {
          const pathParts = filePath.split('/');
          let currentLevel = root;
          let nodePath = '';
          pathParts.forEach((part, idx) => {
            if (part) {
              nodePath = `${nodePath}/${part}`;
              let node = currentLevel.find(item => item.key === nodePath);
              if (!node) {
                const isFile = idx === pathParts.length - 1;
                node = {
                  title: part,
                  key: nodePath,
                  type: isFile ? 'file' : 'folder',
                  path: isFile ? filePath : nodePath,
                  fileDetails: isFile ? projectFileDetails[filePath] : '',
                  children: []
                };
                currentLevel.push(node);
              }
              currentLevel = node.children;
            }
          });
        });
        return root;
      };

      const optimizeTree = nodes => nodes.map(node => {
        if (node.type === 'folder') {
          while (node.children.length === 1 && node.children[0].type === 'folder') {
            const child = node.children[0];
            node.title = `${node.title}/${child.title}`;
            node.key = child.key;
            node.children = child.children;
          }
          node.children = optimizeTree(node.children);
        }
        return node;
      });

      return projectStore.projects
          .filter(project => currentSession.value.currentProjectsId.includes(project.projectId))
          .map((project, index) => {
            return {
              title: project.projectDescription,
              key: project.projectId,
              children: optimizeTree(buildTreeFromPaths(project.projectFileDetails)),
            };
          });
    });

    const isAnalyzing = (key) => analyzingStates.get(key);

    const buildPrompt = (nodeData, content) => `
### ${nodeData.path}
\`\`\`
${content}
\`\`\`
要求详细说明文件的功能和与其他文件的关联关系，输出标准的json格式。`;

    const analyzeNode = async (nodeData) => {
      analyzingStates.set(nodeData.key, true);
      nodeData.isAnalyzing = true;
      const model = currentSession.value?.currentModel;

      try {
        const content = nodeData.type === 'file'
            ? await ipcRenderer.invoke('get-one-file', nodeData.path)
            : await ipcRenderer.invoke('get-all-files', nodeData.path, 'node_modules,assets,dist,package-lock.json');

        const prompt = buildPrompt(nodeData, content);
        const res = await modelStore.chatCompletions({
          ...model,
          messages: [
            {role: 'system', content: '你是一个程序员，请根据给定的文件内容生成详细的文件关联说明，输出标准的json格式。'},
            {role: 'user', content: prompt},
          ],
        });

        const analysisResult = extractJsonFromResponse(res.content);
        if (!analysisResult) throw new Error('解析AI响应失败');
        message.success(`${nodeData.type === 'file' ? '文件' : '目录'}解析成功`);
      } catch (error) {
        console.error(error);
        message.error(`${nodeData.type === 'file' ? '文件' : '目录'}解析失败`);
      } finally {
        nodeData.isAnalyzing = false;
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
        nodeData.children.forEach(childNode => deleteItem(childNode));
      }
      // 从treeData中删除节点
      updateProjectFileDetails(nodeData, null, true);
    };

    const updateProjectFileDetails = (nodeData, newDetails = null, isDelete = false) => {
      const project = projectStore.projects.find(project =>
          currentSession.value.currentProjectsId.includes(project.projectId) &&
          nodeData.path in project.projectFileDetails
      );
      if (!project) {
        message.error('无法找到相关项目');
        return;
      }
      const fileDetails = JSON.parse(JSON.stringify(project.projectFileDetails));
      if (isDelete) {
        delete fileDetails[nodeData.path];
      } else {
        fileDetails[nodeData.path] = newDetails;
      }
      project.projectFileDetails = fileDetails
      message.success(`${nodeData.title} 已${isDelete ? '删除' : '更新'}`);
    };


    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      const fileNodes = selectedNodes
          .filter(node => node.type === 'file');
      currentSession.value.currentSelectNode = fileNodes.map(node => node.key);
      const fileNodeDetails = fileNodes
          .map(({title, key, type, children, ...rest}) => rest);
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
    };
  },
};
</script>
<style scoped>
.tree-node-buttons {
  display: none; /* 默认隐藏按钮 */
}

.ant-tree-treenode:hover .tree-node-buttons {
  display: inline-block; /* 鼠标悬停整个节点时显示按钮 */
}
</style>
