<template>
  <a-layout-content class="custom-content">
    <div class="header">
      <div class="title">模型管理</div>
      <a-button type="text" @click="showModal('add')">添加模型</a-button>
    </div>
    <a-table :columns="columns" :dataSource="models" :rowKey="record => record.modelId" class="custom-table">
      <template v-slot:bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="text" @click="showModal('edit', record)">编辑</a-button>
            <a-popconfirm title="确定要删除这个模型吗？" okText="确定" cancelText="取消"
                          @confirm="() => deleteModel(record.modelId)">
              <a-button type="text">删除</a-button>
            </a-popconfirm>
            <a-button type="text" @click="testConnection(record)">测试连接</a-button>
          </a-space>
        </template>
        <template v-else-if="column.dataIndex === 'apiKey'">
  {{ record[column.dataIndex] ? record[column.dataIndex].slice(0, 4) + '****' + record[column.dataIndex].slice(-4) : '' }}
</template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>
    <a-modal :mask="false" v-model:open="isModalVisible" :title="modalType === 'add' ? '添加模型' : '更新模型'"
             :footer="null" :width="600">
      <ModelForm v-if="isModalVisible" ref="modelFormRef" :initialValues="currentModel" :mode="modalType"
                 @onCancel="handleCancel"/>
    </a-modal>
  </a-layout-content>
</template>

<script>
import {ref} from 'vue';
import {useModelStore} from '@/store/ModelStore';
import ModelForm from './ModelForm.vue';
import {message} from 'ant-design-vue';

export default {
  components: {
    ModelForm,
  },
  setup() {
    const modelStore = useModelStore();

    const isModalVisible = ref(false);
    const currentModel = ref({});
    const modalType = ref('add');

    const columns = [
      {title: '模型名称', dataIndex: 'model', align: 'center'},
      {title: 'baseUrl', dataIndex: 'baseUrl', align: 'center'},
      {title: 'API Key', dataIndex: 'apiKey', align: 'center'},
      {title: '操作', dataIndex: 'action', align: 'center'},
    ];

    const showModal = (type, model = {}) => {
      modalType.value = type;
      currentModel.value = {...model};
      isModalVisible.value = true;
    };

    const handleCancel = () => {
      isModalVisible.value = false;
      currentModel.value = {};
    };

    const deleteModel = (modelId) => {
      const index = modelStore.models.findIndex(model => model.modelId === modelId);
      if (index !== -1) {
        modelStore.models.splice(index, 1);
      }
    };

    const testConnection = (model) => {
      model.messages = [{role: 'user', content: '你好'}];
      const result = modelStore.chatCompletions(model);
      console.log(result);
      if (result) {
        message.success('连接成功');
      } else {
        message.error('连接失败');
      }
    };

    return {
      columns,
      models: modelStore.models,
      isModalVisible,
      showModal,
      handleCancel,
      deleteModel,
      testConnection,
      currentModel,
      modalType,
    };
  },
};
</script>

<style scoped>
</style>
