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
            <a-button type="primary" @click="testConnection(record)">测试连接</a-button>
          </a-space>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="isModalVisible" :title="modalType === 'add' ? '添加项目' : '更新项目'" :footer="null" :width="600">
      <ProjectForm v-if="isModalVisible" ref="projectFormRef" :initialValues="currentProject" :mode="modalType"
                   @onCancel="handleCancel"/>
    </a-modal>
  </a-layout-content>
</template>

<script>
import { ref, onMounted } from 'vue';
import ProjectForm from './ProjectForm.vue';
import { post } from '@/api';
import { message } from 'ant-design-vue';

export default {
  components: {
    ProjectForm
  },
  setup() {
    const projects = ref([]);
    const isModalVisible = ref(false);
    const currentProject = ref({});
    const modalType = ref('add');

    const columns = [
      {title: '项目名称', dataIndex: 'projectName', align: 'center'},
      {title: '项目目录', dataIndex: 'projectPath', align: 'center'},
      {title: '项目描述', dataIndex: 'projectDescription', align: 'center'},
      {title: '操作', dataIndex: 'action', align: 'center'}
    ];

    const loadProjects = async () => {
      const res = await post('/project/getAll');
      if (res && res.success) {
        projects.value = res.data;
      }
    };

    onMounted(loadProjects);

    function showModal(type, project = {}) {
      modalType.value = type;
      currentProject.value = {...project};
      isModalVisible.value = true;
    }

    function handleCancel() {
      isModalVisible.value = false;
      currentProject.value = {};
      loadProjects();
    }

    async function deleteProject(projectId) {
      await post('/project/delete', {projectId: projectId});
      loadProjects();
    }

    async function testConnection(project) {
      const res = await post('/project/testConnection', project);
      if (res && res.success) {
        message.success('连接成功');
      } else {
        message.error('连接失败');
      }
    }

    return {
      columns,
      projects,
      isModalVisible,
      showModal,
      handleCancel,
      deleteProject,
      testConnection,
      currentProject,
      modalType,
    };
  }
};
</script>

<style scoped>
</style>
