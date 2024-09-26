<template>
  <div>
    <a-tree
        :treeData="treeData"
        :defaultExpandAll="true"
        :checkable="true"
        :selectable="false"
        :checkedKeys="currentSession.currentSelectNode"
        :showLine="{ showLeafIcon: false }"
        @check="onCheck"
    >
      <template #title="{ data }">
        <div class="custom-tree-node">
          <span>{{ data.title }}</span>
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
          <custom-loading v-if="isAnalyzing(data.key)"/>
        </div>
      </template>
    </a-tree>
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
        ;
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

    const buildPrompt = (nodeData, content) => `
### ${nodeData.path}
\`\`\`
${content}
\`\`\`
要求详细说明文件的功能和与其他文件的关联关系，输出标准的json格式。`;


    const deleteItem = (nodeData) => {
      try {
        const deleteRecursively = (nodes) => {
          nodes.forEach(node => {
            if (node.type === 'folder') deleteRecursively(node.children);
            deleteFile(node);
          });
        };
        if (nodeData.type === 'folder') deleteRecursively(nodeData.children);
        else deleteFile(nodeData);
      } catch (error) {
        console.error(error);
        message.error('删除失败');
      }
    };

    const deleteFile = (nodeData) => {
      try {
        updateProjectFileDetails(nodeData, null, true);
        message.success('文件已删除');
      } catch (error) {
        console.error(error);
        message.error('文件删除失败');
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

    const isAnalyzing = (key) => analyzingStates.get(key);

    const onCheck = (checkedKeysValue, {checkedNodes}) => {
      currentSession.value.currentSelectNode = checkedKeysValue;
      currentSession.value.messages[0].content=`\`\`\`json\n${JSON.stringify(checkedNodes, null, 2)}\n\`\`\``
    };

    return {
      treeData,
      analyzeNode,
      deleteItem,
      currentSession,
      analyzingStates,
      isAnalyzing,
      onCheck,
    };
  },
};
</script>
