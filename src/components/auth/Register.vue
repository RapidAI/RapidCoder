<template>
  <a-layout-content class="custom-card-content">
    <a-card title="注册新用户" class="settings-card">
      <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          @submit.prevent="onSubmit"
      >
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="formState.username" placeholder="请输入用户名"/>
        </a-form-item>

        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="formState.email" placeholder="请输入邮箱地址"/>
        </a-form-item>

        <a-form-item label="密码" name="password">
          <a-input-password v-model:value="formState.password" placeholder="请输入密码"/>
        </a-form-item>

        <a-form-item label="确认密码" name="confirmPassword">
          <a-input-password v-model:value="formState.confirmPassword" placeholder="请确认密码"/>
        </a-form-item>

        <a-form-item :wrapper-col="{ span: 24 }">
          <a-button type="primary" html-type="submit">注册</a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </a-layout-content>
</template>

<script>
import {ref, reactive, nextTick} from 'vue';
import { post } from '@/api';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';

export default {
  setup() {
    const router = useRouter();
    const formRef = ref(null);
    const formState = reactive({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });

    const rules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 2, max: 15, message: '用户名长度应为2到15个字符', trigger: 'blur' }
      ],
      email: [
        { required: true, message: '请输入邮箱地址', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
      ],
      confirmPassword: [
        { required: true, message: '请确认密码', trigger: 'blur' },
        { validator: validateConfirmPassword, trigger: 'blur' }
      ],
    };

    function validateConfirmPassword(rule, value) {
      if (value !== formState.password) {
        return Promise.reject('两次输入的密码不匹配');
      }
      return Promise.resolve();
    }

    const onSubmit = async () => {
        await nextTick();
        await formRef.value.validate();
        const response = await post('/auth/register', {
          username: formState.username,
          email: formState.email,
          password: formState.password,
        });

        if (response.success) {
          message.success('注册成功');
          router.push('/login');
        } else {
          message.error(`注册失败: ${response.message}`);
        }
    };

    return {
      formRef,
      formState,
      rules,
      onSubmit
    };
  }
};
</script>

<style scoped>
</style>
