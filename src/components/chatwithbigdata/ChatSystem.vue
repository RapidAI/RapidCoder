<template>
  <div>
    <a-tree
        :treeData="treeData"
        checkable
        @check="onCheck"
        :checkedKeys="checkedKeys"
        :defaultExpandAll="false"
        :showLine="{ showLeafIcon: false }"
    >
      <template #title="{ data }">
        <div class="custom-tree-node">
          <span>{{ data.title }}</span>
          <button
              v-if="data.type === 'file'"
              @click.stop="updateFileAnalysis(data)"
              class="update-button"
          >
            更新
          </button>
        </div>
      </template>
    </a-tree>
  </div>
</template>

<script>
import {ref, watch, computed} from 'vue';
import {useMessageStore} from '@/store/MessageStore.js';
import {useModelStore} from '@/store/ModelStore.js';
import {message} from 'ant-design-vue';

const {ipcRenderer} = require('electron');

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const messageStore = useMessageStore();
    const modelStore = useModelStore();

    const treeData = ref([]);
    const checkedKeys = ref([]);

    const currentSession = computed(() =>
        messageStore.sessions.find(
            (session) => session.sessionId === props.selectedSessionId
        ) || null
    );

    const formatTreeData = () => {
      const content = currentSession.value?.messages[0]?.content;
      if (!content) return console.error('内容不存在');

      const match = content.match(/```json\n([\s\S]*?)\n```/);
      if (!match) return console.error('未找到 JSON 数据');

      let jsonData;
      try {
        jsonData = JSON.parse(match[1]);
      } catch (e) {
        return console.error('JSON 解析错误:', e);
      }

      if (!Array.isArray(jsonData))
        return console.error('JSON 数据不是数组');

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
            title: `项目ID: ${project.projectId}`,
            key: `project-${index}-id`,
          },
          {
            title: '项目文件详情',
            key: `project-${index}-fileDetails`,
            children: Object.keys(project.projectFileDetails || {}).map(
                (filePath) => ({
                  title: filePath,
                  key: `project-${index}-file-${filePath}`,
                  type: 'file', // 添加类型标识
                  projectId: project.projectId, // 存储项目ID
                  path: filePath, // 存储文件路径
                  projectPath: project.projectPath, // 存储项目路径
                })
            ),
          },
        ],
      }));
    };

    watch(currentSession, formatTreeData, {immediate: true});

    const onCheck = (checkedKeysValue) => {
      checkedKeys.value = checkedKeysValue;
    };

    const updateFileAnalysis = async (nodeData) => {
      const model = currentSession.value?.currentModel;

      // 读取文件内容
      const fileContent = await ipcRenderer.invoke(
          'get-one-file',
          nodeData.path
      );

      // 调用AI模型进行解析
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
            content: buildPrompt(nodeData.path, fileContent),
          },
        ],
      });

      if (res) {
        const analysisResult = extractJsonFromResponse(res.content);

        // 更新项目的 projectFileDetails
        updateProjectFileDetails(
            nodeData.projectId,
            nodeData.path,
            analysisResult
        );

        message.success('文件解析成功');
      } else {
        throw new Error('AI解析失败');
      }
    };

    const buildPrompt = (filePath, fileContent) => `
### ${filePath}
\`\`\`
${fileContent}
\`\`\`
要求详细说明文件的功能和与其他文件的关联关系，输出标准的json，格式如下:
{
  "${filePath}": {
    "components": ["...",],
    "external": ["...",],
    "comment": "中文解释...",
    "functions": {
      "函数名字": "函数解释",
      ...
    }
  }
}
`;

    const extractJsonFromResponse = (response) => {
      try {
        const match = response.match(/```json\n([\s\S]*?)\n```/);
        return match ? JSON.parse(match[1]) : null;
      } catch (error) {
        console.error('解析JSON失败:', error);
        return null;
      }
    };

    const updateProjectFileDetails = (projectId, filePath, analysisResult) => {
      // 更新对应项目的 projectFileDetails
      const content = currentSession.value?.messages[0]?.content;
      if (!content) return;

      let jsonData;
      try {
        const match = content.match(/```json\n([\s\S]*?)\n```/);
        jsonData = match ? JSON.parse(match[1]) : null;
      } catch (e) {
        console.error('JSON 解析错误:', e);
        return;
      }

      const projectIndex = jsonData.findIndex(
          (proj) => proj.projectId === projectId
      );
      if (projectIndex === -1) return;

      // 更新 projectFileDetails
      jsonData[projectIndex].projectFileDetails[filePath] =
          analysisResult[filePath];

      // 更新 messageStore 中的内容（假设有 updateMessageContent 方法）
      const updatedContent = `\`\`\`json\n${JSON.stringify(
          jsonData,
          null,
          2
      )}\n\`\`\``;

      messageStore.updateMessageContent(
          currentSession.value.sessionId,
          updatedContent
      );

      // 重新刷新树形数据
      formatTreeData();
    };

    return {
      treeData,
      checkedKeys,
      onCheck,
      updateFileAnalysis,
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

.update-button {
  margin-left: 8px;
}
</style>
