<template>
  <div>
    <a-tree
        :treeData="treeData"
        :expandedKeys="expandedKeys"
        @expand="onExpand"
        :defaultExpandAll="false"
        :showLine="{ showLeafIcon: false }"
    >
      <template #title="{ data }">
        <div class="custom-tree-node">
          <span>{{ data.title }}</span>
          <button
              v-if="data.type === 'file' && !data.isAnalyzing"
              @click.stop="updateFileAnalysis(data)"
              class="action-button"
          >
            更新
          </button>
          <button
              v-if="data.type === 'file' && !data.isAnalyzing"
              @click.stop="deleteFile(data)"
              class="action-button"
          >
            删除
          </button>
          <custom-loading v-if="data.isAnalyzing" />
        </div>
      </template>
    </a-tree>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue';
import { useSessionStore } from '@/store/SessionStore.js';
import { useModelStore } from '@/store/ModelStore.js';
import { message } from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';
const { ipcRenderer } = require('electron');

export default {
  props: {
    selectedSessionId: { required: true },
  },
  components: { CustomLoading },
  setup(props) {
    const messageStore = useSessionStore();
    const modelStore = useModelStore();

    const expandedKeys = ref([]);
    const onExpand = (keys) => (expandedKeys.value = keys);

    const currentSession = computed(() =>
        messageStore.sessions.find(
            (session) => session.sessionId === props.selectedSessionId
        ) || null
    );

    const jsonData = ref(null);

    watch(
        () => currentSession.value?.messages[0]?.content,
        (newContent) => {
          const match = newContent.match(/```json\n([\s\S]*?)\n```/);
          jsonData.value = match ? JSON.parse(match[1]) : null;
        },
        { immediate: true }
    );

    const treeData = computed(() => {
      if (!Array.isArray(jsonData.value)) return [];
      return jsonData.value.map((project, index) => ({
        title: project.projectName || `项目${index + 1}`,
        key: `project-${project.projectId || index}`,
        children: [
          {
            title: `项目路径: ${project.projectPath}`,
            key: `project-${index}-path`,
          },
          {
            title: `项目描述: ${project.projectDescription}`,
            key: `project-${index}-description`,
          },
          {
            title: '项目文件',
            key: `project-${index}-fileDetails`,
            children: optimizeTree(
                buildTreeFromPaths(
                    Object.keys(project.projectFileDetails || {}),
                    project.projectId,
                    index
                )
            ),
          },
        ],
      }));
    });

    const buildTreeFromPaths = (filePaths, projectId) => {
      const root = [];
      filePaths.forEach((filePath) => {
        const pathParts = filePath.split('/');
        let currentLevel = root;
        let nodePath = '';
        pathParts.forEach((part, idx) => {
          nodePath = nodePath ? `${nodePath}/${part}` : part;
          let node = currentLevel.find((item) => item.key === nodePath);
          if (!node) {
            const isFile = idx === pathParts.length - 1;
            node = {
              title: part,
              key: nodePath,
              type: isFile ? 'file' : 'folder',
              projectId,
              path: isFile ? filePath : null,
              isAnalyzing: false,
              children: [],
            };
            currentLevel.push(node);
          }
          currentLevel = node.children;
        });
      });
      return root;
    };

    const optimizeTree = (nodes) =>
        nodes.map((node) => {
          if (node.type === 'folder') {
            while (
                node.children.length === 1 &&
                node.children[0].type === 'folder'
                ) {
              const child = node.children[0];
              node.title = `${node.title}/${child.title}`;
              node.key = child.key;
              node.children = child.children;
            }
            node.children = optimizeTree(node.children);
          }
          return node;
        });

    const updateProjectFileDetails = (nodeData, newData, isDelete = false) => {
      if (!jsonData.value) return;
      const project = jsonData.value.find(
          (proj) => proj.projectId === nodeData.projectId
      );
      if (!project) return;
      if (isDelete) {
        delete project.projectFileDetails[nodeData.path];
      } else {
        project.projectFileDetails[nodeData.path] =
            newData[nodeData.path] || {};
      }
      currentSession.value.messages[0].content = `\`\`\`json\n${JSON.stringify(
          jsonData.value,
          null,
          2
      )}\n\`\`\``;
    };

    const updateFileAnalysis = async (nodeData) => {
      nodeData.isAnalyzing = true;
      try {
        const model = currentSession.value?.currentModel;
        const fileContent = await ipcRenderer.invoke(
            'get-one-file',
            nodeData.path
        );

        const prompt = `
### ${nodeData.path}
\`\`\`
${fileContent}
\`\`\`
要求详细说明文件的功能和与其他文件的关联关系，输出标准的json，格式如下:
{
  "${nodeData.path}": {
    "components": ["..."],
    "external": ["..."],
    "comment": "中文解释...",
    "functions": {
      "函数名字": "函数解释",
      "...": "..."
    }
  }
}
`;

        const res = await modelStore.chatCompletions({
          ...model,
          messages: [
            {
              role: 'system',
              content:
                  '你是一个程序员，请根据给定的文件内容生成详细的文件关联说明，输出标准的json格式。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const analysisResult = extractJsonFromResponse(res.content);
        if (!analysisResult) throw new Error('解析AI响应失败');

        updateProjectFileDetails(nodeData, analysisResult);
        message.success('文件解析成功');
      } catch (error) {
        console.error(error);
        message.error('文件解析失败');
      } finally {
        nodeData.isAnalyzing = false;
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

    watch(
        treeData,
        (newTreeData) => {
          const collectKeys = (nodes) => {
            let keys = [];
            nodes.forEach((node) => {
              if (node.children && node.children.length > 0) {
                keys.push(node.key);
                keys = keys.concat(collectKeys(node.children));
              }
            });
            return keys;
          };
          expandedKeys.value = collectKeys(newTreeData);
        },
        { immediate: true }
    );

    return {
      treeData,
      updateFileAnalysis,
      deleteFile,
      expandedKeys,
      onExpand,
    };
  },
};
</script>

<style scoped>
.custom-tree-node {
  display: flex;
  align-items: center;
}
.action-button {
  margin-left: 8px;
}
.custom-loading {
  margin-left: 8px;
}
</style>
