
<template>
  <a-layout class="full-height">
    <a-layout-sider theme="light">
      <a-menu
          mode="inline"
          :selectedKeys="[selectedDatabaseId]"
          @click="onSelectDatabase"
      >
        <a-menu-item v-for="item in treeData" :key="item.key">
          <DatabaseOutlined/>
          {{ item.title }}
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout-content class="custom-content">
      <a-form ref="form" layout="inline">
        <a-form-item label="AI智能检索">
          <a-input v-model:value="searchText" style="width: 300px;"/>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="onSearch">搜索</a-button>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="toChannel">导入</a-button>
        </a-form-item>
      </a-form>
      <a-table :pagination="{ pageSize: 5 }"  :columns="columns" :dataSource="queryVectors" :rowKey="record => record.queryVectorId">
        <template v-slot:bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'action'">
            <a-space>
              <a-button type="primary" @click="showModal('edit', record)">编辑</a-button>
              <a-popconfirm title="确定要删除这个信息吗？" okText="确定" cancelText="取消"
                            @confirm="() => deleteQueryVector(record.queryVectorId)">
                <a-button type="primary">删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template v-else>
            {{ record[column.dataIndex] }}
          </template>
        </template>
      </a-table>
      <a-modal v-model:open="isToChannelModalVisible" title="导入" width="90%" :footer="null">
        <QueryVectorBatchImportForm :selectedDatabaseId="selectedDatabaseId" @onCancel="handleCancel"></QueryVectorBatchImportForm>
      </a-modal>
      <a-modal v-model:open="isEditModalVisible" title="编辑" width="60%" :footer="null">
        <QueryVectorForm :initialValues="currentQueryVector" mode="edit" @onCancel="handleCancel"></QueryVectorForm>
      </a-modal>
    </a-layout-content>
  </a-layout>
</template>

<script>
import {onMounted, ref} from "vue";
import {post} from '@/api';
import {message} from 'ant-design-vue';
import {SearchOutlined, DatabaseOutlined} from '@ant-design/icons-vue';
import QueryVectorBatchImportForm from "@/components/queryvector/QueryVectorBatchImportForm.vue";
import QueryVectorForm from "@/components/queryvector/QueryVectorForm.vue";

export default {
  components: {
    QueryVectorBatchImportForm,
    QueryVectorForm,
    SearchOutlined,
    DatabaseOutlined,
  },
  setup() {
    const databases = ref([]); // 存储所有数据库信息
    const queryVectors = ref([]); // 存储所有向量
    const isToChannelModalVisible = ref(false); // 导入弹窗的可见性
    const isEditModalVisible = ref(false); // 编辑弹窗的可见性
    const currentQueryVector = ref({}); // 当前表信息
    const searchText = ref(""); // 检索内容
    const modalType = ref('add'); // 模态框类型
    const selectedDatabaseId = ref('0'); // 当前选中的数据库ID

    const columns = [
      {title: 'id', dataIndex: 'queryVectorId', align: 'center'},
      {title: '查询文本', dataIndex: 'queryText', align: 'center'},
      {title: '查询结果', dataIndex: 'resultText', align: 'center'},
      {title: '状态', dataIndex: 'success', align: 'center'},
      {title: '操作', dataIndex: 'action', align: 'center'}
    ];

    const treeData = ref([]); // 存储数据库树结构

    // 加载数据库信息
    const loadQueryVectors = async () => {
      const res = await post('/queryVectors/getAllByDatabaseId', {databaseInfoId: selectedDatabaseId.value});
      if (!res?.success) return;
      queryVectors.value = res.data
    };
    const loadDatabase = async () =>{
      const res = await post('/databases/getAll');
      if (!res?.success) return;

      // 更新数据库和树形数据
      databases.value = res.data;
      treeData.value = res.data.map(db => ({
        title: db.databaseName,
        key: String(db.databaseInfoId)
      }));

      // 选择默认数据库
      if (treeData.value.length > 0) {
        selectedDatabaseId.value = treeData.value[0].key;
        await loadQueryVectors(); // 默认选中第一个数据库就查询
      }
    }

    // 选择数据库
    const onSelectDatabase = async ({key}) => {
      selectedDatabaseId.value = key;
      loadQueryVectors()
    };

    // 显示模态框
    const showModal = (type, record) => {
      modalType.value = type;
      currentQueryVector.value = {...record};
      isEditModalVisible.value = true;
    };

    // 取消操作
    const handleCancel = () => {
      currentQueryVector.value = {};
      isToChannelModalVisible.value = false;
      isEditModalVisible.value = false;
      loadQueryVectors();
    };

    // 删除表信息
    const deleteQueryVector = async (queryVectorId) => {
      const res = await post(`/queryVectors/delete`, {queryVectorId});
      if (res && res.success) {
        message.success('删除成功');
        databases.value = databases.value.filter(item => item.queryVectorId !== queryVectorId);
        loadQueryVectors();
      } else {
        message.error('删除失败');
      }
    };

    // 搜索功能
    const onSearch = async () => {
      if (!searchText.value) {
        loadQueryVectors();
        return;
      }

      const res = await post(`/queryVectors/searchByVectorAndDatabaseInfoId`, {
        queryText: searchText.value,
        databaseInfoId: selectedDatabaseId.value
      });
      if (res && res.success) {
        message.success('检索成功');
        queryVectors.value = res.data
      } else {
        message.error('检索失败')
      }
    }

    // 打开导入弹窗
    const toChannel = () => {
      isToChannelModalVisible.value = true;
    };


    // 组件挂载时加载表数据
    onMounted(() => {
      loadDatabase();
    });
    return {
      queryVectors,
      columns,
      toChannel,
      searchText,
      isToChannelModalVisible,
      isEditModalVisible,
      showModal,
      handleCancel,
      currentQueryVector,
      modalType,
      treeData,
      selectedDatabaseId,
      onSelectDatabase,
      onSearch,
      deleteQueryVector
    };
  }
};
</script>