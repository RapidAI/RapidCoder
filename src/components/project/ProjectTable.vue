<template>
  <a-layout-content class="custom-content">
    <div class="header">
      <div class="title">项目管理</div>
      <a-button type="primary" @click="openModal('add')">添加项目</a-button>
    </div>
    <a-table :columns="columns" :dataSource="projects" :rowKey="record => record.projectId" class="custom-table">
      <template v-slot:bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="primary" @click="openModal('edit', record)">编辑</a-button>
            <a-popconfirm title="确定要删除这个项目吗？" okText="确定" cancelText="取消" @confirm="deleteProject(record.projectId)">
              <a-button type="primary">删除</a-button>
            </a-popconfirm>
            <a-button type="primary" @click="openAnalyzeModal(record)">AI解析</a-button>
          </a-space>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="isModalVisible" :title="modalTitle" :footer="null" :width="600">
      <ProjectForm ref="projectFormRef" :initialValues="currentProject" :mode="modalType" @onCancel="closeModal"/>
    </a-modal>

    <a-modal v-model:open="isAnalyzeModalVisible" title="选择模型" okText="确定" cancelText="取消" @ok="handleAnalyze" @cancel="closeAnalyzeModal">
      <a-select v-model:value="selectedModelId" placeholder="请选择一个模型" :options="modelOptions" allow-clear />
      <a-input v-model="ignorePatterns" placeholder="输入要忽略的文件/文件夹（使用逗号分隔）" style="margin-top: 10px;" />
      <a-spin v-if="isAnalyzing" tip="AI解析中..." />
    </a-modal>
  </a-layout-content>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useProjectStore } from '@/store/ProjectStore';
import { useModelStore } from '@/store/ModelStore';
import ProjectForm from './ProjectForm.vue';
import { message } from 'ant-design-vue';
const { ipcRenderer } = require('electron');
import path from 'path';

export default {
  components: { ProjectForm },
  setup() {
    const projectStore = useProjectStore();
    const modelStore = useModelStore();

    const isModalVisible = ref(false);
    const isAnalyzeModalVisible = ref(false);
    const currentProject = ref({});
    const modalType = ref('add');
    const modalTitle = ref('');
    const ignorePatterns = ref('');
    const modelOptions = ref([]);
    const selectedModelId = ref(null);
    const isAnalyzing = ref(false);

    const columns = [
      { title: '项目名称', dataIndex: 'projectName', align: 'center' },
      { title: '项目目录', dataIndex: 'projectPath', align: 'center' },
      { title: '项目描述', dataIndex: 'projectDescription', align: 'center' },
      { title: '操作', dataIndex: 'action', align: 'center' }
    ];


    const openModal = (type, project = {}) => {
      modalType.value = type;
      currentProject.value = { ...project };
      modalTitle.value = type === 'add' ? '添加项目' : '更新项目';
      isModalVisible.value = true;
    };

    const closeModal = () => {
      isModalVisible.value = false;
      currentProject.value = {};
    };

    const deleteProject = (projectId) => {
      projectStore.deleteProject(projectId);
    };

    const fetchModels = async () => {
      try {
        modelOptions.value = modelStore.models.map(({ modelId, modelName }) => ({
          value: modelId,
          label: modelName
        }));
        selectedModelId.value = modelOptions.value[0]?.value || null;
      } catch (error) {
        console.error('获取AI模型失败:', error);
      }
    };


    const closeAnalyzeModal = () => {
      isAnalyzeModalVisible.value = false;
      selectedModelId.value = null;
    };

    const openAnalyzeModal = (record) => {
      currentProject.value = record;
      isAnalyzeModalVisible.value = true;
      // 初始化忽略模式
      ignorePatterns.value = 'node_modules, dist, *.log';
    };

    const handleAnalyze = async () => {
      if (!selectedModelId.value) {
        return message.error('请选择一个模型');
      }

      isAnalyzing.value = true;

      try {
        // 将参数转换为 JSON 字符串
        const projectFiles = await ipcRenderer.invoke(
            'get-all-files',
            currentProject.value.projectPath,
            ignorePatterns.value
        );

        // 如果主进程返回的是 JSON 字符串，可以在这里解析
        const files = JSON.parse(projectFiles);

        const fileContents = files.map(file => ({
          path: file.path,
          content: file.content
        }));

        const model = modelStore.models.find(model => model.modelId === selectedModelId.value);
        console.log(buildPrompt(fileContents));

        // AI解析逻辑，保持不变
        // ...

      } catch (error) {
        console.error('Error during AI analysis:', error);
        message.error('AI解析失败');
      } finally {
        isAnalyzing.value = false;
        closeAnalyzeModal();
      }
    };


    // 递归获取所有文件路径
    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      const files = fs.readdirSync(dirPath);

      files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      });

      return arrayOfFiles;
    };

    const buildPrompt = (fileContents) => `
要求详细说明各个文件之间的关联关系,输出标准的json,格式如下:
".../...": {
  "components": ["package",],
  "external": ["...",],
  "comment": "中文解释...",
  "functions": {
    "函数名字": "函数解释",
    ...
  }
},...
${fileContents.map(file => `文件路径: ${file.path}\n内容:\n${file.content}`).join('\n')}
`;

    const extractJsonFromResponse = (response) => {
      try {
        const match = response.match(/```json\n([\s\S]*?)\n```/);
        return match ? JSON.stringify(JSON.parse(match[1]).summary) : null;
      } catch (error) {
        console.error('解析JSON失败:', error);
        return null;
      }
    };
    onMounted(fetchModels);

    return {
      columns,
      projects: projectStore.projects,
      isModalVisible,
      modalTitle,
      openModal,
      modalType,
      currentProject,
      closeModal,
      deleteProject,
      isAnalyzeModalVisible,
      openAnalyzeModal,
      ignorePatterns,
      closeAnalyzeModal,
      handleAnalyze,
      modelOptions,
      selectedModelId,
      isAnalyzing,
    };
  }
};
</script>


<style scoped>
.custom-content {
  padding: 24px;
  background: #fff;
}

.custom-table {
  margin-top: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 20px;
  font-weight: bold;
}
</style>
