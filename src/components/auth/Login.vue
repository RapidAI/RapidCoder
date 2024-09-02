<template>
  <a-layout-content class="custom-card-content">
    <a-card title="用户登录" class="settings-card">
      <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          @submit.prevent="onSubmit"
      >
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="formState.username" name="username" placeholder="请输入用户名"/>
        </a-form-item>

        <a-form-item label="密码" name="password">
          <a-input-password v-model:value="formState.password" name="password" placeholder="请输入密码"/>
        </a-form-item>

        <a-form-item :wrapper-col="{ span: 24 }">
          <a-space>
            <a-button type="primary" html-type="submit">登录</a-button>
            <a-button type="default" @click="goToRegister">注册</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </a-layout-content>
</template>

<script>
import { ref, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { post } from '@/api';
import { useUserStore } from '@/store/UserStore.js';

export default {
  setup() {
    const router = useRouter();
    const userStore = useUserStore();
    const formRef = ref(null);
    const formState = reactive({
      username: '',
      password: '',
    });


    const rules = {
      username: [
        {required: true, message: '请输入用户名', trigger: 'blur'},
        {min: 2, max: 15, message: '用户名长度应为2到15个字符', trigger: 'blur'}
      ],
      password: [
        {required: true, message: '请输入密码', trigger: 'blur'},
        {min: 5, message: '密码长度不能少于5个字符', trigger: 'blur'}
      ],
    };

    const onSubmit = async () => {
      try {
        // 确保在验证之前手动同步表单状态
        await nextTick();
        await formRef.value.validate();
        const response = await post('/auth/login', {
          username: formState.username,
          password: formState.password
        });

        if (response.success) {
          userStore.login(response.data);
          router.push('/');
        } else {
          message.error(`登录失败: ${response.message}`);
        }
      } catch (error) {
        message.error('表单验证失败，请检查输入',error);
      }
    };

    const goToRegister = () => {
      router.push('/register');
    };

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      goToRegister
    };
  }
};
</script>

<style scoped>

</style>
