<template>
  <div>
    <a-tree
        :treeData="treeData"
        checkable
        @check="checkedKeys = $event"
        :checkedKeys="checkedKeys"
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
          <custom-loading v-if="data.isAnalyzing" tip="AI解析中..." />
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
    selectedSessionId: {
      required: true,
    },
  },
  components: {
    CustomLoading,
  },
  setup(props) {
    const messageStore = useSessionStore();
    const modelStore = useModelStore();

    const treeData = ref([]);
    const checkedKeys = ref([]);

    const currentSession = computed(() =>
        messageStore.sessions.find(
            (session) => session.sessionId === props.selectedSessionId
        ) || null
    );

    const parseSessionContent = () => {
      const content = currentSession.value?.messages[0]?.content || '';
      const match = content.match(/```json\n([\s\S]*?)\n```/);
      return match ? JSON.parse(match[1]) : null;
    };

    const formatTreeData = () => {
      const jsonData = parseSessionContent();
      if (!Array.isArray(jsonData)) {
        console.error('JSON 数据错误');
        return;
      }

      treeData.value = jsonData.map((project, index) => ({
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
            children: Object.keys(project.projectFileDetails || {}).map(
                (filePath) => ({
                  title: filePath,
                  key: `project-${index}-file-${filePath}`,
                  type: 'file',
                  projectId: project.projectId,
                  path: filePath,
                  isAnalyzing: false,
                })
            ),
          },
        ],
      }));
    };

    watch(currentSession, formatTreeData, { immediate: true });

    const updateProjectFileDetails = (nodeData, newData, isDelete = false) => {
      const jsonData = parseSessionContent();
      if (!jsonData) return;

      const project = jsonData.find(
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
          jsonData,
          null,
          2
      )}\n\`\`\``;
      formatTreeData();
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

    return {
      treeData,
      checkedKeys,
      updateFileAnalysis,
      deleteFile,
    };
  },
};
</script>

<style scoped>
.ant-tree {
  background: #f5f5f5;
  padding: 20px;
}

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
