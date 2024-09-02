<template>
  <a-layout-content class="custom-content">
    <div class="header">
      <div class="title">用户管理</div>
      <a-button type="primary" @click="showModal('add')">添加用户</a-button>
    </div>
    <a-table :columns="columns" :dataSource="users" :rowKey="record => record.userId" class="custom-table">
      <template v-slot:bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="primary" @click="showModal('edit', record)">编辑</a-button>
            <a-popconfirm title="确定要删除这个用户吗？" okText="确定" cancelText="取消"
                          @confirm="() => deleteUser(record.userId)">
              <a-button type="primary">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
        <template v-else-if="column.dataIndex === 'avatar'">
          <div class="avatar-container" :style="{ backgroundColor: getAvatarColor(record.username) }">
            <img v-if="record.avatar" :src="record.avatar" class="avatar-img" alt="avatar"/>
            <div v-else class="avatar-placeholder">{{ record.username.charAt(0).toUpperCase() }}</div>
          </div>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="isModalVisible" :title="modalType === 'add' ? '添加用户' : '更新用户'" :footer="null">
      <UserForm v-if="isModalVisible" ref="userFormRef" :initialValues="currentUser" :mode="modalType"
                @onCancel="handleCancel"/>
    </a-modal>
  </a-layout-content>
</template>

<script>
import {ref, onMounted} from 'vue';
import UserForm from './UserForm.vue';
import {post} from '@/api';

export default {
  components: {
    UserForm
  },
  setup() {
    const users = ref([]);
    const isModalVisible = ref(false);
    const currentUser = ref({});
    const modalType = ref('add');

    const columns = [
      {title: '头像', dataIndex: 'avatar', align: 'center'},
      {title: '用户名', dataIndex: 'username', align: 'center'},
      {title: '邮箱', dataIndex: 'email', align: 'center'},
      {title: '操作', dataIndex: 'action', align: 'center'}
    ];

    const loadUsers = async () => {
      const res = await post('/users/getAll');
      if (res && res.success) {
        users.value = res.data;
      }
    };

    onMounted(loadUsers);

    function showModal(type, user = {}) {
      modalType.value = type;
      currentUser.value = {...user};
      isModalVisible.value = true;
    }

    function handleCancel() {
      isModalVisible.value = false;
      currentUser.value = {};
      loadUsers();
    }

    async function deleteUser(userId) {
      await post(`/users/delete`, {userId: userId});
      loadUsers();
    }

    function getAvatarColor(username) {
      const colors = ['#f56a00', '#1890ff', '#f5222d', '#52c41a', '#faad14', '#13c2c2', '#722ed1'];
      const char = username.charAt(0).toUpperCase();
      const charCode = char.charCodeAt(0);
      const colorIndex = charCode % colors.length;
      return colors[colorIndex];
    }

    return {
      columns,
      users,
      isModalVisible,
      showModal,
      handleCancel,
      deleteUser,
      currentUser,
      modalType,
      getAvatarColor
    };
  }
};
</script>

<style scoped>
.avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  font-size: 20px;
  text-align: center;
  line-height: 40px;
  margin: 0 auto; /* 使头像居中 */
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  font-size: 18px;
}
</style>