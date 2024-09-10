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
        <template v-else-if="column.dataIndex === 'projectJSON'">
          <span>
            <a @click="showFullDescription(record)">点击查看</a>
          </span>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="isModalVisible" :title="modalTitle" :footer="null" :width="600">
      <ProjectForm ref="projectFormRef" :initialValues="modalType === 'add' ? {} : selectedProject" :mode="modalType" @onCancel="closeModal"/>
    </a-modal>

    <a-modal v-model:open="isAnalyzeModalVisible" title="选择模型" okText="确定" cancelText="取消" @ok="handleAnalyze" @cancel="closeAnalyzeModal">
      <a-form>
        <a-form-item label="项目目录">
          {{ selectedProject.projectPath }}
        </a-form-item>
        <a-form-item label="模型选择">
          <a-select v-model:value="selectedModelId" placeholder="请选择一个模型" :options="modelOptions" allow-clear/>
        </a-form-item>
        <a-form-item label="忽略文件">
          <a-input v-model:value="ignoredPatterns" placeholder="请输入需要忽略的文件或文件夹（用逗号分隔）"/>
        </a-form-item>
      </a-form>
      <a-spin v-if="isAnalyzing" tip="AI解析中..."/>
    </a-modal>

    <a-modal v-model:open="isDescriptionModalVisible" title="项目解析" :footer="null" :width="800">
      <div v-html="markdownDescription"></div>
    </a-modal>
  </a-layout-content>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useProjectStore } from '@/store/ProjectStore';
import { useModelStore } from '@/store/ModelStore';
import ProjectForm from './ProjectForm.vue';
import { message } from 'ant-design-vue';
import MarkdownIt from 'markdown-it';

const { ipcRenderer } = require('electron');

export default {
  components: { ProjectForm },
  setup() {
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
    const md = new MarkdownIt();

    const isModalVisible = ref(false);
    const isAnalyzeModalVisible = ref(false);
    const isDescriptionModalVisible = ref(false);
    const selectedProject = ref({});
    const modalType = ref('add');
    const modalTitle = ref('');
    const modelOptions = ref([]);
    const selectedModelId = ref(null);
    const isAnalyzing = ref(false);
    const ignoredPatterns = ref('node_modules,assets');
    const markdownDescription = ref('');

    const columns = [
      {
        title: '项目名称',
        dataIndex: 'projectName',
        align: 'center',
      },
      {title: '项目目录', dataIndex: 'projectPath', align: 'center'},
      {
        title: '项目描述',
        dataIndex: 'projectDescription',
        align: 'center',
      },
      {
        title: '项目解析',
        dataIndex: 'projectJSON',
        align: 'center',
        customCell: (record, rowIndex) => ({style: {cursor: 'pointer'}})
      },
      {title: '操作', dataIndex: 'action', align: 'center'}
    ];

    const openModal = (type, project = {}) => {
      modalType.value = type;
      selectedProject.value = {...project};
      modalTitle.value = type === 'add' ? '添加项目' : '更新项目';
      isModalVisible.value = true;
    };

    const closeModal = () => {
      isModalVisible.value = false;
      selectedProject.value = {};
    };

    const deleteProject = (projectId) => {
      projectStore.deleteProject(projectId);
    };

    const openAnalyzeModal = (record) => {
      selectedProject.value = record;
      isAnalyzeModalVisible.value = true;
      ignoredPatterns.value = 'node_modules,assets';
    };

    const closeAnalyzeModal = () => {
      isAnalyzeModalVisible.value = false;
    };

    const handleAnalyze = async () => {
      if (!selectedModelId.value) return message.error('请选择一个模型');
      isAnalyzing.value = true;
      console.log(selectedProject.value.projectPath, ignoredPatterns.value)
      const projectFiles = await ipcRenderer.invoke('get-all-files', selectedProject.value.projectPath, ignoredPatterns.value);
      console.log(projectFiles)
      const fileContents = projectFiles.map(file => ({path: file.path, content: file.content}));
      const model = modelStore.models.find(model => model.modelId === selectedModelId.value);

      const res = await modelStore.chatCompletions({
        ...model,
        messages: [
          {role: "system", content: "你是一个程序员，请根据给定的文件内容生成详细的文件关联说明，输出标准的json格式。"},
          {role: 'user', content: buildPrompt(fileContents)}
        ]
      });

      if (res) {
        selectedProject.value.projectJSON = extractJsonFromResponse(res.content);
        projectStore.updateProject(selectedProject.value);
        message.success('AI解析成功');
      } else {
        message.error('AI解析失败');
      }

      isAnalyzing.value = false;
      closeAnalyzeModal();
    };

    const buildPrompt = (fileContents) => `
${fileContents.map(file => `### ${file.path} \n\`\`\`\n${file.content}`).join('\n')}\`\`\`
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

    const showFullDescription = (project) => {
      markdownDescription.value = md.render(`\`\`\`json\n${JSON.stringify(project.projectJSON, null, 2)}\n\`\`\``);
      isDescriptionModalVisible.value = true;
    };

    onMounted(async () => {
      modelOptions.value = modelStore.models.map(({modelId, modelName}) => ({value: modelId, label: modelName}));
      selectedModelId.value = modelOptions.value[0]?.value || null;
    });

    return {
      columns,
      projects: projectStore.projects,
      isModalVisible,
      modalTitle,
      openModal,
      modalType,
      selectedProject,
      closeModal,
      deleteProject,
      isAnalyzeModalVisible,
      openAnalyzeModal,
      closeAnalyzeModal,
      handleAnalyze,
      ignoredPatterns,
      modelOptions,
      selectedModelId,
      isAnalyzing,
      showFullDescription,
      isDescriptionModalVisible,
      markdownDescription,
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