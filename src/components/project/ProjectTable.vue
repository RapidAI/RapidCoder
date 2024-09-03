<template>
  <a-layout-content class="custom-content">
    <div class="header">
      <div class="title">项目管理</div>
      <a-button type="primary" @click="showModal('add')">添加项目</a-button>
    </div>
    <a-table :columns="columns" :dataSource="projects" :rowKey="record => record.projectId" class="custom-table">
      <template v-slot:bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="primary" @click="showModal('edit', record)">编辑</a-button>
            <a-popconfirm title="确定要删除这个项目吗？" okText="确定" cancelText="取消"
                          @confirm="() => deleteProject(record.projectId)">
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
    <a-modal v-model:open="isModalVisible" :title="modalType === 'add' ? '添加项目' : '更新项目'" :footer="null"
             :width="600">
      <ProjectForm v-if="isModalVisible" ref="projectFormRef" :initialValues="currentProject" :mode="modalType"
                   @onCancel="handleCancel"/>
    </a-modal>
    <a-modal v-model:open="isAnalyzeModalVisible" title="选择模型" okText="确定" cancelText="取消" @ok="handleAnalyze"
             @cancel="isAnalyzeModalVisible = false">
      <a-select v-model:value="selectedModelId" placeholder="请选择一个模型" :options="modelOptions"
                :allow-clear="true" @change="updateSelectedModel"/>
      <a-spin v-if="isAnalyzing" tip="AI解析中..."></a-spin>
    </a-modal>
  </a-layout-content>
</template>
<script>
import {ref, onMounted} from 'vue';
import {useProjectStore} from '@/store/ProjectStore';
import { useModelStore } from '@/store/ModelStore';
import {post} from '@/api';
import ProjectForm from './ProjectForm.vue';
import {message} from 'ant-design-vue';

export default {
  components: {
    ProjectForm
  },
  setup() {
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
    const isModalVisible = ref(false);
    const isAnalyzeModalVisible = ref(false);
    const currentProject = ref({});
    const modalType = ref('add');
    const models = ref([]);
    const modelOptions = ref([]);
    const selectedModelId = ref(1);
    const isAnalyzing = ref(false);

    const columns = [
      {title: '项目名称', dataIndex: 'projectName', align: 'center'},
      {title: '项目目录', dataIndex: 'projectPath', align: 'center'},
      {title: '项目描述', dataIndex: 'projectDescription', align: 'center'},
      {title: '操作', dataIndex: 'action', align: 'center'}
    ];

    onMounted(() => {
      fetchModels();
    });

    function showModal(type, project = {}) {
      modalType.value = type;
      currentProject.value = {...project};
      isModalVisible.value = true;
    }

    function handleCancel() {
      isModalVisible.value = false;
      currentProject.value = {};
    }

    function deleteProject(projectId) {
      projectStore.deleteProject(projectId);
    }

    // 获取所有AI模型
    const fetchModels = async () => {
      try {
        modelOptions.value = modelStore.models.map(model => ({value: model.modelId, label: model.modelName}));
        selectedModelId.value = modelOptions.value[0]?.value || null;
      } catch (error) {
        console.error('获取AI模型失败:', error);
      }
    };

    // 更新选中的模型
    const updateSelectedModel = (value) => {
      selectedModelId.value = value;
    };

    // 打开AI解析模态框
    const openAnalyzeModal = (record) => {
      currentProject.value = record;
      isAnalyzeModalVisible.value = true;
    };

    // AI解析项目
    const handleAnalyze = async () => {
      if (selectedModelId.value == null) {
        return message.error('请选择一个模型');
      }

      isAnalyzing.value = true;

      try {
        const projectDetails = currentProject.value;
        const model = models.value.find(model => model.modelId === selectedModelId.value);

        let prompt = `请分析项目 "${projectDetails.projectName}" 的目录结构及描述信息，生成项目结构说明和总结。\n返回json数据结构\n`;
        prompt += `{\n`;
        prompt += `   analysis: "该项目的结构说明..."\n`;
        prompt += `   summary: "{作用:..., 项目结构: [{目录名:...,描述:...,表示:...}...]}"\n`;
        prompt += `}\n`;
        model.messages = [{role: 'system', content: projectDetails}, {role: 'user', content: prompt}]

        const res = await post('/chat/generatebyModel', model);
        if (res?.success) {
          currentProject.value.projectDescription = extractJsonFromResponse(res.data.content);
          const updateResponse = await post('/projects/update', currentProject.value);
          if (updateResponse?.success) {
            message.success('AI解析成功');
          }
        } else {
          message.error('AI解析失败');
        }
      } catch (error) {
        message.error(`AI解析失败: ${error.message}`);
      } finally {
        isAnalyzing.value = false;
        isAnalyzeModalVisible.value = false;
        selectedModelId.value = null;
      }
    };

    const extractJsonFromResponse = (response) => {
      try {
        // 匹配出 response 中的 JSON 部分
        const match = response.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          // 解析出 JSON 对象
          const jsonObject = JSON.parse(match[1]);
          return JSON.stringify(jsonObject.summary);
        } else {
          return null;
        }
      } catch (error) {
        console.error('解析JSON失败:', error);
        return null;
      }
    };

    return {
      columns,
      projects: projectStore.projects,
      isModalVisible,
      showModal,
      handleCancel,
      openAnalyzeModal,
      deleteProject,
      currentProject,
      modalType,
      isAnalyzeModalVisible,
      handleAnalyze,
      modelOptions,
      selectedModelId,
      updateSelectedModel,
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
