<template>
  <a-layout-content class="custom-card-content">
    <a-card title="个人信息" class="settings-card">
      <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
      >
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="formState.username" placeholder="请输入用户名"/>
        </a-form-item>

        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="formState.email" placeholder="请输入邮箱地址"/>
        </a-form-item>

        <a-form-item label="头像" name="avatar">
          <div class="avatar-display">
            <div class="avatar-container" :style="{ backgroundColor: getAvatarColor(formState.username) }">
              <img v-if="formState.avatar" :src="formState.avatar" class="avatar-img" alt="avatar"/>
              <div v-else class="avatar-placeholder">{{ getAvatarPlaceholder(formState.username) }}</div>
            </div>
            <a-input v-model:value="formState.avatar" placeholder="请输入头像URL" style="margin-top: 10px"/>
          </div>
        </a-form-item>

        <a-form-item label="新密码" name="password" v-if="showPassword">
          <a-input-password v-model:value="formState.password" placeholder="请输入新密码"/>
        </a-form-item>

        <a-form-item :wrapper-col="{ span: 24 }">
          <a-button type="default" @click="togglePasswordField">
            {{ showPassword ? '取消重置密码' : '重置密码' }}
          </a-button>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" @click="onSubmit">保存</a-button>
            <a-button type="primary" @click="onLogout">退出登录</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </a-layout-content>
</template>

<script>
import {ref, reactive, computed, onMounted} from 'vue';
import {post} from '@/api';
import {useUserStore} from "@/store/UserStore.js";
import {message} from 'ant-design-vue';
import {useRouter} from 'vue-router';

export default {
  setup() {
    const formRef = ref(null);
    const formState = reactive({
      userId: '',
      username: '',
      email: '',
      avatar: '',
      password: ''
    });

    const userStore = useUserStore();
    const showPassword = ref(false);
    const router = useRouter();

    const togglePasswordField = () => {
      showPassword.value = !showPassword.value;
      if (!showPassword.value) {
        formState.password = '';
      }
    };

    const rules = computed(() => ({
      username: [
        {required: true, message: '请输入用户名', trigger: 'blur'},
        {min: 2, max: 15, message: '用户名长度应为2到15个字符', trigger: 'blur'},
      ],
      email: [
        {required: true, message: '请输入邮箱地址', trigger: 'blur'},
        {type: 'email', message: '邮箱格式不正确', trigger: 'blur'},
      ],
      avatar: [
        {required: false, message: '请输入头像URL', trigger: 'blur'},
      ],
      password: [
        {required: showPassword.value, message: '请输入新密码', trigger: 'blur', min: 6},
      ],
    }));

    const loadUserProfile = async () => {
      const res = await post('/users/getById', {userId: userStore.userData.userId});
      if (res && res.success) {
        formState.userId = res.data.userId;
        formState.username = res.data.username;
        formState.email = res.data.email;
        formState.avatar = res.data.avatar;
        formState.password = ''; // 清空密码字段，确保安全
      }
    };

    onMounted(loadUserProfile);

    const getAvatarColor = (username) => {
      const colors = ['#f56a00', '#1890ff', '#f5222d', '#52c41a', '#faad14', '#13c2c2', '#722ed1'];
      const char = username.charAt(0).toUpperCase();
      const charCode = char.charCodeAt(0);
      const colorIndex = charCode % colors.length;
      return colors[colorIndex];
    };

    const getAvatarPlaceholder = (username) => {
      const isChinese = /^[\u4e00-\u9fa5]+$/.test(username);
      if (isChinese) {
        return username.charAt(username.length - 1);
      } else {
        return username.charAt(0).toUpperCase();
      }
    };

    const onSubmit = async () => {
      try {
        await formRef.value.validate();
        const updatedUser = {
          ...formState,
          password: formState.password ? formState.password : undefined // 确保密码字段只在有值时发送
        };

        const res = await post('/users/update', updatedUser);
        if (res && res.success) {
          message.success('用户信息已更新');
          loadUserProfile(); // 重新加载用户信息
        }
      } catch (error) {
        message.error('更新失败，请检查输入内容');
        console.error('Validation failed or request error:', error);
      }
    };

    const onLogout = () => {
      userStore.logout();
      router.push('/login');
    };

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      showPassword,
      togglePasswordField,
      getAvatarColor,
      getAvatarPlaceholder,
      onLogout
    };
  }
};
</script>

<style scoped>
.avatar-display {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  color: white;
  font-size: 32px;
  text-align: center;
  line-height: 80px;
  margin-bottom: 10px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  font-size: 32px;
}
</style>
